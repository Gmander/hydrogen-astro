# Training Companion on Runtime Ready

New isolated workout application, built 2026-11-26. Aidan authorized direct production testing of this new route during implementation; no separate preview deployment is required for this release. Sites remains unchanged and canonical for existing records. No migration has run.

Routes: `/training/`, `/api/training/{config,activate,operation,mcp}`, and `/.well-known/oauth-protected-resource/api/training/mcp`.

## Run and build

Node 24 for local SQLite preview/tests; production function targets Node 20. Install pinned dependencies with `pnpm install --frozen-lockfile`. On this Windows machine use a writable store directory and hoisted node linker if the default global store is blocked.

```
node --test test/*.test.mjs
node build.mjs
node preview.mjs
```

Preview binds only `http://127.0.0.1:8810/training/`. Alex and Sam are fictional sample accounts. Their data persists in ignored `.local/preview.sqlite`. Preview sessions and signing keys are process-local; restart requires sample sign-in again. These local modules are excluded from the deployable bundle, checked by build.mjs.

## Production setup

- Existing Auth0 tenant: `dev-vv5cabcc1j2q74v6.us.auth0.com`.
- New API audience: `https://runtimeready.com/api/training/mcp`, RS256, `read:training` and `write:training`. Proof audience grants do not authorize this API.
- SPA client callback and logout URL: `https://runtimeready.com/training/`; allowed web origin: `https://runtimeready.com`. Public-client token endpoint authentication must be None. Enable rotation and offline access for the SPA; memory caching avoids storing tokens alongside device drafts. Reauthentication after a full reload may be required when silent sign-in is unavailable.
- Production env `TRAINING_AUTH0_CLIENT_ID` is the public SPA client ID. `TRAINING_INVITED_SUBJECTS` is a comma-separated explicit invitation list, not emails. No defaults: unset means nobody can activate.
- A signed-in invited user explicitly clicks **Create my test training space**. POST activation validates a workout-audience JWT and write scope, inserts an empty account and then its membership. Repeating activation preserves data; inactive memberships cannot reactivate. Reads never provision records. No imported data or profile assumptions.
- Each normal operation checks the stored active membership. Netlify namespace `training-companion-preview-v1`, strong reads, conditional writes. All account records and operation receipts share one bounded 1 MB object. Reads return at most 100 workouts and explicitly report truncation; a full migration export must use the stored account object.
- Publish generated `dist/public/training/`, `dist/netlify/functions/training.mjs`; merge `dist/training-headers.txt` into the existing RR public headers file. Preserve all other routes and headers. Retain source under RR `integrations/training-companion` for reproducible builds.

New assistant connections should target `/api/training/mcp` with only training scopes. Existing Sites and RR proof connectors remain separate. No secret is needed in browser code. No management or machine grants are required.

## Verification

Eight integration tests cover UI/MCP shared persistence, field preservation, signed-identity isolation, read-only scopes, revoked membership, wrong audience/expired credentials, owner injection, stale browser account binding, atomic retries/conflicts, deletion retry, request limits/origin controls, disk restart and invitation-only activation. Browser test created a plan, ran a two-second sample interval, saved the completed session and switched to Sam; Alex's records were absent there.

Hosted Auth0 sign-in, cloud persistence, both assistant connections, real second-user isolation and provider revocation/recovery must be recorded separately after deployment. Passing local tests does not establish those results.

See CONTRACT.md and the coordinator's `apps/training-companion/RR-MIGRATION.md` for remaining migration gates. Final storage scaling and backup/restore acceptance remain open; this bounded test does not silently move existing history.
