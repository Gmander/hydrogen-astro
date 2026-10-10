# Riley Firebase setup

Riley uses Firebase email-link authentication and Cloud Firestore for shared household records. The app uses Firebase's browser-local auth persistence, so a parent normally stays signed in on that browser. They sign in again on a new device or after signing out or clearing browser data. This is a small household tool, not production-grade customer authentication.

## Firebase project

1. Create a Firebase project and register a Web app. The Web app settings are public client configuration, not admin credentials. Do not put a service-account key or Admin SDK secret in this Astro site.
2. In **Authentication → Sign-in method**, enable **Email/Password**, then enable **Email link (passwordless sign-in)**.
3. In **Authentication → Settings → Authorized domains**, add `runtimeready.com`, `localhost`, and the exact Netlify deploy-preview hostname if you plan to test sign-in on a preview. Firebase projects created after April 28, 2025 no longer add `localhost` automatically.
4. Create the Firestore database in production mode and publish the contents of [`../firestore.rules`](../firestore.rules) in **Firestore → Rules** before using the app.
5. Copy the Web app values into Netlify's environment variables for the production deploy context:

   - `PUBLIC_FIREBASE_API_KEY`
   - `PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `PUBLIC_FIREBASE_PROJECT_ID`
   - `PUBLIC_FIREBASE_APP_ID`

   Add the same values for Deploy Previews only if using a configured preview hostname for sign-in. These values are intentionally exposed in the browser; Firestore rules provide access control. Rebuild/redeploy after adding variables.

With all four values absent, `/riley` stays in the sample-data demo mode. If only some values are present, the page stops with a configuration message instead of silently using demo mode.

## Add household members

1. Open `/riley` on the deployed site and request a sign-in link for a parent's email. The first completed link creates a Firebase Auth account. The account cannot read household events yet.
2. The signed-in page shows that account's Firebase UID. In the Firebase Console, open **Firestore → Data** and create this document:

   - Collection: `households`
   - Document: `riley`
   - Subcollection: `members`
   - Document ID: the exact UID shown in Riley
   - Fields: `name` (string, such as `Aidan`) and `role` (string, such as `member`)

   Repeat for the other parent. The app never lets a browser add or change membership. Only someone with Firebase Console access can authorize another account in this first version.
3. The access screen listens for that membership document. Once it appears, the tracker opens and the caregiver selector uses the names from the household member documents.

The app stores events under `households/riley/events/{eventId}`. Each event has a type, Firestore timestamp, caregiver name, note, and creator UID; feed-specific details are optional. Any household member can read, add, edit, or delete the household's events. The account that entered a record is kept separately from the caregiver selected for that event.

## Scope and limits

- Firebase Auth's local session persistence keeps the browser signed in across reloads and browser restarts; the refresh token remains in browser-managed storage. Signing out or clearing browser data removes that session. A new device needs its own email-link sign-in.
- This initial version expects a connection. It does not enable persistent Firestore offline caching, so it avoids keeping an offline database copy on a shared device.
- Firebase's no-cost Firestore quota is subject to current plan terms and project limits. Check the Firebase Console for actual usage; no billing account or project is configured by this repository.
- Keep a separate export/backup plan before relying on this for irreplaceable history. The free tier does not include Firestore managed backup/restore.
- This prototype has no invitation UI, email allowlist, account deletion flow, export, or automated backup. Membership removal in Firestore rules immediately removes access, but Auth accounts are managed separately.
