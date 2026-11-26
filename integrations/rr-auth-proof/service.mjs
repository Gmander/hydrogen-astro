import { createHash, randomUUID } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const issuer = 'https://dev-vv5cabcc1j2q74v6.us.auth0.com/';
export const resource = 'https://runtimeready.com/api/rr-auth-proof';
export const metadataPath = '/.well-known/oauth-protected-resource/api/rr-auth-proof';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class ProofError extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function ownerKey(sub) {
  return createHash('sha256').update(JSON.stringify([issuer, sub])).digest('hex');
}
export function createAuthenticator({ key = createRemoteJWKSet(new URL('.well-known/jwks.json', issuer)), members = () => [] } = {}) {
  return async authorization => {
    if (!/^Bearer \S+$/i.test(authorization ?? '')) throw new ProofError('unauthenticated', 401);
    let payload;
    try {
      ({ payload } = await jwtVerify(authorization.slice(7), key, {
        issuer, audience: resource, algorithms: ['RS256'], requiredClaims: ['exp', 'iat', 'sub'], clockTolerance: 5,
      }));
    } catch { throw new ProofError('unauthenticated', 401); }
    if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.endsWith('@clients')) throw new ProofError('forbidden', 403);
    if (!members().includes(payload.sub)) throw new ProofError('not_a_member', 403);
    const scopes = new Set(typeof payload.scope === 'string' ? payload.scope.split(' ') : []);
    if (!scopes.has('read:proof')) throw new ProofError('insufficient_scope', 403);
    return { owner: ownerKey(payload.sub), scopes };
  };
}
const names = ['get_private_test_record', 'create_private_test_record', 'update_private_test_record'];
export const tools = names.map((name, index) => ({
  name,
  description: index === 0 ? 'Read your isolated synthetic RR proof record. Does not create anything. No workout or family data.' : `${index === 1 ? 'Create' : 'Update'} your synthetic RR test record. Only value is writable (integer 0–100). Use a UUID operationId per intent; reuse it after uncertain outcomes. Read before updating and supply expectedRevision. No workout or family data.`,
  inputSchema: { type: 'object', additionalProperties: false,
    properties: index === 0 ? {} : { value: { type: 'integer', minimum: 0, maximum: 100 }, operationId: { type: 'string', format: 'uuid' }, ...(index === 2 ? { expectedRevision: { type: 'integer', minimum: 1 } } : {}) },
    required: index === 0 ? [] : ['value', 'operationId', ...(index === 2 ? ['expectedRevision'] : [])],
  },
  annotations: { readOnlyHint: index === 0, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  securitySchemes: [{ type: 'oauth2', scopes: index === 0 ? ['read:proof'] : ['read:proof', 'write:proof'] }],
}));

// Store contract: get(key) -> {data,etag}|null; put(key,data,etag|null) -> boolean.
// Record and receipt live in ONE conditional write. Never evict receipts: fail closed
// at 100 intents so a late retry cannot become a new write after receipt eviction.
export function createService(store, { now = () => new Date().toISOString() } = {}) {
  return async (identity, name, args) => {
    const index = names.indexOf(name);
    if (index < 0) throw new ProofError('unknown_tool');
    if (!identity.scopes.has('read:proof') || (index && !identity.scopes.has('write:proof'))) throw new ProofError('insufficient_scope', 403);
    const allowed = index === 0 ? [] : ['value', 'operationId', ...(index === 2 ? ['expectedRevision'] : [])];
    if (!args || Array.isArray(args) || typeof args !== 'object' || Object.keys(args).some(k => !allowed.includes(k)) || allowed.some(k => !Object.hasOwn(args, k))) throw new ProofError('invalid_arguments');
    if (index && (!Number.isInteger(args.value) || args.value < 0 || args.value > 100 || typeof args.operationId !== 'string' || !uuid.test(args.operationId))) throw new ProofError('invalid_arguments');
    if (index === 2 && (!Number.isSafeInteger(args.expectedRevision) || args.expectedRevision < 1)) throw new ProofError('invalid_arguments');
    const key = identity.owner;
    const fingerprint = JSON.stringify([name, args.value, args.expectedRevision ?? null]);
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await store.get(key);
      const data = current?.data ?? { record: null, receipts: {} };
      if (!index) return { record: data.record, synthetic: true };
      const prior = data.receipts[args.operationId];
      if (prior) {
        if (prior.fingerprint !== fingerprint) throw new ProofError('operation_id_conflict', 409);
        return { ...prior.result, replayed: true };
      }
      if (Object.keys(data.receipts).length >= 100) throw new ProofError('proof_intent_limit', 409);
      if (index === 1 && data.record) throw new ProofError('already_exists', 409);
      if (index === 2 && !data.record) throw new ProofError('not_found', 404);
      if (index === 2 && data.record.revision !== args.expectedRevision) throw new ProofError('revision_conflict', 409);
      const savedAt = now();
      const record = { id: data.record?.id ?? randomUUID(), title: 'Synthetic RR authentication proof', value: args.value, revision: (data.record?.revision ?? 0) + 1, createdAt: data.record?.createdAt ?? savedAt, updatedAt: savedAt };
      const result = { operationId: args.operationId, action: index === 1 ? 'create' : 'update', savedAt, record, replayed: false, synthetic: true };
      const next = { record, receipts: { ...data.receipts, [args.operationId]: { fingerprint, result } } };
      if (await store.put(key, next, current?.etag ?? null)) return result;
    }
    throw new ProofError('concurrent_write_retry_same_operation', 409);
  };
}

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } });
}
export function createHandler({ authenticate, run }) {
  return async request => {
    const path = new URL(request.url).pathname;
    if (path === metadataPath && request.method === 'GET') return json({ resource, authorization_servers: [issuer], scopes_supported: ['read:proof', 'write:proof'], bearer_methods_supported: ['header'], resource_name: 'RR isolated authentication proof' });
    if (path !== new URL(resource).pathname) return json({ error: 'not_found' }, 404);
    let identity;
    try { identity = await authenticate(request.headers.get('authorization')); }
    catch (error) {
      const status = error instanceof ProofError ? error.status : 503;
      return json({ error: error instanceof ProofError ? error.code : 'unavailable' }, status, status === 401 || status === 403 ? { 'WWW-Authenticate': `Bearer resource_metadata="https://runtimeready.com${metadataPath}"${status === 403 ? ', error="insufficient_scope", scope="read:proof write:proof"' : ''}` } : {});
    }
    if (request.method !== 'POST') return json({ error: 'Use POST JSON-RPC' }, 405, { Allow: 'POST' });
    if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'json_required' }, 415);
    let body;
    try {
      const reader = request.body?.getReader(); let size = 0; const chunks = [];
      if (!reader) throw new Error();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        size += value.length;
        if (size > 8192) { await reader.cancel(); return json({ error: 'too_large' }, 413); }
        chunks.push(value);
      }
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch { return json({ error: 'invalid_json' }, 400); }
    if (!body || Array.isArray(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return json({ error: 'invalid_request' }, 400);
    if (body.id === undefined) return new Response(null, { status: 202 });
    const reply = result => json({ jsonrpc: '2.0', id: body.id, result });
    if (body.method === 'initialize') return reply({ protocolVersion: ['2025-11-25', '2025-06-18', '2025-03-26'].includes(body.params?.protocolVersion) ? body.params.protocolVersion : '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'rr-auth-proof', version: '0.1.0' }, instructions: 'Synthetic isolated proof only. No access to real workout or family data. Each signed-in pilot member owns a separate test record.' });
    if (body.method === 'ping') return reply({});
    if (body.method === 'tools/list') return reply({ tools });
    if (body.method === 'resources/list') return reply({ resources: [] });
    if (body.method === 'resources/templates/list') return reply({ resourceTemplates: [] });
    if (body.method === 'prompts/list') return reply({ prompts: [] });
    if (body.method !== 'tools/call') return json({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } });
    try {
      const result = await run(identity, body.params?.name, body.params?.arguments ?? {});
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
    } catch (error) {
      const result = { error: error instanceof ProofError ? error.code : 'unavailable' };
      return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: true });
    }
  };
}
