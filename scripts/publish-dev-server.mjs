// Local rehearsal of the publish portal. Runs the real portal files and the real API code against
// in-memory storage with a fake sign-in, and simulates the delay before a commit goes live.
//
//   node scripts/publish-dev-server.mjs [--port 8791] [--delay 6]
//
// Open http://127.0.0.1:8791/publish/ and sign in as ashley@example.com (allowed) with any password, or any other
// address (shown the "not set up yet" screen unless added with --uploaders). Nothing here talks to GitHub, Firebase or Netlify.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../netlify/lib/publish-api.mjs";
import { HttpError, parseUploaders } from "../netlify/lib/publish-core.mjs";
import { memoryStore } from "../netlify/lib/stores.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : fallback;
};
const strOpt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const PORT = opt("port", 8791);
const DELAY_MS = opt("delay", 6) * 1000;
const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const store = memoryStore();
const deps = {
  store,
  // Add real addresses on the command line, e.g. --uploaders "me@example.com:me" (never commit them).
  uploaders: parseUploaders(["ashley@example.com:ashley", strOpt("uploaders", "")].join(",")),
  publicConfig: { apiKey: "dev" },
  verify: async (token) => {
    if (!token.startsWith("dev:")) throw new HttpError(401, "signed_out", "Please sign in again.");
    return { email: token.slice(4).toLowerCase() };
  },
};

// Stands in for public/publish/auth.js: any email and password signs in, and the session persists.
const DEV_AUTH = `
const KEY = "dev-publish-user";
export const friendlyAuthError = (e) => e?.message || "Something went wrong.";
export async function startAuth(config, onUser) {
  const emit = () => { const e = localStorage.getItem(KEY); onUser(e ? { email: e, verified: true } : null); };
  queueMicrotask(emit);
  const enter = async (email) => { localStorage.setItem(KEY, email); emit(); };
  return {
    signIn: enter,
    signUp: enter,
    resetPassword: async () => {},
    resendVerification: async () => {},
    refresh: async () => emit(),
    getToken: async () => "dev:" + localStorage.getItem(KEY),
    signOut: async () => { localStorage.removeItem(KEY); emit(); },
  };
}
`;

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { "Cache-Control": "no-store", ...headers });
  res.end(body);
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = decodeURIComponent(url.pathname);

    if (path === "/.netlify/functions/publish") {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const response = await handleRequest(
        new Request(url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }),
        deps,
      );
      return send(res, response.status, Buffer.from(await response.arrayBuffer()), Object.fromEntries(response.headers));
    }

    if (path === "/publish/auth.js") return send(res, 200, DEV_AUTH, { "Content-Type": TYPES[".js"] });
    if (path === "/publish") return send(res, 301, "", { Location: "/publish/" });

    if (path.startsWith("/publish/")) {
      const file = normalize(join(PUBLIC, path.endsWith("/") ? path + "index.html" : path));
      if (!file.startsWith(PUBLIC)) return send(res, 403, "");
      return send(res, 200, await readFile(file), { "Content-Type": TYPES[extname(file)] || "application/octet-stream" });
    }

    // Published pages, as the live site would show them after the simulated deploy delay.
    const m = /^\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/.exec(path);
    if (m) {
      if (!path.endsWith("/")) return send(res, 301, "", { Location: path + "/" });
      const html = store.deployedFile(`public/${m[1]}/${m[2]}/index.html`, DELAY_MS);
      if (html === null) return send(res, 404, "<h1>Not found</h1>", { "Content-Type": TYPES[".html"] });
      const headers = store.deployedFile("public/_headers", DELAY_MS) || "";
      const sandboxed = headers.split(/\r?\n/).some((l) => l.trim() === `/${m[1]}/*`);
      return send(res, 200, html, {
        "Content-Type": TYPES[".html"],
        ...(sandboxed ? { "Content-Security-Policy": "sandbox allow-scripts allow-popups allow-forms", "X-Robots-Tag": "noindex" } : {}),
      });
    }

    if (path === "/") return send(res, 302, "", { Location: "/publish/" });
    send(res, 404, "Not found");
  } catch (e) {
    console.error(e);
    send(res, 500, "Server error");
  }
}).listen(PORT, "127.0.0.1", () => {
  console.log(`Publish portal (local rehearsal): http://127.0.0.1:${PORT}/publish/`);
  console.log(`Simulated deploy delay: ${DELAY_MS / 1000}s. Sign in as ashley@example.com.`);
});
