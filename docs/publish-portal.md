# Publish portal

Status: local prototype, tested with fake storage and fake sign-in only. Not deployed. Written 2026-11-04.

People sign in at `/publish/`, drop in an exported HTML page, and it appears at `runtimeready.com/<username>/<page-name>/`. Each publish is one Git commit to this repository, so Netlify rebuilds (about 2 minutes) and Git history is the version history. Restoring an old version makes a new commit that copies it.

## How it fits together

| Piece | File |
|---|---|
| Portal (static page, no build step) | `public/publish/` |
| Sign-in (Firebase email and password, stays signed in) | `public/publish/auth.js` |
| API function | `netlify/functions/publish.mjs` |
| Rules and operations | `netlify/lib/publish-core.mjs` |
| GitHub and in-memory storage | `netlify/lib/stores.mjs` |
| Request handling and token check | `netlify/lib/publish-api.mjs` |
| Tests | `netlify/lib/publish.test.mjs` |
| Local rehearsal server | `scripts/publish-dev-server.mjs` |

Each publish commits three files together: the page (`public/<user>/<page>/index.html`), a small list of that user's pages for the card view (`publish-data/<user>.json`), and a `public/_headers` rule that serves everything under `/<user>/` in a sandbox, so a published page's scripts cannot read this site's other data (for example Riley's sign-in). Sandboxed pages cannot use cookies or browser storage.

## Try it locally

```powershell
node scripts/publish-dev-server.mjs --delay 6
node --test netlify/lib/publish.test.mjs
```

Open http://127.0.0.1:8791/publish/ and sign in as `ashley@example.com` with any password. Any other address shows the "not set up yet" screen unless you add it: `--uploaders "you@example.com:you"` (command line only, so real addresses stay out of the repository). `--delay` simulates the seconds before a commit goes live.

## Setting it up for real (needs Aidan)

Set these in Netlify (Site configuration, Environment variables). None of them belong in the repository.

| Variable | Value |
|---|---|
| `GITHUB_TOKEN` | A fine-grained personal access token for `Gmander/hydrogen-astro` with Repository permissions: Contents Read and write, nothing else. |
| `PUBLISH_UPLOADERS` | Who may publish, as `email:username` pairs separated by commas, for example `ashley@example.com:ashley`. Each email gets one folder. Usernames are lowercase letters, numbers and hyphens, and reserved site names (riley, jeopardy, api and others in `RESERVED_USERNAMES`) are ignored. |
| `PUBLISH_BRANCH` | The branch that receives commits. Use the PR branch while testing so production is untouched, then `main` (the default) when live. |
| `FIREBASE_API_KEY` | Optional. Defaults to `PUBLIC_FIREBASE_API_KEY`, which must be available to functions at runtime, not only at build time. |
| `PUBLIC_FIREBASE_AUTH_DOMAIN`, `PUBLIC_FIREBASE_PROJECT_ID`, `PUBLIC_FIREBASE_APP_ID` | Same as Riley. Also need to be available to functions at runtime. |

Firebase (project `riley-tracker-59212`, shared with Riley): Email/Password sign-in is already enabled and `runtimeready.com` plus the deploy-preview host are authorized domains. Email-link sign-in is deliberately not used: on the free Spark plan it allows only 5 emails per day (Riley hit `auth/quota-exceeded` on 2026-10-10). Password sign-in has no send quota; password-reset emails allow 150 per day and verification emails 1,000 (source: https://firebase.google.com/docs/auth/limits, checked 2026-11-04).

New person: they open `/publish/`, choose "First time? Create account", set a password, and click the confirmation link in their email once. After that the device stays signed in. The server refuses accounts whose email is unconfirmed, so nobody can claim an address that isn't theirs. Accounts in this project have no access to Riley data unless added as household members.

To add a person, add their `email:username` to `PUBLISH_UPLOADERS` and redeploy. Anyone who signs in with another address sees a "not set up yet" screen and cannot publish.

## Safety notes

- The folder a person writes to comes from their verified sign-in, never from the request.
- Published pages are public to anyone with the link. They are marked noindex, but that is not a password.
- The token can write to this repository. Keep it scoped to Contents on this one repository and rotate it if it leaks.
- Only one file per page is accepted (HTML, up to 4 MB). Zip uploads are refused with a message to export "HTML5 single file".

## Not verified yet

- Anything on real GitHub, Firebase or Netlify. The GitHub calls are tested only against a mock of the API.
- Whether `public/_headers` sandbox rules apply to nested published pages on Netlify as expected.
- Whether `/<user>/<page>/` collides with the site's existing top-level Astro routes.
- Netlify's function request-size limit in practice (the portal caps files at 4 MB).
- Whether the same function works on a deploy preview with a non-production `PUBLISH_BRANCH`.
- The create-account, confirm-email and forgot-password flow against real Firebase (only the local stand-in has run).
