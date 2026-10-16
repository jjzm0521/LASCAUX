// Prueba de extremo a extremo de Open Payments SIN base de datos, usando el mismo módulo que la app.
//   npm run op:pay -- <billetera_que_envia> <billetera_que_recibe> [valor_a_recibir_en_unidades_minimas]
// Ejemplo (Juan -> Sofía, recibe 1.00 USD):
//   npm run op:pay -- https://ilp.interledger-test.dev/emisor_op https://ilp.interledger-test.dev/receptor_op 100
// Necesita WALLET_ADDRESS_URL, KEY_ID y PRIVATE_KEY_PATH en .env. Abre el enlace que imprime y autoriza en la billetera que envía.
import 'dotenv/config';
import express from 'express';
import { startPayment, finishPayment, type PendingPayment } from './openPayments.js';

const [sender, receiver, value = '100'] = process.argv.slice(2);
if (!sender || !receiver) {
  console.error('Uso: npm run op:pay -- <billetera_que_envia> <billetera_que_recibe> [valor]');
  process.exit(1);
}

const PORT = Number(process.env.OP_CALLBACK_PORT ?? 3999);
const WAIT_MS = 10 * 60_000; // permite autorizar después de expiresAt para probar el error de cotización vencida

async function main() {
  const finishUri = `http://localhost:${PORT}/finish`;
  console.log('1/3 Creando incoming payment, cotización y solicitud de autorización...');
  const { redirectUrl, state } = await startPayment({ senderWallet: sender, receiverWallet: receiver, receiveValue: value, finishUri });

  const fmt = (a: { value: string; assetCode: string; assetScale: number }) =>
    `${(Number(a.value) / 10 ** a.assetScale).toFixed(a.assetScale)} ${a.assetCode}`;
  console.log(`    Se debitan ${fmt(state.debit)}; el destino recibe ${fmt(state.receive)}.`);
  if (state.expiresAt) console.log(`    La cotización caduca: ${state.expiresAt}`);
  console.log('\n2/3 Abre este enlace en el navegador y autoriza el pago en la billetera que envía:\n');
  console.log(`    ${redirectUrl}\n`);

  const params = await waitForCallback();
  if (params.result === 'grant_rejected') throw new Error('El dueño de la billetera rechazó el pago');
  if (!params.interact_ref || !params.hash) throw new Error(`Callback sin interact_ref/hash: ${JSON.stringify(params)}`);

  console.log('3/3 Autorización recibida. Verificando hash y creando el outgoing payment...');
  const outgoing = await finishPayment({ state: state as PendingPayment, interactRef: params.interact_ref, hash: params.hash });
  console.log('\nOK. Outgoing payment creado:', outgoing.id);
  console.log('Estado:', outgoing.failed ? 'FALLIDO' : 'en curso/completado', '| debitAmount:', fmt(outgoing.debitAmount), '| receiveAmount:', fmt(outgoing.receiveAmount));
}

function waitForCallback(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    const app = express();
    const server = app.listen(PORT);
    const timer = setTimeout(() => { server.close(); reject(new Error('Tiempo agotado esperando la autorización')); }, WAIT_MS);
    server.on('error', (e: any) => { clearTimeout(timer); reject(e.code === 'EADDRINUSE' ? new Error(`El puerto ${PORT} está ocupado (cambia OP_CALLBACK_PORT)`) : e); });
    app.get('/finish', (req, res) => {
      res.send('<h1>Listo</h1><p>Puedes cerrar esta ventana y volver a la terminal.</p>');
      clearTimeout(timer);
      server.close();
      resolve(Object.fromEntries(Object.entries(req.query).map(([k, v]) => [k, String(v)])));
    });
  });
}

main().then(() => process.exit(0)).catch((e) => { console.error('\nERROR:', e?.message ?? e, e?.description ?? ''); process.exit(1); });
