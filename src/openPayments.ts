// Módulo central de Open Payments. Flujo "monto fijo a recibir" (remesa entre monedas):
//   1) Crear incoming payment en la billetera DESTINO (caja del círculo)
//   2) Crear quote en la billetera ORIGEN (el miembro) -> dice cuánto se debita
//   3) Pedir grant interactivo de outgoing-payment -> redirigir al miembro a autorizar
//   4) Callback: verificar hash, continuar grant, crear outgoing payment
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createAuthenticatedClient,
  isPendingGrant,
  isFinalizedGrantWithAccessToken,
  type AuthenticatedClient,
  type Quote,
} from '@interledger/open-payments';

let client: AuthenticatedClient | null = null;

// Las billeteras pueden escribirse como $ilp... ; las URL reales son https
export const toUrl = (w: string) => w.trim().replace(/^\$/, 'https://');

export async function getClient(): Promise<AuthenticatedClient> {
  if (client) return client;
  const missing = ['WALLET_ADDRESS_URL', 'KEY_ID', 'PRIVATE_KEY_PATH'].filter((k) => !process.env[k]);
  if (missing.length) throw new Error(`Falta configurar en .env: ${missing.join(', ')}`);
  client = await createAuthenticatedClient({
    walletAddressUrl: toUrl(process.env.WALLET_ADDRESS_URL!),
    privateKey: process.env.PRIVATE_KEY_PATH!,
    keyId: process.env.KEY_ID!,
  });
  return client;
}

export interface StartResult {
  redirectUrl: string;
  state: PendingPayment;
}

// Todo lo que hay que recordar entre "iniciar" y "callback"
export interface PendingPayment {
  nonce: string;
  interactNonce: string; // lo devuelve el servidor de autorización en pending.interact.finish
  senderWallet: string;
  quoteId: string;
  continueUri: string;
  continueToken: string;
  authServer: string;
  debit: { value: string; assetCode: string; assetScale: number };
  receive: { value: string; assetCode: string; assetScale: number };
  expiresAt?: string; // la cotización caduca: el miembro debe autorizar antes de esta hora
}

/** receiveValue: entero en unidades mínimas del activo del destino (ej. 1000 = 10.00 USD si scale=2) */
export async function startPayment(opts: {
  senderWallet: string;
  receiverWallet: string; // caja del círculo
  receiveValue: string;
  finishUri: string;
}): Promise<StartResult> {
  const c = await getClient();
  const sender = await c.walletAddress.get({ url: toUrl(opts.senderWallet) });
  const receiver = await c.walletAddress.get({ url: toUrl(opts.receiverWallet) });

  // 1) incoming payment en la caja del círculo
  const incGrant = await c.grant.request(
    { url: receiver.authServer },
    { access_token: { access: [{ type: 'incoming-payment', actions: ['create'] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(incGrant)) throw new Error('Grant incoming-payment no finalizado');

  const receiveAmount = {
    value: opts.receiveValue,
    assetCode: receiver.assetCode,
    assetScale: receiver.assetScale,
  };
  const incoming = await c.incomingPayment.create(
    { url: receiver.resourceServer, accessToken: incGrant.access_token.value },
    { walletAddress: receiver.id, incomingAmount: receiveAmount },
  );

  // 2) quote en la billetera del miembro (fija lo que recibe el círculo)
  const quoteGrant = await c.grant.request(
    { url: sender.authServer },
    { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error('Grant quote no finalizado');

  const quote: Quote = await c.quote.create(
    { url: sender.resourceServer, accessToken: quoteGrant.access_token.value },
    { walletAddress: sender.id, receiver: incoming.id, method: 'ilp', receiveAmount },
  );

  // 3) grant interactivo para el pago saliente (siempre requiere aprobación del dueño)
  const nonce = randomUUID();
  const pending = await c.grant.request(
    { url: sender.authServer },
    {
      access_token: {
        access: [
          {
            identifier: sender.id,
            type: 'outgoing-payment',
            actions: ['create', 'read'],
            // Igual que el ejemplo oficial: el límite es lo que se debita, que es lo que ve el miembro al autorizar
            limits: { debitAmount: quote.debitAmount },
          },
        ],
      },
      interact: {
        start: ['redirect'],
        finish: { method: 'redirect', uri: opts.finishUri, nonce },
      },
    },
  );
  if (!isPendingGrant(pending)) throw new Error('Se esperaba un grant pendiente de autorización');

  return {
    redirectUrl: pending.interact.redirect,
    state: {
      nonce,
      interactNonce: pending.interact.finish,
      senderWallet: sender.id,
      quoteId: quote.id,
      continueUri: pending.continue.uri,
      continueToken: pending.continue.access_token.value,
      authServer: sender.authServer,
      debit: quote.debitAmount,
      receive: quote.receiveAmount,
      expiresAt: quote.expiresAt,
    },
  };
}

// La especificación define el hash en Base64 sin relleno; algunas implementaciones usan base64 estándar con "=".
// Se normaliza todo a base64url sin relleno para comparar sin depender de esa variante.
const canon = (s: string) => s.replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

/** Verifica que el redirect de vuelta realmente viene del servidor de autorización
 *  hash = SHA-256( clientNonce \n interactNonce \n interactRef \n URL del grant request ) */
export function verifyHash(p: {
  clientNonce: string;
  interactNonce: string;
  interactRef: string;
  authServer: string;
  hash: string;
}): boolean {
  const data = `${p.clientNonce}\n${p.interactNonce}\n${p.interactRef}\n${p.authServer}`;
  const expected = Buffer.from(canon(createHash('sha256').update(data).digest('base64')));
  const received = Buffer.from(canon(p.hash));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export async function finishPayment(opts: {
  state: PendingPayment;
  interactRef: string;
  hash: string;
}) {
  const { state } = opts;
  // El hash usa la URL del grant request (la del auth server); no hay consenso sobre el "/" final, probamos ambas
  const base = state.authServer.replace(/\/$/, '');
  const args = { clientNonce: state.nonce, interactNonce: state.interactNonce, interactRef: opts.interactRef, hash: opts.hash };
  const ok = verifyHash({ ...args, authServer: base }) || verifyHash({ ...args, authServer: base + '/' });
  if (!ok) throw new Error('Hash de interacción inválido');

  const c = await getClient();
  const sender = await c.walletAddress.get({ url: toUrl(state.senderWallet) });
  const grant = await c.grant.continue(
    { url: state.continueUri, accessToken: state.continueToken },
    { interact_ref: opts.interactRef },
  );
  if (!isFinalizedGrantWithAccessToken(grant)) throw new Error('El usuario aún no autorizó el pago');

  const outgoing = await c.outgoingPayment.create(
    { url: sender.resourceServer, accessToken: grant.access_token.value },
    { walletAddress: sender.id, quoteId: state.quoteId },
  );
  return outgoing;
}
