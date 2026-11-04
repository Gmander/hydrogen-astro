// Netlify Function: POST/GET /.netlify/functions/publish
// Setup and required environment variables: docs/publish-portal.md
import { githubStore } from "../lib/stores.mjs";
import { handleRequest, firebaseVerifier } from "../lib/publish-api.mjs";
import { parseUploaders } from "../lib/publish-core.mjs";

export default async (req) => {
  const env = process.env;
  const apiKey = env.FIREBASE_API_KEY || env.PUBLIC_FIREBASE_API_KEY;
  const publicConfig = {
    apiKey,
    authDomain: env.PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.PUBLIC_FIREBASE_APP_ID,
  };
  const configured = Boolean(env.GITHUB_TOKEN && env.PUBLISH_UPLOADERS && apiKey);
  if (!configured && new URL(req.url).searchParams.get("action") !== "config") {
    return Response.json(
      { error: "not_configured", message: "Publishing isn't set up on this site yet." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  return handleRequest(req, {
    verify: firebaseVerifier({ apiKey }),
    // The store is only built when needed so that "config" works even before the token is added.
    get store() {
      return githubStore({
        token: env.GITHUB_TOKEN,
        repo: env.PUBLISH_REPO || "Gmander/hydrogen-astro",
        branch: env.PUBLISH_BRANCH || "main",
      });
    },
    uploaders: configured ? parseUploaders(env.PUBLISH_UPLOADERS) : new Map(),
    publicConfig,
  });
};
