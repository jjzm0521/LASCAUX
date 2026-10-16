// Prueba offline (sin red ni claves) de la verificación del hash de interacción.
//   npm run op:test
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyHash, toUrl, finishPayment, paymentError, type PendingPayment } from './openPayments.js';

// Vector de https://openpayments.dev/identity/hash-verification/
const v = {
  clientNonce: 'VJLO6A4CATR0KRO',
  interactNonce: 'MBDOFXG4Y5CVJCX821LH',
  interactRef: '4IFWWIKYB2PQ6U56NL1',
  authServer: 'https://server.example.com/tx',
};
const docHash = 'x-gguKWTj8rQf7d7i3w3UhzvuJ5bpOlKyAlVpLxBffY'; // base64url sin relleno

assert.equal(verifyHash({ ...v, hash: docHash }), true, 'vector de la documentación');
const std = createHash('sha256').update(`${v.clientNonce}\n${v.interactNonce}\n${v.interactRef}\n${v.authServer}`).digest('base64');
assert.equal(verifyHash({ ...v, hash: std }), true, 'base64 estándar con relleno también se acepta');
assert.equal(verifyHash({ ...v, hash: docHash.slice(0, -1) + 'Z' }), false, 'hash alterado');
assert.equal(verifyHash({ ...v, interactRef: 'otro', hash: docHash }), false, 'interact_ref distinto');
assert.equal(verifyHash({ ...v, hash: '' }), false, 'hash vacío');

assert.equal(toUrl('$ilp.interledger-test.dev/emisor_op'), 'https://ilp.interledger-test.dev/emisor_op');
assert.equal(toUrl('https://ilp.interledger-test.dev/emisor_op'), 'https://ilp.interledger-test.dev/emisor_op');

// Callback auténtico pero tardío: debe rechazarse antes de acceder al cliente o la red.
const expired: PendingPayment = {
  nonce: v.clientNonce, interactNonce: v.interactNonce, authServer: v.authServer,
  senderWallet: 'https://sender.example', quoteId: 'https://sender.example/quote',
  continueUri: 'https://server.example.com/continue', continueToken: 'offline-fixture',
  debit: { value: '100', assetCode: 'COP', assetScale: 2 },
  receive: { value: '100', assetCode: 'USD', assetScale: 2 },
  expiresAt: '2000-01-01T00:00:00Z',
};
await assert.rejects(finishPayment({ state: expired, interactRef: v.interactRef, hash: docHash }),
  { message: 'La cotización venció, vuelve a intentar' });
await assert.rejects(finishPayment({ state: expired, interactRef: v.interactRef, hash: '' }),
  { message: 'Hash de interacción inválido' });

const networkMessage = 'No pudimos conectar con la billetera de prueba, intenta de nuevo';
assert.equal(paymentError(Object.assign(new Error('Error making Open Payments POST request'), { description: 'fetch failed' })).message, networkMessage);
assert.equal(paymentError(new TypeError('fetch failed')).message, networkMessage);
assert.equal(paymentError(Object.assign(new Error('Timeout'), { name: 'TimeoutError' })).message, networkMessage);
assert.equal(paymentError(Object.assign(new Error('Service unavailable'), { status: 503 })).message, networkMessage);
const rejected = Object.assign(new Error('Forbidden'), { status: 403, description: 'network access denied' });
assert.equal(paymentError(rejected), rejected, 'no convertir autorización HTTP en error de red');
const invalidQuote = Object.assign(new Error('Error making Open Payments POST request'), { status: 400, description: 'invalid quote' });
assert.equal(paymentError(invalidQuote), invalidQuote);

console.log('op:test OK (hash, URLs, callback vencido y errores de transporte sin red)');
