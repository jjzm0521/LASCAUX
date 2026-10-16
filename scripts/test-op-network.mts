// Integración offline: un POST de incoming falla, no se repite automáticamente y el usuario reintenta.
import assert from 'node:assert/strict';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dir = mkdtempSync(join(tmpdir(), 'laucaux-network-'));
const keyPath = join(dir, 'fixture.pem');
writeFileSync(keyPath, generateKeyPairSync('ed25519').privateKey.export({ type: 'pkcs8', format: 'pem' }));
Object.assign(process.env, {
  PRIVATE_KEY_PATH: keyPath, KEY_ID: 'offline-fixture',
  WALLET_ADDRESS_URL: 'https://sender.example', DB_PATH: join(dir, 'test.db'), PORT: '3197',
});

try {
  const { getClient } = await import('../src/openPayments.js');
  const { db } = await import('../src/db.js');
  const client = await getClient();
  client.walletAddress.get = (async ({ url }: { url: string }) => ({
    id: url, assetCode: url.includes('receiver') ? 'USD' : 'COP', assetScale: 2,
    authServer: 'https://auth.example', resourceServer: 'https://resource.example',
  })) as typeof client.walletAddress.get;
  let incomingCalls = 0;
  let grantCalls = 0;
  client.incomingPayment.create = (async () => {
    incomingCalls++;
    if (incomingCalls === 1) throw Object.assign(new Error('Error making Open Payments POST request'), { description: 'fetch failed' });
    return { id: 'https://receiver.example/incoming/fixture' };
  }) as typeof client.incomingPayment.create;
  client.quote.create = (async () => ({
    id: 'https://sender.example/quote/fixture',
    debitAmount: { value: '3176658', assetCode: 'COP', assetScale: 2 },
    receiveAmount: { value: '1000', assetCode: 'USD', assetScale: 2 },
    expiresAt: new Date(Date.now() + 300000).toISOString(),
  })) as typeof client.quote.create;
  client.grant.request = (async (_args: unknown, body: { interact?: unknown }) => {
    grantCalls++;
    return body.interact ? {
      interact: { redirect: 'https://auth.example/authorize', finish: 'fixture-nonce' },
      continue: { uri: 'https://auth.example/continue', access_token: { value: 'fixture-token' } },
    } : { access_token: { value: 'fixture-token' } };
  }) as typeof client.grant.request;
  db.prepare("INSERT INTO circles (name,pot_wallet,contribution) VALUES ('Offline','https://receiver.example',1000)").run();
  db.prepare("INSERT INTO members (circle_id,name,country,wallet,turn) VALUES (1,'Test','CO','https://sender.example',1)").run();
  await import('../src/server.js');
  const contribute = () => fetch('http://localhost:3197/api/circles/1/contribute', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ memberId: 1 }),
  });
  const failed = await contribute();
  assert.equal(failed.status, 500);
  assert.equal((await failed.json()).error, 'No pudimos conectar con la billetera de prueba, intenta de nuevo');
  assert.equal(incomingCalls, 1, 'no repetir un POST cuyo resultado remoto podría ser ambiguo');
  assert.deepEqual(db.prepare('SELECT status,pending_json FROM contributions WHERE id=1').get(), { status: 'failed', pending_json: null });
  const retry = await contribute();
  assert.equal(retry.status, 200);
  assert.equal((await retry.json()).redirectUrl, 'https://auth.example/authorize');
  assert.equal(incomingCalls, 2);
  assert.equal(grantCalls, 4, 'cada intento ejecuta solo los grants necesarios');
  assert.deepEqual(db.prepare('SELECT id,status FROM contributions ORDER BY id').all(), [{ id: 1, status: 'failed' }, { id: 2, status: 'pending' }]);
  console.log('RED/REINTENTO OK: mensaje español, POST sin replay, failed sin estado pendiente y reintento manual válido.');
  db.close();
  rmSync(dir, { recursive: true });
  process.exit(0);
} catch (error) {
  console.error(error);
  rmSync(dir, { recursive: true, force: true });
  process.exit(1);
}
