# Riley tracker

Updated: 2026-10-10. Production is on Firebase/Firestore (commit `d8902bf`). The current local changes add step-based feed and diaper entry plus sleep sessions; they are not deployed yet.

## Scope

Route: `/riley` (this site's Astro config uses `trailingSlash: never`). Active source: `src/pages/riley.astro`, `src/scripts/riley.js`, `public/riley/style.css`.

The screen supports step-based breast/bottle feeds, wet/dirty/combined diapers with separate wee/poo sizes, quick-start and manual sleep sessions, caregiver, timestamps, optional notes, day navigation, category filters, edit, delete and undo. Combined diapers count once in the timeline and once in each relevant summary. Sleep sessions count on each browser-local calendar day they overlap. When Firebase is configured, email-link accounts with a Firestore household membership can access shared events. Without Firebase configuration, the route displays only synthetic sample data. It is marked noindex; this is not access control.

## Local workflow

The checked-in `pnpm-lock.yaml` uses lockfile v6. `package.json` pins pnpm 8.15.9 for a frozen installation. The first Netlify preview failed because the inherited packageManager field declared Yarn despite the pnpm build command; this PR aligns that field with the existing lockfile and tested pnpm version.

```powershell
pnpm install --frozen-lockfile
$env:ASTRO_TELEMETRY_DISABLED='1'
pnpm build
pnpm preview --host 127.0.0.1 --port 4321
```

Open http://127.0.0.1:4321/riley. A dev loop can use `pnpm dev --host 127.0.0.1 --port 4321` instead. Existing site font generation needs network access during a full build. On this Windows sandbox, esbuild required execution outside the sandbox to read dependency paths; no dependency upgrades were required.

## Release readiness

- The local HEAD matched remote default HEAD `55cf8e0d0140a992501e8ff460e96a7dab484852` on 2026-10-09.
- The signed-in Netlify dashboard confirms this repository as the source of runtimeready.com.
- `netlify.toml` specifies `pnpm build`, output `dist`, Node 20. No local GitHub Actions workflow exists.
- PR #2 merged to `main`; Netlify published production commit `d8902bf`. Firebase sign-in and Firestore CRUD were verified in the deploy preview. Production-origin session verification and adding the second parent remain pending.

Authenticated Netlify inspection on 2026-10-09 confirmed this repository, production branch `main`, auto publishing, build `pnpm build` to `dist`, and Deploy Previews for PRs against `main`. Branch deploys are disabled apart from production. Published commit is `3737267`, two config commits behind current HEAD (build command and a redirect change). Dashboard Node setting says 18.x while `netlify.toml` says 20; inspect the effective version in the first preview build log.

To complete the remote flow: publish an explicitly selected branch/PR preview; verify `/riley` and the home page on that returned preview URL. Production release follows review. Removing the three tracker source files and rebuilding removes this proposal; no data migrations exist.

Because this repository is a fork, explicitly target `Gmander/hydrogen-astro:main` when creating PRs. The generic new-PR link can default to the upstream `statichunt` repository. Use the same-repository compare page and verify the base owner before submitting.

## Firebase setup

See [Riley Firebase setup](riley-firebase-setup.md) for project setup, environment variables, email-link authentication, membership bootstrap, and Firestore rules. Firestore rules need to be updated with the new event fields before these changes can save to the configured Firebase project.
