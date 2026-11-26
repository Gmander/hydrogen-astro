# Authenticated RR proof (not a migration)

User confirmed both direct RR iPhone transport calls worked on 2026-11-26 and authorized the authenticated proof next.

Target: separate `/api/rr-auth-proof` Netlify function on Runtime Ready. Do not add private functionality to the public transport diagnostic. No existing Sites, Riley or workout records are moved/read.

Authorization: supported external OAuth provider (Auth0 proposed, awaiting account setup). Verify RS256 JWT signature against configured issuer JWKS, exact issuer and this API audience, expiry, subject and operation scopes. An explicit allowed-subject list grants pilot membership; revoke membership by removing the subject and redeploying. No trust in caller-supplied user/email. Store no credentials in source or tool output. No home-grown authorization server.

Storage: isolated `rr-auth-proof-v1` Netlify Blobs namespace, one synthetic test record plus bounded retry receipts per issuer/subject hash. This exercises user-controlled Netlify persistence; it does not select the final workout database or replace Firebase. Conditional writes keep a mutation and its receipt atomic. Updates require expected revision; retries reuse UUID operation IDs. Only a small integer is writable; no freeform private data.

Operations: `get_private_test_record` (read:proof), `create_private_test_record` and `update_private_test_record` (read:proof + write:proof). Fixed record title marks it synthetic. No arbitrary queries, deletion, file uploads or external side effects. Reads never create a record.

Acceptance: local JWT denial tests and simulated conditional-store races; live missing/invalid-token denial; actual provider sign-in/consent and web calls for GPT/Claude; actual iPhone create/read/correct with independent storage readback. Refresh/reconnection and subject removal must be checked. Public diagnostic phone success does not establish these results. Until all required gates pass, retain the Sites pilot unchanged.
