import http from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createAuthenticator, createOperations, issuer, audience, scopes } from './service.mjs';
import { createHandler, json } from './http.mjs';
import { openLocalStore } from './local-store.mjs';
import { accounts, seedSamples } from './fixtures.mjs';

const port = Number(process.env.PORT ?? 8810), origin = `http://127.0.0.1:${port}`;
await mkdir(new URL('./.local/', import.meta.url), { recursive: true });
const store = openLocalStore(new URL('./.local/preview.sqlite', import.meta.url));
await seedSamples(store);
const keys = await generateKeyPair('RS256');
const sessions = new Map();
const handler = createHandler({ authenticate: createAuthenticator(store, { key: keys.publicKey }), run: createOperations(store), origin, preview: true });
const assets = new Map([
  ['/training/', ['index.html', 'text/html']], ['/training/app.js', ['app.js', 'text/javascript']],
  ['/training/style.css', ['style.css', 'text/css']], ['/training/auth0-worker.js', ['auth0-worker.js', 'text/javascript']],
]);
const cookie = (value, age) => `rr_preview=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${age}`;
async function route(request) {
  const url = new URL(request.url);
  if (request.headers.get('host') !== new URL(origin).host) return json({ error: 'Host denied.' }, 403);
  if (request.headers.has('origin') && request.headers.get('origin') !== origin) return json({ error: 'Origin denied.' }, 403);
  if (url.pathname === '/' || url.pathname === '/training') return new Response(null, { status: 302, headers: { Location: '/training/' } });
  const asset = assets.get(url.pathname);
  if (asset && request.method === 'GET') return new Response(await readFile(new URL('./dist/public/training/' + asset[0], import.meta.url)), { headers: {
    'Content-Type': asset[1] + ';charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  } });
  const sessionId = request.headers.get('cookie')?.match(/(?:^|;\s*)rr_preview=([^;]+)/)?.[1];
  if (url.pathname === '/__preview/sign-in' && request.method === 'POST' && request.headers.get('origin') === origin) {
    let body; try { body = await request.json(); } catch { return json({ error: 'Invalid request.' }, 400); }
    if (!Object.hasOwn(accounts, body?.account ?? '')) return json({ error: 'Unknown sample.' }, 400);
    if (sessionId) sessions.delete(sessionId);
    const id = randomUUID(); sessions.set(id, { sub: body.account, expiresAt: Date.now() + 8 * 3600_000 });
    return json({ ok: true }, 200, { 'Set-Cookie': cookie(id, 28800) });
  }
  if (url.pathname === '/__preview/sign-out' && request.method === 'POST' && request.headers.get('origin') === origin) {
    sessions.delete(sessionId); return json({ ok: true }, 200, { 'Set-Cookie': cookie('', 0) });
  }
  if (url.pathname === '/__preview/session' && request.method === 'GET') {
    const session = sessions.get(sessionId);
    if (!session || session.expiresAt < Date.now()) return json({ error: 'Sign in.' }, 401);
    const token = await new SignJWT({ scope: scopes.join(' ') }).setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer).setAudience(audience).setSubject(session.sub).setIssuedAt().setExpirationTime('5m').sign(keys.privateKey);
    return json({ token });
  }
  return handler(request);
}
const server = http.createServer(async (req, res) => {
  try {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > 150_000) { res.writeHead(413); res.end(); return; } chunks.push(chunk); }
    const request = new Request(origin + req.url, { method: req.method, headers: req.headers,
      ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) });
    const response = await route(request);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(503, { 'Content-Type': 'application/json' }); res.end('{"error":"Preview unavailable."}'); }
});
server.listen(port, '127.0.0.1', () => console.log(`Local RR preview: ${origin}/training/ (synthetic SQLite only)`));
