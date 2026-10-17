// Contratos del SDK simulados con una clave efímera en memoria: sin .env ni red.
import assert from 'node:assert/strict';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { getClient, startPayment, startPayout, finishPayment } from './openPayments.js';

process.env.WALLET_ADDRESS_URL = 'https://client.example';
process.env.KEY_ID = 'offline-fixture';
process.env.PRIVATE_KEY_PATH = String(generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }));
const client = await getClient();
const sender = 'https://pot.example';
const receiver = 'https://member.example';
let incomingBody: Record<string, unknown> = {};
let quoteBody: Record<string, any> = {};
let access: Record<string, any> = {};
client.walletAddress.get = (async ({ url }: { url: string }) => ({
  id: url, assetCode: url === sender ? 'USD' : 'COP', assetScale: 2,
  authServer: `https://auth.example/${url === sender ? 'pot' : 'member'}`, resourceServer: 'https://rs.example',
})) as typeof client.walletAddress.get;
client.incomingPayment.create = (async (_args: unknown, body: Record<string, unknown>) => {
  incomingBody = body;
  return { id: 'https://rs.example/incoming/fixture' };
}) as unknown as typeof client.incomingPayment.create;
client.quote.create = (async (_args: unknown, body: Record<string, any>) => {
  quoteBody = body;
  return {
    id: 'https://rs.example/quotes/fixture',
    debitAmount: body.debitAmount ?? { value: '10', assetCode: 'USD', assetScale: 2 },
    receiveAmount: body.receiveAmount ?? { value: '30000', assetCode: 'COP', assetScale: 2 },
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  };
}) as unknown as typeof client.quote.create;
client.grant.request = (async (args: { url: string }, body: Record<string, any>) => {
  if (!body.interact) return { access_token: { value: 'offline-token' } };
  assert.equal(args.url, 'https://auth.example/pot', 'autoriza el servidor del origen, no el receptor');
  access = body.access_token.access[0];
  return {
    interact: { redirect: 'https://auth.example/authorize', finish: 'server-nonce' },
    continue: { uri: 'https://auth.example/continue', access_token: { value: 'offline-continue' } },
  };
}) as unknown as typeof client.grant.request;

for (const receiveValue of ['1', '17', '12345', '18446744073709551615']) {
  const result = await startPayment({ senderWallet: sender, receiverWallet: receiver, receiveValue, finishUri: 'http://localhost/finish' });
  assert.deepEqual(incomingBody.incomingAmount, { value: receiveValue, assetCode: 'COP', assetScale: 2 });
  assert.equal(quoteBody.receiveAmount.value, receiveValue);
  assert.equal(quoteBody.debitAmount, undefined);
  assert.equal(result.state.receive.value, receiveValue);
}
const payout = await startPayout({ potWallet: sender, memberWallet: receiver, debitValue: '00125', finishUri: 'http://localhost/finish' });
assert.deepEqual(incomingBody, { walletAddress: receiver }, 'entrega: incoming sin monto fijo');
assert.equal(quoteBody.receiveAmount, undefined);
assert.deepEqual(quoteBody.debitAmount, { value: '125', assetCode: 'USD', assetScale: 2 });
assert.equal(quoteBody.walletAddress, sender);
assert.equal(access.identifier, sender);
assert.deepEqual(access.limits, { debitAmount: payout.state.debit });
assert.equal(payout.state.senderWallet, sender);
assert.equal(payout.state.receive.assetCode, 'COP');

client.grant.continue = (async () => ({ access_token: { value: 'offline-final' } })) as unknown as typeof client.grant.continue;
client.outgoingPayment.create = (async (_args: unknown, body: Record<string, string>) => {
  assert.deepEqual(body, { walletAddress: sender, quoteId: payout.state.quoteId });
  return { id: 'https://rs.example/outgoing/fixture' };
}) as unknown as typeof client.outgoingPayment.create;
const interactRef = 'fixture-ref';
const hash = createHash('sha256').update(`${payout.state.nonce}\n${payout.state.interactNonce}\n${interactRef}\n${payout.state.authServer}`).digest('base64');
assert.equal((await finishPayment({ state: payout.state, interactRef, hash })).id, 'https://rs.example/outgoing/fixture');
await assert.rejects(finishPayment({ state: payout.state, interactRef: 'tampered-ref', hash }), { code: 'hash' });

client.quote.create = (async () => {
  throw Object.assign(new Error('Error making Open Payments POST request'), { description: 'fetch failed' });
}) as typeof client.quote.create;
await assert.rejects(startPayout({ potWallet: sender, memberWallet: receiver, debitValue: '125', finishUri: 'http://localhost/finish' }), { code: 'network' });
await assert.rejects(startPayment({ senderWallet: sender, receiverWallet: receiver, receiveValue: '17', finishUri: 'http://localhost/finish' }), { code: 'network' });
client.grant.continue = (async () => {
  throw Object.assign(new Error('El dueño de la billetera rechazó el pago'), { code: 'request_denied' });
}) as typeof client.grant.continue;
await assert.rejects(finishPayment({ state: payout.state, interactRef, hash }), { code: 'rejected', message: 'El dueño de la billetera rechazó el pago' });
