// Runtime Ready page publishing: rules and operations, independent of GitHub and Firebase.
//
// A "store" is the only thing that touches the repository:
//   readFile(path, ref?) -> string | null
//   commit(files: [{path, content}], message) -> sha          (throws HttpError(409) on a race)
//   history(path, limit) -> [{sha, at, message}]              (newest first)
// A "user" is the folder an uploader owns: runtimeready.com/<user>/<site>/

export const MAX_HTML_BYTES = 4 * 1024 * 1024; // Netlify's synchronous function limit is about 6 MB.

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// Top-level paths this website already uses. An uploader can never be assigned one of these.
export const RESERVED_USERNAMES = new Set([
  "api", "publish", "riley", "jeopardy", "betrayal", "examples", "prospects", "quasar",
  "posts", "categories", "page", "contact", "images", "admin", "assets", "static",
  "netlify", "login", "logout", "sitemap", "rss", "feed", "robots", "favicon", "index",
  "about", "blog", "authors", "tags", "search", "dist", "src", "public", "p",
]);

const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;
const SHA_RE = /^[0-9a-f]{40}$/;

export const isValidName = (s) => typeof s === "string" && NAME_RE.test(s);

/** "ashley@example.com:ashley, other@example.com:other" -> Map(email -> username) */
export function parseUploaders(text = "") {
  const map = new Map();
  for (const part of String(text).split(/[,;\n]/)) {
    const t = part.trim();
    const i = t.lastIndexOf(":");
    if (i < 1) continue;
    const email = t.slice(0, i).trim().toLowerCase();
    const user = t.slice(i + 1).trim().toLowerCase();
    if (!email.includes("@") || !isValidName(user) || RESERVED_USERNAMES.has(user)) continue;
    map.set(email, user);
  }
  return map;
}

/** Turn what someone typed into a URL-safe page name. */
export function slugifySite(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function validateHtml(html) {
  if (typeof html !== "string" || !html.trim()) return "Paste or drop the exported HTML first.";
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    return "That file is over 4 MB. Large embedded photos usually need to be resized in Claude Design first.";
  }
  if (html.includes("\u0000")) return "That doesn't look like a text HTML file.";
  if (!/<(!doctype|html|head|body|div|section|main|h1|p)\b/i.test(html)) {
    return "That doesn't look like an HTML page. Export \"HTML5 single file\" from Claude Design.";
  }
  return null;
}

const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");

export function titleOf(html, fallback) {
  const m = /<title[^>]*>([^<]{1,120})/i.exec(html);
  const t = m ? decode(m[1]).trim() : "";
  return t || fallback;
}

/** First absolute image URL in the page, used as the card banner. Plain-colour card otherwise. */
export function bannerOf(html) {
  const m = /<img\b[^>]*\bsrc=["'](https:\/\/[^"']{1,500})["']/i.exec(html);
  return m ? decode(m[1]) : null;
}

const oneLine = (s, max) => String(s || "").replace(/\s+/g, " ").trim().slice(0, max);

export const manifestPath = (user) => `publish-data/${user}.json`;
export const pagePath = (user, site) => `public/${user}/${site}/index.html`;

const HEADERS_PATH = "public/_headers";

/** Make every page under /<user>/ load in a sandbox so its scripts cannot reach the rest of the site. */
export function ensureHeaders(text, user) {
  const rule = `/${user}/*`;
  const current = text || "";
  if (current.split(/\r?\n/).some((line) => line.trim() === rule)) return current;
  const block =
    `${rule}\n` +
    `  Content-Security-Policy: sandbox allow-scripts allow-popups allow-forms\n` +
    `  X-Robots-Tag: noindex\n`;
  return current ? `${current.replace(/\s*$/, "\n")}\n${block}` : block;
}

async function readManifest(store, user) {
  const text = await store.readFile(manifestPath(user));
  if (!text) return { sites: {} };
  try {
    const m = JSON.parse(text);
    return m && typeof m.sites === "object" && m.sites ? m : { sites: {} };
  } catch {
    throw new HttpError(500, "bad_manifest", "The list of pages is damaged. Ask Aidan to check it.");
  }
}

// Two quick publishes can race on the same branch; reload and try again.
async function withRetry(fn) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof HttpError) || e.code !== "conflict" || attempt >= 2) throw e;
    }
  }
}

const sortSites = (sites) =>
  Object.entries(sites)
    .map(([name, s]) => ({ name, ...s }))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

export async function listSites(store, user) {
  return sortSites((await readManifest(store, user)).sites);
}

export async function checkSite(store, user, raw) {
  const site = slugifySite(raw);
  if (!site) return { site: "", state: "invalid", message: "Use letters and numbers." };
  if (!isValidName(site)) return { site, state: "invalid", message: "Use letters and numbers." };
  const exists = Boolean((await readManifest(store, user)).sites[site]);
  return exists
    ? { site, state: "exists", message: "You already have this page. Publishing will update it." }
    : { site, state: "available", message: "Available" };
}

async function writePage({ store, user, site, html, message, note, now }) {
  return withRetry(async () => {
    const manifest = await readManifest(store, user);
    manifest.sites[site] = {
      title: titleOf(html, site),
      updatedAt: now.toISOString(),
      note: oneLine(note, 120),
      banner: bannerOf(html),
    };
    const headers = ensureHeaders(await store.readFile(HEADERS_PATH), user);
    const sha = await store.commit(
      [
        { path: pagePath(user, site), content: html },
        { path: manifestPath(user), content: JSON.stringify(manifest, null, 2) + "\n" },
        { path: HEADERS_PATH, content: headers },
      ],
      message,
    );
    return { sha, manifest };
  });
}

export async function publishSite({ store, user, site: rawSite, html, note, now = new Date() }) {
  const site = slugifySite(rawSite);
  if (!site || !isValidName(site)) throw new HttpError(400, "bad_name", "Give the page a name (letters and numbers).");
  const problem = validateHtml(html);
  if (problem) throw new HttpError(400, "bad_html", problem);

  const existing = await store.readFile(pagePath(user, site));
  if (existing === html) {
    throw new HttpError(409, "unchanged", "That's identical to what is already published. Nothing to publish.");
  }
  const created = existing === null;
  const label = oneLine(note, 80) || (created ? "first publish" : "update");
  const { sha } = await writePage({
    store, user, site, html, note, now,
    message: `Publish ${user}/${site}: ${label}`,
  });
  return { sha, site, created, path: `/${user}/${site}/` };
}

export async function versions(store, user, rawSite) {
  const site = slugifySite(rawSite);
  if (!site) throw new HttpError(400, "bad_name", "Choose a page.");
  const list = await store.history(pagePath(user, site), 30);
  return list.map((c, i) => ({
    sha: c.sha,
    at: c.at,
    current: i === 0,
    restored: /^Restore /.test(c.message),
    note: c.message.replace(/^(Publish|Restore) [^:]+:\s*/, ""),
  }));
}

export async function restoreSite({ store, user, site: rawSite, sha, now = new Date() }) {
  const site = slugifySite(rawSite);
  if (!site) throw new HttpError(400, "bad_name", "Choose a page.");
  if (!SHA_RE.test(String(sha))) throw new HttpError(400, "bad_version", "Choose a version from the list.");
  // Only the uploader's own page path is ever read, so another person's page cannot be reached.
  const html = await store.readFile(pagePath(user, site), sha);
  if (html === null) throw new HttpError(404, "no_version", "That version couldn't be found.");
  const current = await store.readFile(pagePath(user, site));
  if (current === html) throw new HttpError(409, "unchanged", "That version is already live.");
  const when = now.toISOString().slice(0, 10);
  const { sha: newSha } = await writePage({
    store, user, site, html, now,
    note: `Restored an earlier version`,
    message: `Restore ${user}/${site}: version ${sha.slice(0, 7)} (${when})`,
  });
  return { sha: newSha, site, path: `/${user}/${site}/` };
}
