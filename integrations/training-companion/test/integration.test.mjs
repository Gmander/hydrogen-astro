import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPair, SignJWT } from 'jose';
import { openLocalStore } from '../local-store.mjs';
import { seedSamples, sampleWorkout } from '../fixtures.mjs';
import { createAuthenticator, createOperations, createActivation, createVerifier, identityKey, issuer, audience, scopes } from '../service.mjs';
import { createHandler } from '../http.mjs';

const origin = 'http://127.0.0.1:8810';
const keys = await generateKeyPair('RS256');
async function credential(sub = 'sample-a', overrides = {}) {
  return 'Bearer ' + await new SignJWT({ scope: scopes.join(' '), ...overrides })
    .setProtectedHeader({ alg: 'RS256' }).setIssuer(issuer).setAudience(overrides.aud ?? audience)
    .setSubject(sub).setIssuedAt().setExpirationTime(overrides.exp ?? '5m').sign(keys.privateKey);
}
async function fixture(t) {
  const store = openLocalStore(':memory:'); t.after(() => store.close()); await seedSamples(store);
  const run = createOperations(store), authenticate = createAuthenticator(store, { key: keys.publicKey });
  const handler = createHandler({ run, authenticate, origin });
  const tokens = { a: await credential(), b: await credential('sample-b') };
  const call = async (name, args = {}, { user = 'a', mcp = false, token = tokens[user], requestOrigin = origin, athlete = user === 'a' ? 'sample-alex' : 'sample-sam' } = {}) => {
    const response = await handler(new Request(origin + (mcp ? '/api/training/mcp' : '/api/training/operation'), {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: token, ...(requestOrigin ? { origin: requestOrigin } : {}), 'x-training-athlete': athlete },
      body: JSON.stringify(mcp ? { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } } : { name, arguments: args }),
    }));
    return { status: response.status, data: await response.json() };
  };
  return { store, run, authenticate, handler, call, tokens };
}

test('browser creates a plan; MCP reads/corrects it; UI reads exact change and preserved unknowns', async t => {
  const { call } = await fixture(t);
  const intent = { operationId: randomUUID(), workout: sampleWorkout };
  const first = await call('create_workout', intent);
  assert.equal(first.status, 200); assert.equal(first.data.workout.status, 'planned');
  const read = await call('get_workout', { id: first.data.id }, { mcp: true, requestOrigin: null });
  assert.deepEqual(read.data.result.structuredContent, first.data.workout);
  const workout = structuredClone(sampleWorkout); workout.exercises[0].sets[0].seconds = 25;
  const corrected = await call('update_workout', { id: first.data.id, operationId: randomUUID(), expectedRevision: 1, workout }, { mcp: true });
  assert.equal(corrected.data.result.structuredContent.revision, 2);
  const after = (await call('get_workout', { id: first.data.id })).data;
  assert.equal(after.exercises[0].sets[0].seconds, 25);
  assert.equal(after.exercises[0].sets[0].reps, null);
  assert.deepEqual(after.exercises[1], sampleWorkout.exercises[1]);
  assert.equal(after.date, sampleWorkout.date);
});

test('two athletes cannot read/update/delete each other, override ownership, or replay each other’s receipt', async t => {
  const { call } = await fixture(t);
  const operationId = randomUUID();
  const a = (await call('create_workout', { operationId, workout: sampleWorkout })).data;
  for (const [name, args] of [
    ['get_workout', { id: a.id }],
    ['update_workout', { id: a.id, operationId: randomUUID(), expectedRevision: 1, workout: sampleWorkout }],
    ['delete_workout', { id: a.id, operationId: randomUUID(), expectedRevision: 1 }],
  ]) assert.equal((await call(name, args, { user: 'b' })).status, 404);
  assert.equal((await call('get_profile', { athleteId: 'sample-alex' }, { user: 'b' })).status, 400);
  const b = (await call('create_workout', { operationId, workout: sampleWorkout }, { user: 'b' })).data;
  assert.notEqual(a.id, b.id); assert.equal(b.replayed, undefined);
  assert.equal((await call('get_workout', { id: a.id })).data.revision, 1);
  assert.equal((await call('create_workout', { operationId: randomUUID(), workout: sampleWorkout }, { user: 'b', athlete: 'sample-alex' })).data.code, 'account_changed');
});

test('revocation denies existing tokens including retries; read-only token cannot mutate', async t => {
  const { call, store } = await fixture(t);
  const args = { operationId: randomUUID(), workout: sampleWorkout };
  await call('create_workout', args);
  const before = await store.get('accounts/sample-alex');
  const member = await store.get(identityKey('sample-a'));
  await store.put(identityKey('sample-a'), { ...member.data, active: false }, member.etag);
  for (const [name, input] of [['get_profile', {}], ['create_workout', args]]) assert.equal((await call(name, input)).data.code, 'not_a_member');
  assert.deepEqual(await store.get('accounts/sample-alex'), before);
  assert.equal((await call('get_profile', {}, { user: 'b' })).status, 200);
  assert.equal((await call('create_workout', args, { user: 'b', token: await credential('sample-b', { scope: 'read:training' }) })).status, 403);
});

test('missing, expired, proof-audience, nonmember and Sites-header requests fail closed; reads create nothing', async t => {
  const { call, handler, store } = await fixture(t);
  const before = store.db.prepare('SELECT count(*) AS n FROM objects').get().n;
  for (const token of ['', 'Bearer invalid', await credential('sample-a', { exp: 1 }), await credential('sample-a', { aud: 'https://runtimeready.com/api/rr-auth-proof' })]) assert.equal((await call('get_profile', {}, { token })).status, 401);
  assert.equal((await call('get_profile', {}, { token: await credential('outsider') })).status, 403);
  const response = await handler(new Request(origin + '/api/training/mcp', { headers: { 'oai-authenticated-user-id': 'sample-alex' } }));
  assert.equal(response.status, 401); assert.match(response.headers.get('www-authenticate'), /oauth-protected-resource/);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM objects').get().n, before);
});

test('retry/conflict, concurrent updates, deletion retry and late create replay remain atomic', async t => {
  const { call } = await fixture(t);
  const args = { operationId: randomUUID(), workout: sampleWorkout };
  const created = (await call('create_workout', args)).data;
  assert.equal((await call('create_workout', args)).data.replayed, true);
  assert.equal((await call('create_workout', { ...args, workout: { ...sampleWorkout, title: 'Different intent' } })).status, 409);
  const updates = await Promise.all([10, 20].map(seconds => call('update_workout', { id: created.id, operationId: randomUUID(), expectedRevision: 1,
    workout: { ...sampleWorkout, notes: String(seconds) } })));
  assert.deepEqual(updates.map(r => r.status).sort(), [200, 409]);
  const deletion = { id: created.id, operationId: randomUUID(), expectedRevision: 2 };
  assert.equal((await call('delete_workout', deletion)).data.deleted, true);
  assert.equal((await call('delete_workout', deletion)).data.replayed, true);
  assert.equal((await call('create_workout', args)).data.replayed, true);
  assert.equal((await call('get_workout', { id: created.id })).status, 404);
});

test('validation, request bound, same-origin boundary and metadata', async t => {
  const { call, handler } = await fixture(t);
  assert.equal((await call('create_workout', { operationId: randomUUID(), workout: { ...sampleWorkout, date: '2026-02-30' } })).status, 400);
  assert.equal((await call('get_profile', {}, { requestOrigin: 'https://evil.example' })).status, 403);
  assert.equal((await call('get_profile', {}, { requestOrigin: null })).status, 403);
  const metadata = await handler(new Request(origin + '/.well-known/oauth-protected-resource/api/training/mcp'));
  assert.equal((await metadata.json()).resource, audience);
  const oversized = await handler(new Request(origin + '/api/training/mcp', { method: 'POST', headers: { authorization: await credential(), 'content-type': 'application/json' }, body: ' '.repeat(150001) }));
  assert.equal(oversized.status, 413);
});

test('SQLite restart preserves records and receipts; seed never overwrites data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'rr-training-test-'));
  let store;
  try {
    const path = join(dir, 'test.sqlite'); store = openLocalStore(path); await seedSamples(store);
    const who = { athleteId: 'sample-alex', permissions: new Set(scopes) };
    const args = { operationId: randomUUID(), workout: sampleWorkout };
    const first = await createOperations(store)(who, 'create_workout', args);
    store.close(); store = openLocalStore(path); await seedSamples(store);
    const retry = await createOperations(store)(who, 'create_workout', args);
    assert.equal(retry.replayed, true); assert.deepEqual(retry.workout, first.workout);
  } finally { store?.close(); await rm(dir, { recursive: true, force: true }); }
});

test('activation is explicit, invite-only, retry-safe and cannot revive a revoked membership', async t => {
  const store = openLocalStore(':memory:'); t.after(() => store.close());
  const verify = createVerifier({ key: keys.publicKey });
  const activate = createActivation(store, { verify, invited: () => ['new-athlete'] });
  const auth = createAuthenticator(store, { key: keys.publicKey });
  const token = await credential('new-athlete');
  await assert.rejects(auth(token), e => e.code === 'not_a_member');
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM objects').get().n, 0);
  await assert.rejects(activate(await credential('outsider')), e => e.code === 'not_invited');
  await assert.rejects(activate(await credential('new-athlete', { scope: 'read:training' })), e => e.code === 'insufficient_scope');
  const results = await Promise.all([activate(token), activate(token)]);
  assert.deepEqual(results[0], results[1]);
  assert.equal(store.db.prepare('SELECT count(*) AS n FROM objects').get().n, 2);
  const identity = await auth(token);
  const saved = await createOperations(store)(identity, 'create_workout', { operationId: randomUUID(), workout: sampleWorkout });
  await activate(token);
  assert.equal((await createOperations(store)(identity, 'get_workout', { id: saved.id })).revision, 1);
  const member = await store.get(identityKey('new-athlete'));
  await store.put(identityKey('new-athlete'), { ...member.data, active: false }, member.etag);
  await assert.rejects(activate(token), e => e.code === 'not_a_member');
});
