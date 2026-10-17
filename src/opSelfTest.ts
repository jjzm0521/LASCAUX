// Prueba offline (sin red ni claves) de la verificación del hash de interacción.
//   npm run op:test
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyHash, toUrl, finishPayment, startPayment, startPayout, PaymentError, paymentError, type PendingPayment } from './openPayments.js';

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
  { code: 'expired', message: 'La cotización venció, vuelve a intentar' });
await assert.rejects(finishPayment({ state: expired, interactRef: v.interactRef, hash: '' }),
  { code: 'hash', message: 'Hash de interacción inválido' });

const networkMessage = 'No pudimos conectar con la billetera de prueba, intenta de nuevo';
assert.equal(paymentError(Object.assign(new Error('Error making Open Payments POST request'), { description: 'fetch failed' })).message, networkMessage);
assert.equal(paymentError(new TypeError('fetch failed')).message, networkMessage);
assert.equal(paymentError(Object.assign(new Error('Timeout'), { name: 'TimeoutError' })).message, networkMessage);
assert.equal(paymentError(Object.assign(new Error('Service unavailable'), { status: 503 })).message, networkMessage);
const rejected = Object.assign(new Error('Forbidden'), { status: 403, description: 'network access denied' });
assert.equal(paymentError(rejected).code, 'other', '403 genérico no es un rechazo del dueño ni un error de red');
assert.equal(paymentError(rejected).message, rejected.message);
const invalidQuote = Object.assign(new Error('Error making Open Payments POST request'), { status: 400, description: 'invalid quote' });
assert.equal(paymentError(invalidQuote).code, 'other', 'invalid quote sin más no demuestra vencimiento');
assert.equal(paymentError(new TypeError('fetch failed')).code, 'network');
assert.equal(paymentError(new Error('El miembro rechazó el pago')).code, 'rejected');
assert.equal(paymentError(Object.assign(new Error('Grant denied'), { code: 'request_denied' })).code, 'rejected');
const typed = new PaymentError('rejected', 'El dueño de la billetera rechazó el pago');
assert.equal(paymentError(typed), typed);
assert.equal(paymentError(null).code, 'other');

for (const value of ['', '0', '00', '-1', '1.5', '1e3', ' 100', '+1', '18446744073709551616']) {
  await assert.rejects(startPayment({ senderWallet: 'https://sender.example', receiverWallet: 'https://receiver.example', receiveValue: value, finishUri: 'http://localhost/finish' }), { code: 'other' });
  await assert.rejects(startPayout({ potWallet: 'https://sender.example', memberWallet: 'https://receiver.example', debitValue: value, finishUri: 'http://localhost/finish' }), { code: 'other' });
}

await import('./opFlowSelfTest.js');

console.log('op:test OK (hash, errores tipados, validación uint64 y flujos aporte/entrega offline)');
