// Prueba offline (sin red ni claves) de la verificación del hash de interacción.
//   npm run op:test
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { verifyHash, toUrl } from './openPayments.js';

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

console.log('op:test OK (hash e URLs de billetera)');
