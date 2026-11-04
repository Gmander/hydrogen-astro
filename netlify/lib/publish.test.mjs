import assert from "node:assert/strict";
import { test } from "node:test";
import { handleRequest } from "./publish-api.mjs";
import {
  checkSite, ensureHeaders, listSites, pagePath, parseUploaders, publishSite, restoreSite,
  slugifySite, validateHtml, versions, titleOf, bannerOf,
} from "./publish-core.mjs";
import { githubStore, memoryStore } from "./stores.mjs";

const PAGE_1 = `<!doctype html><html><head><title>Fieldnote &amp; Co</title></head><body><h1>First headline</h1><img src="https://example.com/a.jpg"></body></html>`;
const PAGE_2 = PAGE_1.replace("First headline", "Second headline");

test("uploader list: parses, lowercases, drops reserved and invalid names", () => {
  const m = parseUploaders("Ashley@Example.com:ashley, bad:riley\nx@y.com:Has Space, aidan@x.com:aidan;nope");
  assert.deepEqual([...m], [["ashley@example.com", "ashley"], ["aidan@x.com", "aidan"]]);
});

test("page names become safe slugs", () => {
  assert.equal(slugifySite("  Fieldnote Pitch! "), "fieldnote-pitch");
  assert.equal(slugifySite("../../etc"), "etc");
  assert.equal(slugifySite("***"), "");
});

test("HTML validation", () => {
  assert.match(validateHtml(""), /Paste or drop/);
  assert.match(validateHtml("hello"), /doesn't look like an HTML/);
  assert.match(validateHtml("<p>" + "x".repeat(4 * 1024 * 1024)), /over 4 MB/);
  assert.equal(validateHtml(PAGE_1), null);
});

test("title and banner extraction", () => {
  assert.equal(titleOf(PAGE_1, "x"), "Fieldnote & Co");
  assert.equal(bannerOf(PAGE_1), "https://example.com/a.jpg");
  assert.equal(bannerOf('<img src="data:image/png;base64,AAAA">'), null);
});

test("headers rule is added once per user", () => {
  const once = ensureHeaders("", "ashley");
  assert.match(once, /^\/ashley\/\*\n {2}Content-Security-Policy: sandbox/);
  assert.equal(ensureHeaders(once, "ashley"), once);
  assert.equal((ensureHeaders(once, "aidan").match(/Content-Security-Policy/g) || []).length, 2);
});

test("publish, update, history, restore: the owner's flow", async () => {
  const store = memoryStore();
  const a = await publishSite({ store, user: "ashley", site: "Fieldnote Pitch", html: PAGE_1, note: "" });
  assert.equal(a.created, true);
  assert.equal(a.path, "/ashley/fieldnote-pitch/");

  await assert.rejects(publishSite({ store, user: "ashley", site: "fieldnote-pitch", html: PAGE_1 }), { code: "unchanged" });

  const b = await publishSite({ store, user: "ashley", site: "fieldnote-pitch", html: PAGE_2, note: "Owner wants new headline" });
  assert.equal(b.created, false);
  assert.match(await store.readFile(pagePath("ashley", "fieldnote-pitch")), /Second headline/);

  const v = await versions(store, "ashley", "fieldnote-pitch");
  assert.equal(v.length, 2);
  assert.equal(v[0].current, true);
  assert.equal(v[0].note, "Owner wants new headline");
  assert.equal(v[1].note, "first publish");

  await assert.rejects(restoreSite({ store, user: "ashley", site: "fieldnote-pitch", sha: v[0].sha }), { code: "unchanged" });
  await restoreSite({ store, user: "ashley", site: "fieldnote-pitch", sha: v[1].sha });
  assert.match(await store.readFile(pagePath("ashley", "fieldnote-pitch")), /First headline/);

  const after = await versions(store, "ashley", "fieldnote-pitch");
  assert.equal(after.length, 3); // history is kept; restore adds a new version
  assert.equal(after[0].restored, true);

  const sites = await listSites(store, "ashley");
  assert.equal(sites.length, 1);
  assert.equal(sites[0].title, "Fieldnote & Co");
  assert.match(await store.readFile("public/_headers"), /\/ashley\/\*/);
});

test("name check: invalid, available, exists", async () => {
  const store = memoryStore();
  assert.equal((await checkSite(store, "ashley", "!!!")).state, "invalid");
  assert.equal((await checkSite(store, "ashley", "Pitch One")).state, "available");
  await publishSite({ store, user: "ashley", site: "pitch-one", html: PAGE_1 });
  assert.equal((await checkSite(store, "ashley", "Pitch One")).state, "exists");
  // Another uploader can use the same page name: names are per user.
  assert.equal((await checkSite(store, "aidan", "Pitch One")).state, "available");
});

test("restore cannot reach another user's page or a made-up version", async () => {
  const store = memoryStore();
  await publishSite({ store, user: "ashley", site: "secret", html: PAGE_1 });
  const sha = (await versions(store, "ashley", "secret"))[0].sha;
  await assert.rejects(restoreSite({ store, user: "aidan", site: "secret", sha }), { code: "no_version" });
  await assert.rejects(restoreSite({ store, user: "ashley", site: "secret", sha: "../../etc/passwd" }), { code: "bad_version" });
});

function api(store, extra = {}) {
  const deps = {
    store,
    uploaders: parseUploaders("ashley@example.com:ashley"),
    publicConfig: { apiKey: "k" },
    verify: async (t) => {
      if (t === "good-ashley") return { email: "ashley@example.com" };
      if (t === "good-stranger") return { email: "stranger@example.com" };
      const { HttpError } = await import("./publish-core.mjs");
      throw new HttpError(401, "signed_out", "Please sign in again.");
    },
    ...extra,
  };
  const call = (method, query, token, body) =>
    handleRequest(
      new Request(`https://rr.test/.netlify/functions/publish?${query}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      }),
      deps,
    );
  return call;
}

test("API: public config needs no sign-in; everything else does", async () => {
  const call = api(memoryStore());
  assert.equal((await call("GET", "action=config")).status, 200);
  assert.equal((await call("GET", "action=me")).status, 401);
  assert.equal((await call("GET", "action=me", "bad")).status, 401);
});

test("API: a signed-in stranger is refused", async () => {
  const call = api(memoryStore());
  const res = await call("GET", "action=me", "good-stranger");
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, "not_allowed");
  assert.equal((await call("POST", "", "good-stranger", { action: "publish", site: "x", html: PAGE_1 })).status, 403);
});

test("API: the folder comes from the verified account, not the request", async () => {
  const store = memoryStore();
  const call = api(store);
  const res = await call("POST", "", "good-ashley", { action: "publish", site: "pitch", html: PAGE_1, user: "aidan", path: "../x" });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.url, "https://rr.test/ashley/pitch/");
  assert.ok(await store.readFile("public/ashley/pitch/index.html"));
  assert.equal(await store.readFile("public/aidan/pitch/index.html"), null);
  const me = await (await call("GET", "action=me", "good-ashley")).json();
  assert.equal(me.user, "ashley");
  assert.equal(me.sites[0].name, "pitch");
});

test("API: bad HTML and duplicates produce friendly errors", async () => {
  const call = api(memoryStore());
  const bad = await call("POST", "", "good-ashley", { action: "publish", site: "p", html: "hello" });
  assert.equal(bad.status, 400);
  await call("POST", "", "good-ashley", { action: "publish", site: "p", html: PAGE_1 });
  const dup = await call("POST", "", "good-ashley", { action: "publish", site: "p", html: PAGE_1 });
  assert.equal(dup.status, 409);
  assert.equal((await dup.json()).error, "unchanged");
});

test("GitHub store: sends the expected commit sequence and reports a race as a conflict", async () => {
  const calls = [];
  const respond = (status, body) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  const fetchImpl = async (url, init) => {
    calls.push(`${init.method} ${new URL(url).pathname}`);
    const p = new URL(url).pathname;
    if (init.method === "GET" && p.endsWith("/git/ref/heads/main")) return respond(200, { object: { sha: "a".repeat(40) } });
    if (init.method === "GET" && p.includes("/git/commits/")) return respond(200, { tree: { sha: "b".repeat(40) } });
    if (p.endsWith("/git/trees")) {
      const sent = JSON.parse(init.body);
      assert.equal(sent.base_tree, "b".repeat(40));
      if (!fetchImpl.race) assert.equal(sent.tree[0].path, "public/ashley/p/index.html");
      return respond(201, { sha: "c".repeat(40) });
    }
    if (p.endsWith("/git/commits")) return respond(201, { sha: "d".repeat(40) });
    if (init.method === "PATCH") return respond(fetchImpl.race ? 422 : 200, {});
    if (p.includes("/contents/")) return respond(404, "");
    throw new Error("unexpected " + init.method + " " + p);
  };
  const store = githubStore({ token: "t", repo: "o/r", branch: "main", fetchImpl });
  const sha = await store.commit([{ path: "public/ashley/p/index.html", content: "x" }], "msg");
  assert.equal(sha, "d".repeat(40));
  assert.deepEqual(calls, [
    "GET /repos/o/r/git/ref/heads/main",
    "GET /repos/o/r/git/commits/" + "a".repeat(40),
    "POST /repos/o/r/git/trees",
    "POST /repos/o/r/git/commits",
    "PATCH /repos/o/r/git/refs/heads/main",
  ]);
  assert.equal(await store.readFile("public/_headers"), null);
  fetchImpl.race = true;
  await assert.rejects(store.commit([{ path: "a", content: "b" }], "m"), { code: "conflict" });
});

test("a publish that loses a race is retried and succeeds", async () => {
  const inner = memoryStore();
  let failures = 1;
  const store = {
    ...inner,
    readFile: inner.readFile,
    history: inner.history,
    async commit(files, message) {
      if (failures-- > 0) {
        const { HttpError } = await import("./publish-core.mjs");
        throw new HttpError(409, "conflict", "race");
      }
      return inner.commit(files, message);
    },
  };
  const r = await publishSite({ store, user: "ashley", site: "p", html: PAGE_1 });
  assert.equal(r.created, true);
  assert.equal(inner.commits.length, 1);
});
