import { friendlyAuthError, startAuth } from "/publish/auth.js";

const $ = (id) => document.getElementById(id);
const API = "/.netlify/functions/publish";
const SCREENS = ["screen-loading", "screen-signin", "screen-verify", "screen-denied", "screen-error", "screen-app"];

let auth = null;
let me = null; // { user, email, sites }
let editing = null; // existing page name, or null for a new page
let pollToken = 0;

function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
}

function el(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  e.append(...kids);
  return e;
}

async function api(method, query, body) {
  const token = await auth.getToken();
  const res = await fetch(`${API}?${query}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON error page */ }
  if (!res.ok) throw Object.assign(new Error(data.message || "Something went wrong. Try again."), { code: data.error, status: res.status });
  return data;
}

function ago(iso) {
  const s = (Date.now() - Date.parse(iso)) / 1000;
  const f = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (s < 60) return "just now";
  if (s < 3600) return f.format(-Math.round(s / 60), "minute");
  if (s < 86400) return f.format(-Math.round(s / 3600), "hour");
  return f.format(-Math.round(s / 86400), "day");
}

/* ---------- boot and sign-in ---------- */

async function boot() {
  try {
    const res = await fetch(`${API}?action=config`);
    const cfg = await res.json();
    if (!res.ok || !cfg.firebase?.apiKey) throw new Error("not configured");
    // Sign-in state can be announced before startAuth returns; hold it until `auth` is set.
    let ready;
    const authReady = new Promise((resolve) => { ready = resolve; });
    auth = await startAuth(cfg.firebase, (user) => authReady.then(() => onUser(user)));
    ready();
  } catch (e) {
    console.error(e);
    $("error-msg").textContent = "Sign-in isn't configured on this site yet. Tell Aidan.";
    show("screen-error");
  }
}

async function onUser(user) {
  $("who").hidden = !user;
  if (!user) return show("screen-signin");
  $("who-email").textContent = user.email;
  if (!user.verified) {
    // Accounts must confirm their email so nobody can claim an address that isn't theirs.
    $("verify-email").textContent = user.email;
    return show("screen-verify");
  }
  try {
    me = await api("GET", "action=me");
    renderList();
    openList();
    show("screen-app");
  } catch (e) {
    if (e.code === "not_allowed") {
      $("denied-email").textContent = user.email;
      show("screen-denied");
    } else if (e.code === "signed_out") {
      show("screen-signin");
    } else {
      $("error-msg").textContent = e.message;
      show("screen-error");
    }
  }
}

async function authStep(msgId, working, action) {
  const msg = $(msgId);
  msg.textContent = working;
  try {
    msg.textContent = (await action()) || "";
  } catch (err) {
    console.error(err);
    msg.textContent = friendlyAuthError(err);
  }
}
const credentials = () => [$("signin-email").value.trim(), $("signin-password").value];

$("signin-form").addEventListener("submit", (e) => {
  e.preventDefault();
  authStep("signin-msg", "Signing in…", () => auth.signIn(...credentials()));
});
$("create-account").addEventListener("click", () => {
  if (!$("signin-form").reportValidity()) return;
  authStep("signin-msg", "Creating your account…", () => auth.signUp(...credentials()));
});
$("forgot").addEventListener("click", () => {
  const email = $("signin-email").value.trim();
  if (!email) return ($("signin-msg").textContent = "Enter your email above first.");
  authStep("signin-msg", "Sending…", async () => {
    await auth.resetPassword(email);
    return "If that email has an account, a reset link is on its way.";
  });
});
$("verify-done").addEventListener("click", () =>
  authStep("verify-msg", "Checking…", async () => {
    await auth.refresh();
    return "Not confirmed yet. Open the link in the email, then try again.";
  }));
$("verify-resend").addEventListener("click", () =>
  authStep("verify-msg", "Sending…", async () => {
    await auth.resendVerification();
    return "Sent. Check your inbox (and spam).";
  }));
$("sign-out").addEventListener("click", () => auth.signOut());

/* ---------- page list ---------- */

function hue(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
}

function renderList() {
  $("list-sub").textContent = `Your pages live at ${location.host}/${me.user}/`;
  const cards = $("cards");
  cards.replaceChildren();
  $("empty").hidden = me.sites.length > 0;
  for (const s of me.sites) {
    const banner = el("div", { class: "banner" });
    if (s.banner) {
      const img = el("img", { src: s.banner, alt: "", loading: "lazy", referrerpolicy: "no-referrer" });
      img.addEventListener("error", () => img.remove());
      banner.append(img);
    }
    banner.style.background = `linear-gradient(135deg, hsl(${hue(s.name)} 35% 38%), hsl(${(hue(s.name) + 40) % 360} 40% 22%))`;
    cards.append(
      el("button", { class: "card", type: "button", onclick: () => openEditor(s.name) },
        banner,
        el("div", { class: "meta" },
          el("div", { class: "name" }, s.title || s.name),
          el("div", { class: "sub" }, `/${me.user}/${s.name} · edited ${ago(s.updatedAt)}`))),
    );
  }
}

function openList() {
  pollToken++;
  $("view-edit").hidden = true;
  $("view-list").hidden = false;
}

$("new-page").addEventListener("click", () => openEditor(null));
$("back").addEventListener("click", async () => {
  try { me = await api("GET", "action=me"); renderList(); } catch { /* keep the old list */ }
  openList();
});

/* ---------- editor ---------- */

const liveUrl = (site) => `${location.origin}/${me.user}/${site}/`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40).replace(/-+$/g, "");

function setMsg(kind, ...kids) {
  const m = $("msg");
  m.hidden = !kind;
  m.className = `msg ${kind || ""}`;
  m.replaceChildren(...kids);
}

function openEditor(site) {
  editing = site;
  pollToken++;
  $("view-list").hidden = true;
  $("view-edit").hidden = false;
  $("edit-form").reset();
  $("file-name").textContent = 'In Claude Design, ask for an "HTML5 single file".';
  setMsg(null);
  $("name-state").textContent = "";
  $("name-state").className = "state";
  const existing = site && me.sites.find((s) => s.name === site);
  $("edit-title").textContent = existing ? existing.title || site : "New page";
  $("site-name").value = existing ? site : "";
  $("site-name").readOnly = Boolean(existing);
  $("publish").textContent = existing ? "Publish update" : "Publish";
  $("publish-hint").textContent = existing ? "Visitors keep the same link." : "";
  $("url-preview").textContent = site ? liveUrl(site) : `${location.host}/${me.user}/…`;
  $("versions-wrap").hidden = !existing;
  if (existing) {
    setPreview(null, liveUrl(site));
    loadVersions();
  } else {
    setPreview("", null);
  }
  updatePublishEnabled();
  window.scrollTo(0, 0);
}

function setPreview(html, src) {
  const f = $("preview");
  if (html) { f.removeAttribute("src"); f.srcdoc = html; }
  else if (src) { f.removeAttribute("srcdoc"); f.src = src; }
  else { f.removeAttribute("src"); f.srcdoc = "<body style='font:14px system-ui;color:#888;display:grid;place-items:center;height:100vh;margin:0'>Your page will appear here</body>"; }
}

function updatePublishEnabled() {
  const state = $("name-state").dataset.state;
  $("publish").disabled = !$("html").value.trim() || !slug($("site-name").value) || (!editing && state === "invalid");
}

let checkTimer = 0;
$("site-name").addEventListener("input", () => {
  if (editing) return;
  const s = slug($("site-name").value);
  $("url-preview").textContent = s ? liveUrl(s) : `${location.host}/${me.user}/…`;
  const state = $("name-state");
  state.textContent = "";
  state.dataset.state = "";
  clearTimeout(checkTimer);
  if (!s) return updatePublishEnabled();
  checkTimer = setTimeout(async () => {
    try {
      const r = await api("GET", `action=check&site=${encodeURIComponent($("site-name").value)}`);
      if (slug($("site-name").value) !== r.site) return; // stale answer
      state.dataset.state = r.state;
      state.className = `state ${r.state === "available" ? "ok" : r.state === "exists" ? "warn" : "bad"}`;
      state.textContent = (r.state === "available" ? "✓ " : r.state === "exists" ? "● " : "✗ ") + r.message;
    } catch { /* the publish itself will report any problem */ }
    updatePublishEnabled();
  }, 300);
  updatePublishEnabled();
});

let previewTimer = 0;
$("html").addEventListener("input", () => {
  updatePublishEnabled();
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => setPreview($("html").value.trim() ? $("html").value : "", editing ? liveUrl(editing) : null), 400);
});

async function takeFile(file) {
  if (!file) return;
  if (/\.zip$/i.test(file.name)) {
    return setMsg("err", "That's a zip file. In Claude Design, ask for an \"HTML5 single file\" and upload that instead.");
  }
  setMsg(null);
  $("html").value = await file.text();
  $("file-name").textContent = file.name;
  $("html").dispatchEvent(new Event("input"));
}
$("file").addEventListener("change", (e) => takeFile(e.target.files[0]));
const drop = $("drop");
for (const t of ["dragenter", "dragover"]) drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add("over"); });
for (const t of ["dragleave", "drop"]) drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove("over"); });
drop.addEventListener("drop", (e) => takeFile(e.dataTransfer.files[0]));

for (const b of document.querySelectorAll(".seg button")) {
  b.addEventListener("click", () => {
    document.querySelectorAll(".seg button").forEach((x) => x.classList.toggle("on", x === b));
    $("frame").className = `frame ${b.dataset.size}`;
  });
}

/* ---------- publishing, waiting for the site, versions ---------- */

async function fetchLive(url) {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? await r.text() : null;
  } catch { return null; }
}

function linkMsg(prefix, url, suffix = "") {
  return [`${prefix} `, el("a", { href: url, target: "_blank", rel: "noopener" }, url), suffix];
}

// The site rebuilds after each publish. Check the link every few seconds until it shows the change.
async function waitForLive(url, isLive, doneText) {
  const mine = ++pollToken;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, i < 3 ? 5000 : 8000));
    if (mine !== pollToken) return;
    const text = await fetchLive(url);
    if (text !== null && isLive(text)) return setMsg("ok", ...linkMsg(doneText, url));
  }
  if (mine === pollToken) setMsg("ok", ...linkMsg("It should be live by now:", url, " (if it looks old, refresh in a minute)."));
}

$("edit-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const html = $("html").value;
  const btn = $("publish");
  btn.disabled = true;
  setMsg("wait", "Publishing…");
  try {
    const r = await api("POST", "", { action: "publish", site: $("site-name").value, html, note: $("note").value });
    editing = r.site;
    setMsg("wait", ...linkMsg(`${r.message} It will be live in about 2 minutes:`, r.url));
    $("site-name").readOnly = true;
    $("url-preview").textContent = r.url;
    $("name-state").textContent = "";
    $("versions-wrap").hidden = false;
    $("note").value = "";
    loadVersions();
    waitForLive(r.url, (t) => t.trim() === html.trim(), "Live now:");
  } catch (err) {
    setMsg("err", err.message);
  }
  btn.disabled = false;
});

async function loadVersions() {
  const list = $("versions");
  list.replaceChildren(el("li", { class: "when" }, "Loading…"));
  try {
    const { versions } = await api("GET", `action=versions&site=${encodeURIComponent(editing)}`);
    list.replaceChildren(...versions.map((v) =>
      el("li", {},
        el("div", { class: "what" },
          el("div", {}, v.restored ? "Restored an earlier version" : v.note || "Update"),
          el("div", { class: "when" }, new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }))),
        v.current
          ? el("span", { class: "badge" }, "Latest")
          : el("button", { class: "ghost", type: "button", onclick: () => restore(v) }, "Restore"))));
    if (!versions.length) list.replaceChildren(el("li", { class: "when" }, "No versions yet."));
  } catch (err) {
    list.replaceChildren(el("li", { class: "when" }, err.message));
  }
}

async function restore(v) {
  if (!confirm("Make this the live version? Your newer versions stay in the list.")) return;
  setMsg("wait", "Restoring…");
  try {
    const url = liveUrl(editing);
    const before = await fetchLive(url);
    const r = await api("POST", "", { action: "restore", site: editing, sha: v.sha });
    setMsg("wait", ...linkMsg("Restored. It will be live in about 2 minutes:", r.url));
    loadVersions();
    waitForLive(r.url, (t) => t.trim() !== (before || "").trim(), "Live now:");
  } catch (err) {
    setMsg("err", err.message);
  }
}

boot();
