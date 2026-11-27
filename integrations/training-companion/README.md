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

## Live configuration — 2026-11-26

- SPA Training Companion Web: `9ohkzhthbI1Sncij0LqtTblvXaWoHZnU`.
- Training API ID: `6b08ce5e66500c71568ea4de`. RS256; access expiry 3600 seconds; offline access on; consent skipping off; per-app delegated access; client access denied.
- SPA rotating refresh: idle 1296000 seconds, max 2592000 seconds; authorization-code and refresh grants enabled, implicit disabled. Existing database connection enabled.
- Web SPA, ChatGPT (`tpc_jDEVcfQko2bL23AnnkP5xi`), Claude RR Proof (`tpc_cPB4NLyF99uvBuePj3KhsK`) each granted only the two training scopes. Always-grant-future-permissions unchecked; anonymous scopes zero.
- Netlify Production-only client ID and owner invitation configured; no credentials recorded here. Deploy `6b08cf6530acddd7b7efa530` published from `99d6ff7`.
- Live website reaches Auth0 login. User must sign in with the existing training database account used for the phone proof (Google is a separate identity unless explicitly linked). Activation/cloud workout persistence and real second-user/revocation checks remain pending.

Hosted continuation: owner login/activation succeeded; a clearly synthetic two-second plan and separate completed session saved at revision 1 and each survived full reload. Auth0 confirmed silent authentication/code exchanges on reload; web refresh-token exchange remains unverified. Live revocation/recovery and a second real identity remain pending. Two synthetic records are retained for follow-up.

ChatGPT workout connector `plugin_asdk_app_6b08e4d7ae8c81919e633f87ec67139c` is connected; web read returned both hosted synthetic records at revision 1. Exact notes-only test write awaits user approval after auto-review rejected Allow once. Claude connector form prepared but not added. Evidence chat: https://chatgpt.com/c/6b08e526-e77c-83ea-b82a-f7427fa9449e .

Approved ChatGPT notes-only mutation passed and independent website reload confirms plan revision 2 with the exact requested synthetic note. Claude connector repair awaits explicit permission to transfer existing Auth0 client secret to Claude secure connector configuration after auto-review blocked it. No secret recorded here.

2026-11-27: User explicitly approved the credential transfer; Claude Training Companion RR now Connected (`plugin_019gZ36MsXwJC6U37YnaQcet`) and discovers all six tools. Existing Sites connector remains active. Actual Claude workout calls and iPhone acceptance are next; no migration, second identity or revocation performed. No credentials stored in files.


## Exercise library preview — 2026-11-27 (not deployed)
User approved the search/reuse/create design. Coordinator source now implements four additional private MCP/browser operations: search_exercises, get_exercise, create_exercise, update_exercise. Library records hold aliases/equipment/muscles/instructions/variations and up to four captioned PNG/JPEG/WebP thumbnails. UI upload resizes/re-encodes (metadata stripped); each inline image is capped at 24,000 characters. The existing 150KB request and 1MB account limits still apply, including receipts and workout snapshots. This is a bounded pilot, not final media storage; expand storage before a large collection. Assistants need actual image bytes to attach media; generated-image transfer from phone clients has not been verified. No image generation service added.

Workout entries support optional exerciseId/exerciseRevision, per-exercise notes and server-validated saved guidance. Creation resolves only owned definitions. Library edits never rewrite existing workouts; Use latest guidance deliberately refreshes a plan entry. Sessions copy the starting definition and notes into completed history. Legacy unlinked workouts remain valid and can supply the name for a new library draft. No automatic import from Sites or guessed exercise guidance.

UI: private Library navigation, search/pagination, create/edit, image upload/captions, Choose from library, workout coaching notes, in-session guidance, saved drafts and same-intent retries. Source and generated CSP allow only same-origin/data images, no remote image requests.

Validation: 11 integration tests pass (including signed identity isolation, scope/revocation, duplicates/aliases, CAS conflicts, same-intent replay, media bounds, pagination, snapshot tampering, session notes, old workout compatibility and SQLite restart). Production function/assets build passes. Browser sample flow on port 8811 created Sample movement revision 1, linked a synthetic plan with coaching notes, updated library guidance/image to revision 2, reloaded and confirmed the image loaded plus the old plan retained original guidance. Sam's library remained empty. Draft recovery passed. Desktop and 390px layout inspected; phone-width search adjusted. This is local-browser evidence, not physical iPhone or live assistant acceptance.

Visible preview: http://127.0.0.1:8811/training/#library, fictional Alex account. Hidden Node process 28564 serves source build with synthetic SQLite only. Original production route and Sites remain unchanged. Nov26 preview waiver was date-limited; this Nov27 UI release awaits review/approval. After approval: release the source/build/header change, refresh connector discovery (ten total tools), and verify actual GPT/Claude library calls and media workflow. Remaining pacing/rest/side-switch work and measurements/goals are separate upcoming slices.

Canonical publishing source synchronized (13 explicitly selected files, hash parity verified); generated public assets in publishing checkout remain untouched. No commit/push/deploy.
