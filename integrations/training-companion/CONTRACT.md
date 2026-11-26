# RR workout preview contract — 2026-11-26

Aidan authorized building an isolated RR preview. Reuse the existing interface and all six workout operations. Sites D1 remains canonical for existing records; this preview contains synthetic records only. No import or cutover is authorized by this implementation.

For this bounded preview, use the proven Netlify Blobs conditional-write API with strong reads: one account object contains profile, workouts and operation receipts; a 1 MB cap fails closed without evicting receipts. This avoids provisioning another provider for the preview. Final long-term workout storage and backup/restore acceptance remain a migration gate. Local preview uses SQLite to implement the same conditional-store interface, with two synthetic identities and no live backend access.

Auth0 supplies production JWTs. New audience https://runtimeready.com/api/training/mcp and read:training/write:training scopes isolate workout permissions from proof permissions. Browser uses the official Auth0 SPA SDK, code flow with PKCE and memory token cache. Each API call resolves exact issuer/subject to an active membership stored server-side. No email linking, caller-selected athlete, Sites headers, proof allowlist, or default owner. Reads do not create accounts. Deployment requires explicit member provisioning and a distinct SPA client/API configuration.

UI /api/training/operation and MCP /api/training/mcp share the same validation and operations. Browser POSTs require the configured exact origin; cross-origin requests are denied. MCP clients use bearer tokens, not cookies. Date-only dates and all workout/units/null semantics are preserved. UUID operation IDs are owner-scoped; record change and receipt commit together. Updates/deletes require expectedRevision. Conflicts never auto-overwrite. Deletion receipts retain retry evidence; no permanent-erasure claim.

Build outputs only the production function and static /training/ assets. The local mock sign-in, test keys, fixtures, and SQLite store are separate modules excluded from the function bundle. Durable member checks allow subsequent requests to be denied after removal without a deployment; they do not cancel an already-running authorized request. Access-token validation is separate from Auth0 refresh revocation.

Release gates: synthetic preview review; Auth0 app/API setup; authenticated hosted browser + both assistants; provider revocation/recovery; actual second-user isolation; backup/restore and data migration rehearsal. No production release before preview approval and release request.
