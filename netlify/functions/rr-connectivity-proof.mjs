import { randomUUID } from 'node:crypto';

// Public transport diagnostic only. No storage, credentials, outbound calls or app data.
export const config = { path: '/api/rr-connectivity-proof' };
const versions = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const challenges = ['gpt-phone', 'claude-phone', 'web-check'];
const tool = {
  name: 'rr_connectivity_probe',
  description: 'Test a direct connection to Runtime Ready. Returns a fresh server-generated receipt. Public diagnostic only: does not read or save workouts, family data, or any private records. Use gpt-phone or claude-phone only when the user is testing that phone app.',
  inputSchema: { type: 'object', properties: { challenge: { type: 'string', enum: challenges } }, required: ['challenge'], additionalProperties: false },
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  securitySchemes: [{ type: 'noauth' }],
};
function json(value, status = 200, extra = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
}
export default async function handler(request) {
  if (request.method === 'GET') return json({ name: 'RR connectivity proof', transport: 'Streamable HTTP; POST JSON-RPC', privateDataAccess: false, storage: false }, 405, { Allow: 'POST' });
  if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
  if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON required' }, 415);
  if (Number(request.headers.get('content-length')) > 4096) return json({ error: 'Too large' }, 413);
  let body;
  try {
    const reader = request.body?.getReader(); let size = 0; const chunks = [];
    if (!reader) throw new Error();
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 4096) { await reader.cancel(); return json({ error: 'Too large' }, 413); } chunks.push(value); }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Invalid JSON' } }, 400); }
  if (!body || Array.isArray(body) || body.jsonrpc !== '2.0' || typeof body.method !== 'string') return json({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid request' } }, 400);
  if (body.id === undefined) return new Response(null, { status: 202 });
  const reply = result => json({ jsonrpc: '2.0', id: body.id, result });
  const error = (code, message) => json({ jsonrpc: '2.0', id: body.id, error: { code, message } });
  if (body.method === 'initialize') return reply({ protocolVersion: versions.includes(body.params?.protocolVersion) ? body.params.protocolVersion : '2025-03-26', capabilities: { tools: {} }, serverInfo: { name: 'rr-connectivity-proof', version: '1.0.0' }, instructions: 'Transport-only diagnostic. A successful receipt does not prove authentication, storage, or workout CRUD.' });
  if (body.method === 'ping') return reply({});
  if (body.method === 'tools/list') return reply({ tools: [tool] });
  if (body.method === 'resources/list') return reply({ resources: [] });
  if (body.method === 'resources/templates/list') return reply({ resourceTemplates: [] });
  if (body.method === 'prompts/list') return reply({ prompts: [] });
  if (body.method !== 'tools/call') return error(-32601, 'Method not found');
  const args = body.params?.arguments;
  if (body.params?.name !== tool.name || !args || Object.keys(args).length !== 1 || !challenges.includes(args.challenge)) return error(-32602, 'Use rr_connectivity_probe with one allowed challenge');
  const result = { source: 'Runtime Ready / Netlify Function', proofVersion: '1.0.0', challenge: args.challenge, receiptId: randomUUID(), serverTime: new Date().toISOString(), sitesBridge: false, authenticated: false, persisted: false, privateDataAccess: false };
  return reply({ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result, isError: false });
}
