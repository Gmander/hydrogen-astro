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
    const libraryIntent={operationId:randomUUID(),exercise:{name:'Restart fixture'}};
    const libraryFirst=await createOperations(store)(who,'create_exercise',libraryIntent);
    store.close(); store = openLocalStore(path); await seedSamples(store);
    const retry = await createOperations(store)(who, 'create_workout', args);
    assert.equal(retry.replayed, true); assert.deepEqual(retry.workout, first.workout);
    assert.deepEqual((await createOperations(store)(who,'get_exercise',{id:libraryFirst.id})),libraryFirst.exercise);
    assert.equal((await createOperations(store)(who,'create_exercise',libraryIntent)).replayed,true);
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


test('private exercise search, duplicate aliases, revisions, scope and receipt isolation', async t => {
 const {call,store}=await fixture(t);
 const before=await store.get('accounts/sample-alex');
 assert.equal((await call('search_exercises')).data.total,0);
 assert.deepEqual(await store.get('accounts/sample-alex'),before);
 const args={operationId:randomUUID(),exercise:{name:'Dumbbell row',aliases:['DB row'],equipment:['Dumbbell'],muscles:['Back'],instructions:'Synthetic form guidance.'}};
 const receipt=(await call('create_exercise',args,{mcp:true})).data.result.structuredContent;
 assert.equal(receipt.revision,1);
 assert.equal((await call('create_exercise',args)).data.replayed,true);
 const found=(await call('search_exercises',{query:' db ROW ',limit:1})).data;
 assert.equal(found.total,1);assert.equal(found.exercises[0].id,receipt.id);assert.equal(found.exercises[0].images,undefined);
 assert.equal((await call('create_exercise',{operationId:randomUUID(),exercise:{name:' DB  ROW '}})).data.code,'exercise_exists');
 assert.equal((await call('get_exercise',{id:receipt.id},{user:'b'})).status,404);
 assert.equal((await call('update_exercise',{id:receipt.id,expectedRevision:1,operationId:randomUUID(),exercise:args.exercise},{user:'b'})).status,404);
 assert.equal((await call('create_exercise',args,{token:await credential('sample-a',{scope:'read:training'})})).status,403);
 const other=(await call('create_exercise',args,{user:'b'})).data;assert.notEqual(other.id,receipt.id);assert.equal(other.replayed,undefined);
 const update={id:receipt.id,expectedRevision:1,operationId:randomUUID(),exercise:{...args.exercise,instructions:'Updated synthetic guidance.'}};
 const concurrent=await Promise.all([call('update_exercise',update),call('update_exercise',{...update,operationId:randomUUID()})]);
 assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
 assert.equal((await call('update_exercise',update)).data.replayed,true);
 const member=await store.get(identityKey('sample-a'));await store.put(identityKey('sample-a'),{...member.data,active:false},member.etag);
 assert.equal((await call('create_exercise',args)).status,403);
});

test('library snapshots and workout-specific notes survive edits, sessions and old clients', async t => {
 const {call}=await fixture(t);
 const first=(await call('create_exercise',{operationId:randomUUID(),exercise:{name:'Sample row',instructions:'Original guidance'}})).data;
 const exercise={name:'Sample row',exerciseId:first.id,exerciseRevision:1,notes:'Slow and controlled for this workout.',sets:sampleWorkout.exercises[0].sets};
 const plan=(await call('create_workout',{operationId:randomUUID(),workout:{...sampleWorkout,exercises:[exercise]}})).data.workout;
 assert.equal(plan.exercises[0].guidance.instructions,'Original guidance');
 await call('update_exercise',{id:first.id,expectedRevision:1,operationId:randomUUID(),exercise:{name:'Sample row',instructions:'New guidance'}});
 assert.deepEqual((await call('get_workout',{id:plan.id})).data,plan);
 const {createSession,finishSet,completedWorkout}=await import('../ui/session.js');
 const session=createSession(plan,'2026-11-27');finishSet(session,session.queue[0].target,Date.now());
 const completed=completedWorkout(session);assert.equal(completed.exercises[0].notes,exercise.notes);
 const saved=(await call('create_workout',{operationId:randomUUID(),workout:completed}));assert.equal(saved.status,200);assert.equal(saved.data.workout.exercises[0].guidance.revision,1);
 const forged=structuredClone(completed);forged.exercises[0].guidance.instructions='Forged';
 assert.equal((await call('create_workout',{operationId:randomUUID(),workout:forged})).data.code,'guidance_conflict');
 assert.equal((await call('create_workout',{operationId:randomUUID(),workout:{...sampleWorkout,exercises:[exercise]}})).data.code,'revision_conflict');
 assert.equal((await call('create_workout',{operationId:randomUUID(),workout:{...sampleWorkout,exercises:[{...exercise,exerciseRevision:2}]}},{user:'b'})).status,404);
 assert.equal((await call('create_workout',{operationId:randomUUID(),workout:sampleWorkout})).status,200);
});

test('captioned raster media validation, pagination and MCP discovery are bounded', async t => {
 const {call,handler,tokens}=await fixture(t);
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const created=(await call('create_exercise',{operationId:randomUUID(),exercise:{name:'Sample image',images:[{dataUrl:png,caption:'Synthetic pixel fixture',source:'Test'}]}})).data;
 assert.equal((await call('get_exercise',{id:created.id})).data.images[0].dataUrl,png);
 for(const dataUrl of ['javascript:alert(1)','https://example.com/private.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/png;base64,YWJj',png+'A'.repeat(24000)]) {
  assert.equal((await call('create_exercise',{operationId:randomUUID(),exercise:{name:'Invalid',images:[{dataUrl,caption:'Test'}]}})).status,400);
 }
 await call('create_exercise',{operationId:randomUUID(),exercise:{name:'Another sample'}});
 const page=(await call('search_exercises',{limit:1})).data;assert.equal(page.nextOffset,1);
 const second=(await call('search_exercises',{limit:1,offset:page.nextOffset})).data;assert.equal(second.nextOffset,null);assert.notEqual(page.exercises[0].id,second.exercises[0].id);
 const response=await handler(new Request(origin+'/api/training/mcp',{method:'POST',headers:{authorization:tokens.a,'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}));
 const metadata=(await response.json()).result.tools;assert.equal(metadata.length,10);
 assert.deepEqual(metadata.find(t=>t.name==='search_exercises').inputSchema.required,[]);
 assert.equal(metadata.find(t=>t.name==='create_exercise').annotations.readOnlyHint,false);
 assert.ok(metadata.find(t=>t.name==='create_workout').inputSchema.properties.workout.properties.exercises.items.properties.guidance);
});
