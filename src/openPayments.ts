// Módulo central: aportes con monto fijo a recibir y entregas con monto fijo a debitar.
//   1) Crear incoming payment en DESTINO (caja para aportes, miembro para entregas)
//   2) Crear quote en ORIGEN, fijando receiveAmount o debitAmount
//   3) Pedir grant interactivo de outgoing-payment -> el dueño del origen autoriza
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

export type PaymentErrorCode = 'expired' | 'rejected' | 'network' | 'hash' | 'other';
export class PaymentError extends Error {
  constructor(public readonly code: PaymentErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'PaymentError';
  }
}

// El SDK guarda el fallo de transporte en description, separado del mensaje genérico.
// No confundir un rechazo HTTP de autorización con un problema de conexión.
export function paymentError(error: unknown): PaymentError {
  if (error instanceof PaymentError) return error;
  if (!error || typeof error !== 'object') return new PaymentError('other', 'No pudimos procesar el pago, intenta de nuevo');
  const e = error as { message?: string; description?: string; name?: string; status?: number; code?: string };
  const transport = `${e.message ?? ''} ${e.description ?? ''} ${e.name ?? ''} ${e.code ?? ''}`;
  if ((e.status === undefined && /fetch failed|failed to fetch|network|timeout|timed out|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ETIMEDOUT|socket hang up/i.test(transport)) ||
      [502, 503, 504].includes(e.status ?? 0)) {
    return new PaymentError('network', 'No pudimos conectar con la billetera de prueba, intenta de nuevo', { cause: error });
  }
  const code: PaymentErrorCode = ['grant_rejected', 'request_denied', 'access_denied'].includes(e.code ?? '') ||
    /^(El miembro|El dueño de la billetera) rechazó el pago$/.test(e.message ?? '') ? 'rejected' : 'other';
  return new PaymentError(code, error instanceof Error ? error.message : 'No pudimos procesar el pago, intenta de nuevo', { cause: error });
}

function positiveUnits(value: string, context: 'aporte' | 'entrega'): string {
  if (typeof value !== 'string' || !/^\d+$/.test(value) || BigInt(value) === 0n) {
    throw new PaymentError('other', `El monto ${context === 'aporte' ? 'del aporte' : 'de la entrega'} debe ser un entero positivo en unidades mínimas`);
  }
  if (BigInt(value) > 18446744073709551615n) throw new PaymentError('other', 'El monto supera el máximo admitido por Open Payments');
  return BigInt(value).toString();
}

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
  expiresAt?: string; // el outgoing debe crearse antes de esta hora
}

/** receiveValue: entero en unidades mínimas del activo del destino (ej. 1000 = 10.00 USD si scale=2) */
export async function startPayment(opts: {
  senderWallet: string;
  receiverWallet: string; // caja del círculo
  receiveValue: string;
  finishUri: string;
}): Promise<StartResult> {
  const startedAt = performance.now();
  try {
    const result = await startPaymentRequest({ ...opts, value: positiveUnits(opts.receiveValue, 'aporte'), mode: 'receive' });
    console.info('[OpenPayments] Solicitud preparada', {
      durationMs: Math.round(performance.now() - startedAt),
      quoteRemainingMs: result.state.expiresAt ? Date.parse(result.state.expiresAt) - Date.now() : null,
    });
    return result;
  } catch (error) {
    throw paymentError(error);
  }
}

/** debitValue: entero en unidades mínimas del activo de la caja; autoriza su dueño. */
export async function startPayout(opts: {
  potWallet: string;
  memberWallet: string;
  debitValue: string;
  finishUri: string;
}): Promise<StartResult> {
  const startedAt = performance.now();
  try {
    const result = await startPaymentRequest({
      senderWallet: opts.potWallet, receiverWallet: opts.memberWallet,
      value: positiveUnits(opts.debitValue, 'entrega'), mode: 'debit', finishUri: opts.finishUri,
    });
    console.info('[OpenPayments] Entrega preparada', {
      durationMs: Math.round(performance.now() - startedAt),
      quoteRemainingMs: result.state.expiresAt ? Date.parse(result.state.expiresAt) - Date.now() : null,
    });
    return result;
  } catch (error) {
    throw paymentError(error);
  }
}

// No repetir POST automáticamente: una respuesta perdida no demuestra que el recurso no se creó.
async function startPaymentRequest(opts: {
  senderWallet: string;
  receiverWallet: string;
  value: string;
  mode: 'receive' | 'debit';
  finishUri: string;
}): Promise<StartResult> {
  const c = await getClient();
  const sender = await c.walletAddress.get({ url: toUrl(opts.senderWallet) });
  const receiver = await c.walletAddress.get({ url: toUrl(opts.receiverWallet) });

  // 1) incoming en destino: sin monto fijo para entregas, fijo para aportes.
  const incGrant = await c.grant.request(
    { url: receiver.authServer },
    { access_token: { access: [{ type: 'incoming-payment', actions: ['create'] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(incGrant)) throw new Error('Grant incoming-payment no finalizado');

  const receiveAmount = {
    value: opts.value,
    assetCode: receiver.assetCode,
    assetScale: receiver.assetScale,
  };
  const incoming = await c.incomingPayment.create(
    { url: receiver.resourceServer, accessToken: incGrant.access_token.value },
    opts.mode === 'receive' ? { walletAddress: receiver.id, incomingAmount: receiveAmount } : { walletAddress: receiver.id },
  );

  // 2) quote en origen: receiveAmount (aporte) o debitAmount (entrega).
  const quoteGrant = await c.grant.request(
    { url: sender.authServer },
    { access_token: { access: [{ type: 'quote', actions: ['create', 'read'] }] } },
  );
  if (!isFinalizedGrantWithAccessToken(quoteGrant)) throw new Error('Grant quote no finalizado');

  const quote: Quote = await c.quote.create(
    { url: sender.resourceServer, accessToken: quoteGrant.access_token.value },
    {
      walletAddress: sender.id, receiver: incoming.id, method: 'ilp',
      ...(opts.mode === 'receive' ? { receiveAmount } : {
        debitAmount: { value: opts.value, assetCode: sender.assetCode, assetScale: sender.assetScale },
      }),
    },
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
  try {
    return await finishPaymentRequest(opts);
  } catch (error) {
    throw paymentError(error);
  }
}

async function finishPaymentRequest(opts: {
  state: PendingPayment;
  interactRef: string;
  hash: string;
}) {
  const { state } = opts;
  // El hash usa la URL del grant request (la del auth server); no hay consenso sobre el "/" final, probamos ambas
  const base = state.authServer.replace(/\/$/, '');
  const args = { clientNonce: state.nonce, interactNonce: state.interactNonce, interactRef: opts.interactRef, hash: opts.hash };
  const ok = verifyHash({ ...args, authServer: base }) || verifyHash({ ...args, authServer: base + '/' });
  if (!ok) throw new PaymentError('hash', 'Hash de interacción inválido');

  // No consumir el grant ni intentar crear un pago con una cotización ya vencida.
  if (state.expiresAt && Date.now() >= Date.parse(state.expiresAt)) {
    throw new PaymentError('expired', 'La cotización venció, vuelve a intentar');
  }

  const c = await getClient();
  const sender = await c.walletAddress.get({ url: toUrl(state.senderWallet) });
  const grant = await c.grant.continue(
    { url: state.continueUri, accessToken: state.continueToken },
    { interact_ref: opts.interactRef },
  );
  if (!isFinalizedGrantWithAccessToken(grant)) throw new Error('El usuario aún no autorizó el pago');

  // La continuación también puede tardar y cruzar el vencimiento.
  if (state.expiresAt && Date.now() >= Date.parse(state.expiresAt)) {
    throw new PaymentError('expired', 'La cotización venció, vuelve a intentar');
  }

  const outgoing = await c.outgoingPayment.create(
    { url: sender.resourceServer, accessToken: grant.access_token.value },
    { walletAddress: sender.id, quoteId: state.quoteId },
  );
  return outgoing;
}
