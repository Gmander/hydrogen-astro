import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createAuthenticator, createService, createHandler, ownerKey, issuer, resource, metadataPath } from './service.mjs';

const pair = await generateKeyPair('RS256');
const outsider = await generateKeyPair('RS256');
async function token({ sub = 'user-a', aud = resource, iss = issuer, scope = 'read:proof write:proof', exp = '5m', key = pair.privateKey } = {}) {
  return 'Bearer ' + await new SignJWT({ scope }).setProtectedHeader({ alg: 'RS256' }).setSubject(sub).setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp).sign(key);
}
function memoryStore() {
  const rows = new Map(); let seq = 0;
  return {
    rows,
    async get(key) { return structuredClone(rows.get(key) ?? null); },
    async put(key, data, etag) {
      if ((rows.get(key)?.etag ?? null) !== etag) return false;
      rows.set(key, { data: structuredClone(data), etag: String(++seq) }); return true;
    },
  };
}
const identity = sub => ({ owner: ownerKey(sub), scopes: new Set(['read:proof', 'write:proof']) });
const createArgs = value => ({ operationId: randomUUID(), value });

test('JWT rejects missing, tampered, expired, wrong issuer/audience, missing scope, nonmember and machine identity', async () => {
  const auth = createAuthenticator({ key: pair.publicKey, members: () => ['user-a', 'm2m@clients'] });
  for (const value of [null, 'Bearer junk', await token({ key: outsider.privateKey }), await token({ exp: '0s' }).then(async t => {
    // Explicit past expiry avoids relying on clock tolerance or sleeps.
    return 'Bearer ' + await new SignJWT({ scope: 'read:proof' }).setProtectedHeader({ alg: 'RS256' }).setSubject('user-a').setIssuer(issuer).setAudience(resource).setIssuedAt().setExpirationTime(Math.floor(Date.now()/1000)-60).sign(pair.privateKey);
  }), await token({ aud: 'other' }), await token({ iss: 'https://other.example/' }), await token({ scope: 'write:proof' }), await token({ sub: 'user-b' }), await token({ sub: 'm2m@clients' })]) {
    await assert.rejects(auth(value));
  }
  assert.equal((await auth(await token())).owner, ownerKey('user-a'));
});
test('membership revocation takes effect on next call with the same still-valid token', async () => {
  let members = ['user-a']; const auth = createAuthenticator({ key: pair.publicKey, members: () => members });
  const credential = await token(); await auth(credential); members = [];
  await assert.rejects(auth(credential), /not_a_member/);
});
test('read has no side effect, owner isolation, no owner override, and read-only scope enforcement', async () => {
  const store = memoryStore(); const run = createService(store);
  assert.deepEqual(await run(identity('a'), 'get_private_test_record', {}), { record: null, synthetic: true });
  assert.equal(store.rows.size, 0);
  await run(identity('a'), 'create_private_test_record', createArgs(10));
  assert.equal((await run(identity('b'), 'get_private_test_record', {})).record, null);
  await assert.rejects(run(identity('a'), 'get_private_test_record', { owner: 'b' }), /invalid_arguments/);
  await assert.rejects(run({ ...identity('a'), scopes: new Set(['read:proof']) }, 'update_private_test_record', { ...createArgs(3), expectedRevision: 1 }), /insufficient_scope/);
});
test('receipt replay, changed-intent rejection and stale revision denial', async () => {
  const run = createService(memoryStore()); const a = identity('a'); const args = createArgs(8);
  const first = await run(a, 'create_private_test_record', args);
  const retry = await run(a, 'create_private_test_record', args);
  assert.equal(retry.replayed, true); assert.deepEqual(retry.record, first.record);
  await assert.rejects(run(a, 'create_private_test_record', { ...args, value: 9 }), /operation_id_conflict/);
  const updated = await run(a, 'update_private_test_record', { ...createArgs(3), expectedRevision: 1 });
  assert.equal(updated.record.revision, 2);
  await assert.rejects(run(a, 'update_private_test_record', { ...createArgs(6), expectedRevision: 1 }), /revision_conflict/);
});
test('simultaneous creates and updates yield exactly one winning mutation', async () => {
  const store = memoryStore(); const run = createService(store); const a = identity('a');
  const creates = await Promise.allSettled([run(a, 'create_private_test_record', createArgs(5)), run(a, 'create_private_test_record', createArgs(6))]);
  assert.equal(creates.filter(r => r.status === 'fulfilled').length, 1);
  const updates = await Promise.allSettled([run(a, 'update_private_test_record', { ...createArgs(7), expectedRevision: 1 }), run(a, 'update_private_test_record', { ...createArgs(8), expectedRevision: 1 })]);
  assert.equal(updates.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await run(a, 'get_private_test_record', {})).record.revision, 2);
  assert.equal(Object.keys((await store.get(a.owner)).data.receipts).length, 2);
});
test('same-operation concurrent retries share a single receipt', async () => {
  const store = memoryStore(); const run = createService(store); const args = createArgs(4);
  const results = await Promise.all([run(identity('a'), 'create_private_test_record', args), run(identity('a'), 'create_private_test_record', args)]);
  assert.deepEqual(results[0].record, results[1].record);
  assert.equal(results.filter(r => r.replayed).length, 1);
});
test('invalid fields and values are rejected before storage', async () => {
  const run = createService({ get() { throw new Error('should not reach storage'); } });
  for (const args of [{ ...createArgs(-1) }, createArgs(101), createArgs(1.1), { value: 1, operationId: 'bad' }, { ...createArgs(4), user: 'other' }]) await assert.rejects(run(identity('a'), 'create_private_test_record', args), /invalid_arguments/);
});
test('bounded proof receipts never evict earlier operation identities', async () => {
  const run = createService(memoryStore()); const a = identity('a'); const first = createArgs(1);
  await run(a, 'create_private_test_record', first);
  for (let revision=1; revision<100; revision++) await run(a, 'update_private_test_record', { ...createArgs(2), expectedRevision: revision });
  await assert.rejects(run(a, 'update_private_test_record', { ...createArgs(3), expectedRevision: 100 }), /proof_intent_limit/);
  assert.equal((await run(a, 'create_private_test_record', first)).replayed, true);
});
test('HTTP metadata is public, calls are protected, auth denial never reaches storage', async () => {
  const handler = createHandler({ authenticate: createAuthenticator({ key: pair.publicKey, members: () => ['user-a'] }), run() { throw new Error('must not run'); } });
  const metadata = await handler(new Request('https://runtimeready.com' + metadataPath));
  assert.equal(metadata.status, 200); assert.equal((await metadata.json()).resource, resource);
  const denied = await handler(new Request(resource, { method: 'POST', body: '{}' }));
  assert.equal(denied.status, 401); assert.match(denied.headers.get('WWW-Authenticate'), /resource_metadata=/);
  const list = await handler(new Request(resource, { method: 'POST', headers: { authorization: await token(), 'content-type': 'application/json' }, body: JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'}) }));
  assert.equal((await list.json()).result.tools.length, 3);
});
