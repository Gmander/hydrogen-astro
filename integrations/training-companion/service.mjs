import { createHash, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { schemas, descriptions } from './schemas.mjs';

export const issuer = 'https://dev-vv5cabcc1j2q74v6.us.auth0.com/';
export const audience = 'https://runtimeready.com/api/training/mcp';
export const metadataPath = '/.well-known/oauth-protected-resource/api/training/mcp';
export const scopes = ['read:training', 'write:training'];
export class AppError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const fail = (status, code, message) => { throw new AppError(status, code, message); };
export const identityKey = sub => 'members/' + createHash('sha256').update(JSON.stringify([issuer, sub])).digest('hex');
const canonical = value => JSON.stringify(value, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map(k => [k, x[k]])) : x);

export function createVerifier({ key = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer)) } = {}) {
  return async authorization => {
    if (!/^Bearer \S+$/i.test(authorization ?? '')) fail(401, 'unauthenticated', 'Sign in to your training space.');
    let claims;
    try { ({ payload: claims } = await jwtVerify(authorization.slice(7), key, {
      issuer, audience, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'], clockTolerance: 5,
    })); } catch { fail(401, 'unauthenticated', 'Your sign-in expired. Sign in again; your draft is still on this device.'); }
    if (typeof claims.sub !== 'string' || !claims.sub || claims.sub.endsWith('@clients')) fail(403, 'forbidden', 'A personal account is required.');
    const permissions = new Set(typeof claims.scope === 'string' ? claims.scope.split(' ') : []);
    if (!permissions.has(scopes[0])) fail(403, 'insufficient_scope', 'This connection does not have workout read access.');
    return { sub: claims.sub, permissions };
  };
}
export function createAuthenticator(store, options = {}) {
  const verify = createVerifier(options);
  return async authorization => {
    const { sub, permissions } = await verify(authorization);
    const member = (await store.get(identityKey(sub)))?.data;
    if (member?.active !== true || !/^[a-zA-Z0-9_-]{1,80}$/.test(member.athleteId ?? '')) fail(403, 'not_a_member', 'This account has not been added to the training preview.');
    return { athleteId: member.athleteId, permissions };
  };
}

// Explicit, invited-user activation. No storage changes occur during reads/sign-in.
export function createActivation(store, { verify = createVerifier(), invited = () => [] } = {}) {
  return async authorization => {
    const identity = await verify(authorization);
    if (!identity.permissions.has(scopes[1])) fail(403, 'insufficient_scope', 'Workout write access is required to create your space.');
    if (!invited().includes(identity.sub)) fail(403, 'not_invited', 'This account has not been invited to the RR test.');
    const key = identityKey(identity.sub);
    const existing = await store.get(key);
    if (existing) {
      if (!existing.data.active) fail(403, 'not_a_member', 'Access to this account has been removed.');
      return { activated: true, athleteId: existing.data.athleteId };
    }
    const athleteId = 'athlete-' + key.slice('members/'.length);
    // Account is written first: failure can leave an inaccessible empty object, never a member with missing data.
    await store.put('accounts/' + athleteId, { profile: { name: 'My training space', equipment: [], synthetic: true }, workouts: {}, operations: {} }, null);
    await store.put(key, { athleteId, active: true }, null);
    const member = (await store.get(key))?.data;
    if (member?.active !== true || member.athleteId !== athleteId) fail(403, 'not_a_member', 'Account activation was interrupted.');
    return { activated: true, athleteId };
  };
}

export function createOperations(store) {
  return async (identity, name, input) => {
    if (!Object.hasOwn(schemas, name)) fail(404, 'unknown_operation', 'Unknown workout operation.');
    const write = ['create_workout', 'update_workout', 'delete_workout'].includes(name);
    if (!identity.permissions.has(scopes[0]) || write && !identity.permissions.has(scopes[1])) fail(403, 'insufficient_scope', 'This connection does not have permission for that operation.');
    const parsed = schemas[name].safeParse(input);
    if (!parsed.success) fail(400, 'invalid_arguments', 'Check workout fields, dates, units and revision before saving.');
    const args = parsed.data, request = canonical({ name, args }), key = 'accounts/' + identity.athleteId;
    for (let attempt = 0; attempt < 8; attempt++) {
      const current = await store.get(key);
      if (!current) fail(403, 'account_not_ready', 'Your training account is awaiting setup.');
      const state = current.data;
      const get = id => {
        if (!Object.hasOwn(state.workouts, id)) fail(404, 'not_found', 'Workout not found.');
        return state.workouts[id];
      };
      if (name === 'get_profile') return { ...state.profile, athleteId: identity.athleteId };
      if (name === 'list_workouts') {
        const rows = Object.values(state.workouts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id));
        return { workouts: rows.slice(0, 100), total: rows.length, truncated: rows.length > 100 };
      }
      if (name === 'get_workout') return get(args.id);
      const prior = state.operations[args.operationId];
      if (prior) {
        if (prior.request !== request) fail(409, 'operation_id_conflict', 'This save ID was already used for a different change.');
        return { ...prior.receipt, replayed: true };
      }
      const id = args.id ?? randomUUID();
      let revision = 1;
      if (name !== 'create_workout') {
        const existing = get(id);
        if (existing.revision !== args.expectedRevision) fail(409, 'revision_conflict', 'This workout changed elsewhere. Reload it before editing.');
        revision = existing.revision + 1;
      }
      const savedAt = new Date().toISOString();
      if (name === 'delete_workout') delete state.workouts[id];
      else state.workouts[id] = { id, revision, ...args.workout, updatedAt: savedAt };
      const receipt = { operationId: args.operationId, action: name, id, revision, savedAt,
        ...(name === 'delete_workout' ? { deleted: true } : { workout: state.workouts[id] }) };
      state.operations[args.operationId] = { request, receipt };
      if (Buffer.byteLength(JSON.stringify(state)) > 1_000_000) fail(413, 'account_limit', 'This preview account is full. Existing records are safe; export before adding more.');
      if (await store.put(key, state, current.etag)) return receipt;
    }
    fail(409, 'concurrent_write', 'Another change is being saved. Retry this same save request.');
  };
}

// These match the strict shared schemas; no athlete or ownership arguments are exposed.
const setSchema = { type: 'object', additionalProperties: false, properties: {
  reps: { type: ['integer', 'null'], minimum: 0, maximum: 10000 },
  seconds: { type: ['number', 'null'], minimum: 0, maximum: 86400 },
  load: { type: ['number', 'null'], minimum: 0, maximum: 10000 },
  unit: { type: ['string', 'null'], enum: ['lb', 'kg', null] },
  loadMeaning: { type: 'string', enum: ['per_hand', 'total', 'bodyweight', 'assistance', 'unspecified'] },
  side: { type: 'string', enum: ['both', 'left', 'right', 'per_side', 'unspecified'] },
} };
const workoutSchema = { type: 'object', additionalProperties: false, required: ['title', 'date', 'status', 'exercises'], properties: {
  title: { type: 'string', minLength: 1, maxLength: 160 }, date: { type: 'string', format: 'date' },
  status: { type: 'string', enum: ['planned', 'completed'] }, notes: { type: 'string', maxLength: 3000 },
  exercises: { type: 'array', minItems: 1, maxItems: 50, items: { type: 'object', additionalProperties: false, required: ['name', 'sets'], properties: {
    name: { type: 'string', minLength: 1, maxLength: 160 }, sets: { type: 'array', maxItems: 100, items: setSchema },
  } } },
} };
export const tools = Object.keys(schemas).map(name => {
  const write = ['create_workout', 'update_workout', 'delete_workout'].includes(name);
  const properties = {};
  if (['get_workout', 'update_workout', 'delete_workout'].includes(name)) properties.id = { type: 'string', format: 'uuid' };
  if (write) properties.operationId = { type: 'string', format: 'uuid' };
  if (['update_workout', 'delete_workout'].includes(name)) properties.expectedRevision = { type: 'integer', minimum: 1 };
  if (['create_workout', 'update_workout'].includes(name)) properties.workout = workoutSchema;
  return { name, description: descriptions[name], inputSchema: { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) },
    annotations: { readOnlyHint: !write, destructiveHint: name === 'delete_workout', idempotentHint: true, openWorldHint: false },
    securitySchemes: [{ type: 'oauth2', scopes: write ? scopes : scopes.slice(0, 1) }] };
});
