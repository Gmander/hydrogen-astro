import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const root = new URL('./', import.meta.url);
const path = name => fileURLToPath(new URL(name, root));
await mkdir(new URL('dist/public/training/', root), { recursive: true });
await mkdir(new URL('dist/netlify/functions/', root), { recursive: true });
const functionBuild = await build({ entryPoints: [path('entry.mjs')], bundle: true, platform: 'node', format: 'esm', target: 'node20', metafile: true, outfile: path('dist/netlify/functions/training.mjs') });
if (Object.keys(functionBuild.metafile.inputs).some(name => /(?:fixtures|preview|local-store)\.mjs$/.test(name))) throw Error('Local preview module included in production bundle.');
await build({ entryPoints: [path('ui/client.js')], bundle: true, platform: 'browser', format: 'esm', target: 'es2022', outfile: path('dist/public/training/app.js') });
for (const name of ['index.html', 'style.css']) await copyFile(new URL('ui/' + name, root), new URL('dist/public/training/' + name, root));
await copyFile(new URL('node_modules/@auth0/auth0-spa-js/dist/auth0-spa-js.worker.production.js', root), new URL('dist/public/training/auth0-worker.js', root));
// Merge this path-scoped block into the RR headers file at release; never replace unrelated rules.
await writeFile(new URL('dist/training-headers.txt', root), `/training/*\n  Cache-Control: no-store\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  Content-Security-Policy: default-src 'self'; img-src 'self' data:; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://dev-vv5cabcc1j2q74v6.us.auth0.com; frame-src https://dev-vv5cabcc1j2q74v6.us.auth0.com; worker-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'\n`);
console.log('Built /training/ assets and Netlify function; local mock sign-in is excluded.');
