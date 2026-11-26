import { build } from 'esbuild';
await build({ entryPoints: ['entry.mjs'], outfile: 'dist/rr-auth-proof.mjs', bundle: true, platform: 'node', target: 'node20', format: 'esm' });
