// HTTP layer for publishing. The caller's identity always comes from a verified sign-in token,
// never from anything in the request body.
import {
  HttpError, checkSite, listSites, publishSite, restoreSite, versions,
} from "./publish-core.mjs";

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

/** Checks a Firebase sign-in token with Google and returns the verified email. */
export function firebaseVerifier({ apiKey, fetchImpl = fetch }) {
  return async (idToken) => {
    if (!apiKey) throw new HttpError(500, "not_configured", "Publishing isn't set up on this site yet.");
    const res = await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new HttpError(401, "signed_out", "Please sign in again.");
    const user = (await res.json()).users?.[0];
    if (!user?.email || !user.emailVerified) throw new HttpError(401, "signed_out", "Please sign in again.");
    return { email: user.email.toLowerCase(), uid: user.localId };
  };
}

/**
 * deps: { verify(idToken) -> {email}, store, uploaders: Map(email -> username), publicConfig, now? }
 */
export async function handleRequest(req, deps) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (req.method === "GET" && action === "config") {
      return json(200, { firebase: deps.publicConfig });
    }

    const m = /^Bearer (.+)$/.exec(req.headers.get("authorization") || "");
    if (!m) throw new HttpError(401, "signed_out", "Please sign in.");
    const { email } = await deps.verify(m[1]);
    const user = deps.uploaders.get(email);
    if (!user) throw new HttpError(403, "not_allowed", "This account isn't set up for publishing yet.");
    const now = deps.now ? deps.now() : new Date();

    if (req.method === "GET") {
      if (action === "me") return json(200, { user, email, sites: await listSites(deps.store, user) });
      if (action === "check") return json(200, await checkSite(deps.store, user, url.searchParams.get("site")));
      if (action === "versions") return json(200, { versions: await versions(deps.store, user, url.searchParams.get("site")) });
      throw new HttpError(404, "not_found", "Not found.");
    }

    if (req.method === "POST") {
      let body;
      try {
        body = JSON.parse(await req.text());
      } catch {
        throw new HttpError(400, "bad_request", "That request wasn't understood.");
      }
      if (body.action === "publish") {
        const r = await publishSite({ store: deps.store, user, site: body.site, html: body.html, note: body.note, now });
        return json(200, { ...r, url: `${url.origin}${r.path}`, message: r.created ? "Published." : "Updated." });
      }
      if (body.action === "restore") {
        const r = await restoreSite({ store: deps.store, user, site: body.site, sha: body.sha, now });
        return json(200, { ...r, url: `${url.origin}${r.path}`, message: "Restored." });
      }
      throw new HttpError(404, "not_found", "Not found.");
    }
    throw new HttpError(405, "bad_method", "Not supported.");
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message });
    console.error("publish failed", e);
    return json(500, { error: "server_error", message: "Something went wrong. Try again." });
  }
}
