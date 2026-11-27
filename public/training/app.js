// integrations/training-companion/ui/library.js
function createLibrary({ app: app2, rpc: rpc2, escape: escape2, toast: toast2, navigate: navigate2, render: render2, persist: persist2, addToWorkout }) {
  let rows = [], total = 0, nextOffset = null, query = "", offset = 0, current = null, draft = null, intent = null, busy2 = false, error2 = "", loaded = false, conflict = false;
  const blank = () => ({ name: "", aliases: [], equipment: [], muscles: [], instructions: "", variations: [], images: [] });
  const guidance = (e3) => e3 ? `<div class="exercise-guidance">${e3.instructions ? `<p class="text-note">${escape2(e3.instructions)}</p>` : ""}${e3.equipment?.length ? `<p><strong>Equipment:</strong> ${escape2(e3.equipment.join(", "))}</p>` : ""}${e3.muscles?.length ? `<p><strong>Muscles:</strong> ${escape2(e3.muscles.join(", "))}</p>` : ""}${e3.variations?.length ? `<p><strong>Variations:</strong> ${escape2(e3.variations.join(", "))}</p>` : ""}<div class="exercise-images">${(e3.images ?? []).map((image) => `<figure><img src="${escape2(image.dataUrl)}" alt="${escape2(image.caption)}" loading="lazy"><figcaption>${escape2(image.caption)}${image.source ? `<small>${escape2(image.source)}</small>` : ""}</figcaption></figure>`).join("")}</div></div>` : "";
  const button = (action, label, id = "") => `<button type="button" class="secondary small" data-library-action="${action}" data-id="${id}">${label}</button>`;
  const field = (key, label, value, multiline = false) => `<label class="field">${label}${multiline ? `<textarea name="${key}" maxlength="6000" rows="5">${escape2(value)}</textarea>` : `<input name="${key}" value="${escape2(value)}" ${key === "name" ? 'required maxlength="160"' : 'maxlength="3000"'}>`}</label>`;
  async function search() {
    const result = await rpc2("search_exercises", { query, offset, limit: 25 });
    rows = result.exercises;
    total = result.total;
    nextOffset = result.nextOffset;
    loaded = true;
  }
  function page(route) {
    if (route === "library/edit" && draft) return `<div class="narrow"><a class="back" href="#library">\u2190 Exercise library</a><div class="page-heading"><h1>${draft.id ? "Edit exercise" : "Add an exercise"}</h1></div><p class="help">Reusable guidance for your private library. Put workout-specific coaching in your plan.</p><form id="library-editor"><fieldset ${busy2 || intent ? "disabled" : ""}>${field("name", "Exercise name", draft.name)}${field("aliases", "Other names (comma separated)", draft.aliases.join(", "))}${field("equipment", "Equipment (comma separated)", draft.equipment.join(", "))}${field("muscles", "Muscles (comma separated)", draft.muscles.join(", "))}${field("instructions", "Form and instructions", draft.instructions, true)}${field("variations", "Variations (comma separated)", draft.variations.join(", "))}<h2>Instructional images</h2><p class="help">Up to four small images. Uploads are resized for this preview; keep your originals. Add a caption explaining what to look for.</p>${draft.images.map((image, i2) => `<section class="card"><img class="image-thumb" src="${escape2(image.dataUrl)}" alt="${escape2(image.caption)}"><label class="field">Caption<input data-image="${i2}" data-key="caption" value="${escape2(image.caption)}" required maxlength="500"></label><label class="field">Source or credit<input data-image="${i2}" data-key="source" value="${escape2(image.source)}" maxlength="500"></label>${button("remove-image", "Remove image", String(i2))}</section>`).join("")}<label class="field">Add an image<input id="library-image" type="file" accept="image/png,image/jpeg,image/webp" ${draft.images.length >= 4 ? "disabled" : ""}></label></fieldset>${error2 ? `<p class="inline-error" role="alert">${escape2(error2)}</p>` : ""}${conflict ? `<p class="notice">This exercise changed elsewhere. Your draft is kept. Copy any edits you want to keep before reloading.</p>${button("reload", "Discard edits and load latest", draft.id)}` : ""}<div class="actions"><button type="submit" ${busy2 || conflict ? "disabled" : ""}>${busy2 ? "Saving\u2026" : intent ? "Retry same save" : "Save exercise"}</button>${button("discard", "Discard library draft")}</div>${intent ? '<p class="help">An uncertain save is retained. Retry before changing the draft.</p>' : ""}</form></div>`;
    if (route.startsWith("library/") && current && route === "library/" + current.id) return `<div class="narrow"><a class="back" href="#library">\u2190 Exercise library</a><div class="page-heading"><div><div class="eyebrow">Private exercise \xB7 revision ${current.revision}</div><h1>${escape2(current.name)}</h1><p>${escape2(current.aliases.join(" \xB7 "))}</p></div></div><div class="actions">${button("use", "Add to workout", current.id)}${button("edit", "Edit guidance", current.id)}</div>${guidance(current)}<p class="save-status">Changes here apply to future selections. Saved workouts keep their existing guidance.</p></div>`;
    return `<div class="page-heading"><div><div class="eyebrow">Your movement collection</div><h1>Exercise library</h1><p>Build once. Reuse and refine as you train.</p></div>${button("new", "\uFF0B New exercise")}</div>${draft ? `<div class="notice">An exercise draft is waiting. ${button("resume", "Continue editing")}</div>` : ""}<form id="library-search" class="actions"><label class="field">Search names, equipment or muscles<input name="query" value="${escape2(query)}" maxlength="160" placeholder="e.g. dumbbell or legs"></label><button type="submit" ${busy2 ? "disabled" : ""}>Search</button>${button("refresh", "Refresh")}</form>${error2 ? `<p class="inline-error" role="alert">${escape2(error2)}</p>` : ""}<p class="help">${loaded ? `${total} matching ${total === 1 ? "exercise" : "exercises"} \xB7 private to your account` : "Open search to load your library."}</p><div class="plan-list">${rows.map((e3) => `<article class="workout-card"><div class="eyebrow">${escape2(e3.equipment.join(" \xB7 ") || "Equipment not specified")}</div><h3>${escape2(e3.name)}</h3><p>${escape2(e3.muscles.join(" \xB7 ") || "Muscles not specified")}</p><div class="actions">${button("view", "View guidance", e3.id)}${button("use", "Add to workout", e3.id)}</div></article>`).join("") || '<div class="empty">No matching exercises yet. Add one here or ask your connected assistant to create it.</div>'}</div><div class="actions">${offset ? button("previous", "\u2190 Previous") : ""}${nextOffset !== null ? button("next", "Next \u2192") : ""}</div>`;
  }
  async function hydrate(route) {
    if (!route.startsWith("library")) return;
    try {
      if (route === "library" || route === "library/edit") {
        if (!loaded) await search();
      } else current = await rpc2("get_exercise", { id: route.slice(8) });
    } catch (e3) {
      error2 = e3.message;
    }
    render2();
  }
  async function open() {
    if (busy2) return;
    busy2 = true;
    try {
      if (!loaded) await search();
      navigate2("library");
    } catch (e3) {
      error2 = e3.message;
    } finally {
      busy2 = false;
      render2();
    }
  }
  async function makeDraft(name = "") {
    if (draft) {
      toast2("Finish your existing exercise draft first.");
    } else {
      draft = { ...blank(), name };
      intent = null;
      conflict = false;
    }
    persist2();
    navigate2("library/edit");
  }
  function capture(form) {
    for (const key of ["name", "instructions"]) draft[key] = form.elements[key].value;
    for (const key of ["aliases", "equipment", "muscles", "variations"]) draft[key] = form.elements[key].value.split(",").map((x2) => x2.trim()).filter(Boolean);
  }
  app2.addEventListener("input", (event) => {
    if (event.target.closest("#library-editor") && draft && !intent && !busy2) {
      if (event.target.dataset.image !== void 0) draft.images[Number(event.target.dataset.image)][event.target.dataset.key] = event.target.value;
      else capture(event.target.form);
      persist2();
    }
  });
  app2.addEventListener("change", async (event) => {
    if (event.target.id !== "library-image" || busy2 || intent) return;
    const file = event.target.files[0];
    if (!file) return;
    busy2 = true;
    render2();
    try {
      if (file.size > 12e6 || !["image/png", "image/jpeg", "image/webp"].includes(file.type)) throw Error("Choose a PNG, JPEG or WebP smaller than 12 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 640 / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      let dataUrl;
      for (const quality of [0.8, 0.6, 0.4, 0.2]) {
        dataUrl = canvas.toDataURL("image/webp", quality);
        if (dataUrl.length <= 24e3) break;
      }
      if (dataUrl.length > 24e3) throw Error("That image is too detailed for the preview limit. Choose a smaller illustration.");
      draft.images.push({ dataUrl, caption: "", source: "" });
      persist2();
    } catch (e3) {
      error2 = e3.message;
    } finally {
      busy2 = false;
      render2();
    }
  });
  app2.addEventListener("click", async (event) => {
    const el = event.target.closest("[data-library-action]");
    if (!el || busy2) return;
    const { libraryAction: action, id } = el.dataset;
    error2 = "";
    busy2 = true;
    try {
      if (action === "new") await makeDraft();
      else if (action === "resume") navigate2("library/edit");
      else if (action === "discard") {
        if (intent) throw Error("Retry the pending save before discarding its draft.");
        draft = null;
        conflict = false;
        navigate2("library");
      } else if (action === "remove-image") {
        if (!intent) draft.images.splice(Number(id), 1);
      } else if (action === "refresh" || action === "next" || action === "previous") {
        offset = action === "next" ? nextOffset : action === "previous" ? Math.max(0, offset - 25) : 0;
        await search();
      } else if (action === "reload") {
        draft = await rpc2("get_exercise", { id });
        conflict = false;
      } else {
        current = await rpc2("get_exercise", { id });
        if (action === "view") navigate2("library/" + id);
        if (action === "edit") {
          if (draft) throw Error("Finish your existing exercise draft first.");
          draft = structuredClone(current);
          conflict = false;
          navigate2("library/edit");
        }
        if (action === "use") addToWorkout(current);
      }
    } catch (e3) {
      error2 = e3.message;
      toast2(e3.message);
    } finally {
      busy2 = false;
      persist2();
      render2();
    }
  });
  app2.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!["library-search", "library-editor"].includes(form.id)) return;
    event.preventDefault();
    if (busy2) return;
    error2 = "";
    busy2 = true;
    try {
      if (form.id === "library-search") {
        query = new FormData(form).get("query");
        offset = 0;
        await search();
      } else {
        if (!intent) {
          capture(form);
          const { id, revision, updatedAt, ...exercise } = draft;
          intent = { name: id ? "update_exercise" : "create_exercise", args: { operationId: crypto.randomUUID(), ...id ? { id, expectedRevision: revision } : {}, exercise } };
          persist2();
        }
        render2();
        const receipt = await rpc2(intent.name, intent.args);
        current = receipt.exercise;
        draft = null;
        intent = null;
        conflict = false;
        persist2();
        await search();
        navigate2("library/" + current.id);
        toast2("Exercise saved");
      }
    } catch (e3) {
      error2 = e3.message;
      if (e3.status && e3.status < 500) {
        intent = null;
        conflict = e3.code === "revision_conflict";
      }
      toast2(e3.message);
    } finally {
      busy2 = false;
      persist2();
      render2();
    }
  });
  return { page, guidance, open, hydrate, makeDraft, serialize: () => ({ draft, intent }), restore: (value) => {
    draft = value?.draft ?? null;
    intent = value?.intent ?? null;
  }, clear: () => {
    error2 = "";
    conflict = false;
    rows = [];
    current = null;
    draft = null;
    intent = null;
    loaded = false;
    query = "";
    offset = 0;
    total = 0;
    nextOffset = null;
  }, isBusy: () => busy2 };
}

// integrations/training-companion/ui/session.js
var clone = (v2) => JSON.parse(JSON.stringify(v2));
function createSession(workout, date) {
  const queue = workout.exercises.flatMap((exercise, ei2) => exercise.sets.map((set, si2) => ({ ei: ei2, si: si2, name: exercise.name, definition: clone(Object.fromEntries(Object.entries(exercise).filter(([k2]) => k2 !== "sets"))), target: clone(set), actual: null, skipped: false })));
  if (!queue.length) throw Error("Add at least one set before starting.");
  return { title: workout.title, date, notes: "", queue, index: 0, timer: null, restSeconds: 60, timedRestSeconds: 0, autoAdvance: true, sound: true, keepAwake: true, startedAt: (/* @__PURE__ */ new Date()).toISOString(), operationId: crypto.randomUUID(), pending: null };
}
var remaining = (timer, now) => timer ? Math.max(0, timer.running ? (timer.deadline - now) / 1e3 : timer.remaining) : 0;
function startTimer(session2, kind, seconds, now) {
  session2.timer = { kind, running: true, remaining: seconds, deadline: now + seconds * 1e3, lastTick: now };
}
function pauseTimer(session2, now) {
  if (session2.timer?.running) {
    session2.timer.remaining = remaining(session2.timer, now);
    session2.timer.running = false;
  }
}
function resumeTimer(session2, now) {
  const t2 = session2.timer;
  if (t2) {
    t2.deadline = now + t2.remaining * 1e3;
    t2.lastTick = now;
    t2.running = true;
  }
}
function finishSet(session2, actual, now) {
  const step = session2.queue[session2.index];
  if (!step) return;
  step.actual = clone(actual);
  session2.index++;
  session2.timer = null;
  if (session2.index >= session2.queue.length) return;
  const next = session2.queue[session2.index];
  const rest = step.target.seconds > 0 ? session2.timedRestSeconds : session2.restSeconds;
  if (rest > 0) startTimer(session2, "rest", rest, now);
  else if (session2.autoAdvance && next.target.seconds > 0) startTimer(session2, "exercise", next.target.seconds, now);
}
function afterRest(session2, now) {
  session2.timer = null;
  const next = session2.queue[session2.index];
  if (session2.autoAdvance && next?.target.seconds > 0) startTimer(session2, "exercise", next.target.seconds, now);
}
function tick(session2, now) {
  const t2 = session2.timer;
  if (!t2?.running) return null;
  if (now - t2.lastTick > 5e3) {
    t2.remaining = Math.max(0, (t2.deadline - t2.lastTick) / 1e3);
    t2.running = false;
    return "suspended";
  }
  t2.lastTick = now;
  if (now < t2.deadline) return null;
  if (t2.kind === "rest") {
    afterRest(session2, now);
    return "rest-ended";
  }
  const actual = clone(session2.queue[session2.index].target);
  actual.reps = null;
  finishSet(session2, actual, now);
  return "set-ended";
}
function completedWorkout(session2) {
  const exercises = [];
  for (const step of session2.queue) {
    if (!step.actual) continue;
    let e3 = exercises.find((e4) => e4.ei === step.ei);
    if (!e3) {
      e3 = { ...clone(step.definition ?? {}), ei: step.ei, name: step.name, sets: [] };
      exercises.push(e3);
    }
    e3.sets.push(clone(step.actual));
  }
  if (!exercises.length) throw Error("Log at least one set before saving a session.");
  return { title: session2.title, status: "completed", date: session2.date, notes: session2.notes, exercises: exercises.map(({ ei: ei2, ...e3 }) => e3) };
}

// integrations/training-companion/ui/auth-session.js
var sessionHintKey = "rr-training-authenticated-tab-v1";
var recoverable = /* @__PURE__ */ new Set(["login_required", "consent_required", "missing_refresh_token", "interaction_required"]);
async function restoreSession(client2, { search, hash = "", storage, replace }) {
  const readHint = () => {
    try {
      return storage.getItem(sessionHintKey) === "1";
    } catch {
      return false;
    }
  };
  const hint = (value) => {
    try {
      if (value) storage.setItem(sessionHintKey, "1");
      else storage.removeItem(sessionHintKey);
    } catch {
    }
  };
  const params = new URLSearchParams(search);
  if (params.has("state") && (params.has("code") || params.has("error"))) {
    hint(false);
    let result;
    try {
      result = await client2.handleRedirectCallback();
      await client2.getTokenSilently();
      hint(true);
    } finally {
      const route = result?.appState?.returnHash;
      replace("/training/" + (typeof route === "string" && /^#[a-zA-Z0-9/_-]*$/.test(route) ? route : ""));
    }
    return { redirecting: false };
  }
  try {
    await client2.getTokenSilently();
    hint(true);
    return { redirecting: false };
  } catch (e3) {
    if (!recoverable.has(e3.error)) throw e3;
    if (!readHint()) return { redirecting: false };
    hint(false);
    await client2.loginWithRedirect({ authorizationParams: { prompt: "none" }, appState: { returnHash: hash } });
    return { redirecting: true };
  }
}
function clearSessionHint(storage) {
  try {
    storage.removeItem(sessionHintKey);
  } catch {
  }
}

// integrations/training-companion/node_modules/@auth0/auth0-spa-js/dist/auth0-spa-js.production.esm.js
function e(e3, t2) {
  var n2 = {};
  for (var o2 in e3) Object.prototype.hasOwnProperty.call(e3, o2) && t2.indexOf(o2) < 0 && (n2[o2] = e3[o2]);
  if (null != e3 && "function" == typeof Object.getOwnPropertySymbols) {
    var i2 = 0;
    for (o2 = Object.getOwnPropertySymbols(e3); i2 < o2.length; i2++) t2.indexOf(o2[i2]) < 0 && Object.prototype.propertyIsEnumerable.call(e3, o2[i2]) && (n2[o2[i2]] = e3[o2[i2]]);
  }
  return n2;
}
function t(e3, t2, n2, o2) {
  if ("a" === n2 && !o2) throw new TypeError("Private accessor was defined without a getter");
  if ("function" == typeof t2 ? e3 !== t2 || !o2 : !t2.has(e3)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return "m" === n2 ? o2 : "a" === n2 ? o2.call(e3) : o2 ? o2.value : t2.get(e3);
}
function n(e3, t2, n2, o2, i2) {
  if ("m" === o2) throw new TypeError("Private method is not writable");
  if ("a" === o2 && !i2) throw new TypeError("Private accessor was defined without a setter");
  if ("function" == typeof t2 ? e3 !== t2 || !i2 : !t2.has(e3)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return "a" === o2 ? i2.call(e3, n2) : i2 ? i2.value = n2 : t2.set(e3, n2), n2;
}
function o(e3, t2) {
  this.v = e3, this.k = t2;
}
function i(e3, t2) {
  (null == t2 || t2 > e3.length) && (t2 = e3.length);
  for (var n2 = 0, o2 = Array(t2); n2 < t2; n2++) o2[n2] = e3[n2];
  return o2;
}
function r(e3, t2, n2) {
  if ("function" == typeof e3 ? e3 === t2 : e3.has(t2)) return arguments.length < 3 ? t2 : n2;
  throw new TypeError("Private element is not present on this object");
}
function s(e3) {
  return new o(e3, 0);
}
function a(e3, t2) {
  if (t2.has(e3)) throw new TypeError("Cannot initialize the same private elements twice on an object");
}
function c(e3, t2) {
  return e3.get(r(e3, t2));
}
function u(e3, t2, n2) {
  a(e3, t2), t2.set(e3, n2);
}
function l(e3, t2, n2) {
  return e3.set(r(e3, t2), n2), n2;
}
function d(e3, t2) {
  a(e3, t2), t2.add(e3);
}
function h(e3, t2, n2) {
  return (t2 = (function(e4) {
    var t3 = (function(e5, t4) {
      if ("object" != typeof e5 || !e5) return e5;
      var n3 = e5[Symbol.toPrimitive];
      if (void 0 !== n3) {
        var o2 = n3.call(e5, t4 || "default");
        if ("object" != typeof o2) return o2;
        throw new TypeError("@@toPrimitive must return a primitive value.");
      }
      return ("string" === t4 ? String : Number)(e5);
    })(e4, "string");
    return "symbol" == typeof t3 ? t3 : t3 + "";
  })(t2)) in e3 ? Object.defineProperty(e3, t2, { value: n2, enumerable: true, configurable: true, writable: true }) : e3[t2] = n2, e3;
}
function p(e3, t2) {
  var n2 = Object.keys(e3);
  if (Object.getOwnPropertySymbols) {
    var o2 = Object.getOwnPropertySymbols(e3);
    t2 && (o2 = o2.filter(function(t3) {
      return Object.getOwnPropertyDescriptor(e3, t3).enumerable;
    })), n2.push.apply(n2, o2);
  }
  return n2;
}
function f(e3) {
  for (var t2 = 1; t2 < arguments.length; t2++) {
    var n2 = null != arguments[t2] ? arguments[t2] : {};
    t2 % 2 ? p(Object(n2), true).forEach(function(t3) {
      h(e3, t3, n2[t3]);
    }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e3, Object.getOwnPropertyDescriptors(n2)) : p(Object(n2)).forEach(function(t3) {
      Object.defineProperty(e3, t3, Object.getOwnPropertyDescriptor(n2, t3));
    });
  }
  return e3;
}
function m(e3, t2) {
  if (null == e3) return {};
  var n2, o2, i2 = (function(e4, t3) {
    if (null == e4) return {};
    var n3 = {};
    for (var o3 in e4) if ({}.hasOwnProperty.call(e4, o3)) {
      if (-1 !== t3.indexOf(o3)) continue;
      n3[o3] = e4[o3];
    }
    return n3;
  })(e3, t2);
  if (Object.getOwnPropertySymbols) {
    var r2 = Object.getOwnPropertySymbols(e3);
    for (o2 = 0; o2 < r2.length; o2++) n2 = r2[o2], -1 === t2.indexOf(n2) && {}.propertyIsEnumerable.call(e3, n2) && (i2[n2] = e3[n2]);
  }
  return i2;
}
function y(e3, t2) {
  return (function(e4) {
    if (Array.isArray(e4)) return e4;
  })(e3) || (function(e4, t3) {
    var n2 = null == e4 ? null : "undefined" != typeof Symbol && e4[Symbol.iterator] || e4["@@iterator"];
    if (null != n2) {
      var o2, i2, r2, s2, a2 = [], c2 = true, u2 = false;
      try {
        if (r2 = (n2 = n2.call(e4)).next, 0 === t3) {
          if (Object(n2) !== n2) return;
          c2 = false;
        } else for (; !(c2 = (o2 = r2.call(n2)).done) && (a2.push(o2.value), a2.length !== t3); c2 = true) ;
      } catch (e5) {
        u2 = true, i2 = e5;
      } finally {
        try {
          if (!c2 && null != n2.return && (s2 = n2.return(), Object(s2) !== s2)) return;
        } finally {
          if (u2) throw i2;
        }
      }
      return a2;
    }
  })(e3, t2) || (function(e4, t3) {
    if (e4) {
      if ("string" == typeof e4) return i(e4, t3);
      var n2 = {}.toString.call(e4).slice(8, -1);
      return "Object" === n2 && e4.constructor && (n2 = e4.constructor.name), "Map" === n2 || "Set" === n2 ? Array.from(e4) : "Arguments" === n2 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n2) ? i(e4, t3) : void 0;
    }
  })(e3, t2) || (function() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  })();
}
function w(e3) {
  return function() {
    return new g(e3.apply(this, arguments));
  };
}
function g(e3) {
  var t2, n2;
  function i2(t3, n3) {
    try {
      var s2 = e3[t3](n3), a2 = s2.value, c2 = a2 instanceof o;
      Promise.resolve(c2 ? a2.v : a2).then(function(n4) {
        if (c2) {
          var o2 = "return" === t3 && a2.k ? t3 : "next";
          if (!a2.k || n4.done) return i2(o2, n4);
          n4 = e3[o2](n4).value;
        }
        r2(!!s2.done, n4);
      }, function(e4) {
        i2("throw", e4);
      });
    } catch (e4) {
      r2(2, e4);
    }
  }
  function r2(e4, o2) {
    2 === e4 ? t2.reject(o2) : t2.resolve({ value: o2, done: e4 }), (t2 = t2.next) ? i2(t2.key, t2.arg) : n2 = null;
  }
  this._invoke = function(e4, o2) {
    return new Promise(function(r3, s2) {
      var a2 = { key: e4, arg: o2, resolve: r3, reject: s2, next: null };
      n2 ? n2 = n2.next = a2 : (t2 = n2 = a2, i2(e4, o2));
    });
  }, "function" != typeof e3.return && (this.return = void 0);
}
"function" == typeof SuppressedError && SuppressedError, g.prototype["function" == typeof Symbol && Symbol.asyncIterator || "@@asyncIterator"] = function() {
  return this;
}, g.prototype.next = function(e3) {
  return this._invoke("next", e3);
}, g.prototype.throw = function(e3) {
  return this._invoke("throw", e3);
}, g.prototype.return = function(e3) {
  return this._invoke("return", e3);
};
var v = { timeoutInSeconds: 60 };
var b = 1e4;
var _ = "memory";
var k = "Multifactor authentication required";
var S = "online_access";
var T = { name: "auth0-spa-js", version: "2.30.0" };
var P = () => Date.now();
var C = "default";
var E = class _E extends Error {
  constructor(e3, t2, n2) {
    super(t2), this.error = e3, this.error_description = t2, this.data = n2, Object.setPrototypeOf(this, _E.prototype);
  }
  static fromPayload(e3) {
    let t2 = e3.error, n2 = e3.error_description;
    return new _E(t2, n2);
  }
};
var R = class _R extends E {
  constructor(e3, t2) {
    super("invalid_configuration", "".concat(e3, " ").concat(t2)), this.suggestion = t2, Object.setPrototypeOf(this, _R.prototype);
  }
};
var A = class _A extends E {
  constructor(e3, t2, n2) {
    let o2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : null;
    super(e3, t2), this.state = n2, this.appState = o2, Object.setPrototypeOf(this, _A.prototype);
  }
};
var x = class _x extends E {
  constructor(e3, t2, n2, o2) {
    let i2 = arguments.length > 4 && void 0 !== arguments[4] ? arguments[4] : null;
    super(e3, t2), this.connection = n2, this.state = o2, this.appState = i2, Object.setPrototypeOf(this, _x.prototype);
  }
};
var I = class _I extends E {
  constructor() {
    super("timeout", "Timeout"), Object.setPrototypeOf(this, _I.prototype);
  }
};
var O = class _O extends I {
  constructor(e3) {
    super(), this.popup = e3, Object.setPrototypeOf(this, _O.prototype);
  }
};
var j = class _j extends E {
  constructor(e3) {
    super("cancelled", "Popup closed"), this.popup = e3, Object.setPrototypeOf(this, _j.prototype);
  }
};
var W = class _W extends E {
  constructor() {
    super("popup_open", "Unable to open a popup for loginWithPopup - window.open returned `null`"), Object.setPrototypeOf(this, _W.prototype);
  }
};
var N = class _N extends E {
  constructor(e3, t2, n2, o2) {
    super(e3, t2), this.mfa_token = n2, this.mfa_requirements = o2, Object.setPrototypeOf(this, _N.prototype);
  }
};
var M = class _M extends E {
  constructor(e3) {
    super("verification_required", "Identifier verification is required before passkey creation. Collect OTP codes for each identifier and call passkey.continueSignup()."), this.verificationRequired = e3, Object.setPrototypeOf(this, _M.prototype);
  }
};
var U = class _U extends E {
  constructor(e3, t2) {
    super("missing_refresh_token", "Missing Refresh Token (audience: '".concat(z(e3, ["default"]), "', scope: '").concat(z(t2), "')")), this.audience = e3, this.scope = t2, Object.setPrototypeOf(this, _U.prototype);
  }
};
var L = class _L extends E {
  constructor(e3, t2) {
    super("missing_scopes", "Missing requested scopes after refresh (audience: '".concat(z(e3, ["default"]), "', missing scope: '").concat(z(t2), "')")), this.audience = e3, this.scope = t2, Object.setPrototypeOf(this, _L.prototype);
  }
};
var K = class _K extends E {
  constructor(e3) {
    super("use_dpop_nonce", "Server rejected DPoP proof: wrong nonce"), this.newDpopNonce = e3, Object.setPrototypeOf(this, _K.prototype);
  }
};
function z(e3) {
  return e3 && !(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : []).includes(e3) ? e3 : "";
}
var J = () => window.crypto;
var D = () => {
  const e3 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_~.";
  let t2 = "";
  for (; t2.length < 43; ) {
    const n2 = J().getRandomValues(new Uint8Array(43 - t2.length));
    for (const o2 of n2) t2.length < 43 && o2 < 198 && (t2 += e3[o2 % 66]);
  }
  return t2;
};
var H = (e3) => btoa(e3);
var Z = [{ key: "name", type: ["string"] }, { key: "version", type: ["string", "number"] }, { key: "env", type: ["object"] }];
var F = function(e3) {
  let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
  return Object.keys(e3).reduce((n2, o2) => {
    if (t2 && "env" === o2) return n2;
    const i2 = Z.find((e4) => e4.key === o2);
    return i2 && i2.type.includes(typeof e3[o2]) && (n2[o2] = e3[o2]), n2;
  }, {});
};
var V = (t2) => {
  var n2 = t2.clientId, o2 = e(t2, ["clientId"]);
  return new URLSearchParams(((e3) => Object.keys(e3).filter((t3) => void 0 !== e3[t3]).reduce((t3, n3) => Object.assign(Object.assign({}, t3), { [n3]: e3[n3] }), {}))(Object.assign({ client_id: n2 }, o2))).toString();
};
var X = async (e3) => {
  const t2 = J().subtle.digest({ name: "SHA-256" }, new TextEncoder().encode(e3));
  return await t2;
};
var G = (e3) => ((e4) => decodeURIComponent(atob(e4).split("").map((e5) => "%" + ("00" + e5.charCodeAt(0).toString(16)).slice(-2)).join("")))(e3.replace(/_/g, "/").replace(/-/g, "+"));
var q = (e3) => {
  const t2 = new Uint8Array(e3);
  return ((e4) => {
    const t3 = { "+": "-", "/": "_", "=": "" };
    return e4.replace(/[+/=]/g, (e5) => t3[e5]);
  })(window.btoa(String.fromCharCode(...Array.from(t2))));
};
var Y = (e3) => {
  if ("string" != typeof e3) return e3;
  const t2 = parseInt(e3, 10);
  return isNaN(t2) ? void 0 : t2;
};
var B = "undefined" != typeof globalThis ? globalThis : "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : {};
var Q = {};
var $ = {};
Object.defineProperty($, "__esModule", { value: true });
var ee = (function() {
  function e3() {
    var e4 = this;
    this.locked = /* @__PURE__ */ new Map(), this.addToLocked = function(t2, n2) {
      var o2 = e4.locked.get(t2);
      void 0 === o2 ? void 0 === n2 ? e4.locked.set(t2, []) : e4.locked.set(t2, [n2]) : void 0 !== n2 && (o2.unshift(n2), e4.locked.set(t2, o2));
    }, this.isLocked = function(t2) {
      return e4.locked.has(t2);
    }, this.lock = function(t2) {
      return new Promise(function(n2, o2) {
        e4.isLocked(t2) ? e4.addToLocked(t2, n2) : (e4.addToLocked(t2), n2());
      });
    }, this.unlock = function(t2) {
      var n2 = e4.locked.get(t2);
      if (void 0 !== n2 && 0 !== n2.length) {
        var o2 = n2.pop();
        e4.locked.set(t2, n2), void 0 !== o2 && setTimeout(o2, 0);
      } else e4.locked.delete(t2);
    };
  }
  return e3.getInstance = function() {
    return void 0 === e3.instance && (e3.instance = new e3()), e3.instance;
  }, e3;
})();
$.default = function() {
  return ee.getInstance();
};
var te = B && B.__awaiter || function(e3, t2, n2, o2) {
  return new (n2 || (n2 = Promise))(function(i2, r2) {
    function s2(e4) {
      try {
        c2(o2.next(e4));
      } catch (e5) {
        r2(e5);
      }
    }
    function a2(e4) {
      try {
        c2(o2.throw(e4));
      } catch (e5) {
        r2(e5);
      }
    }
    function c2(e4) {
      e4.done ? i2(e4.value) : new n2(function(t3) {
        t3(e4.value);
      }).then(s2, a2);
    }
    c2((o2 = o2.apply(e3, t2 || [])).next());
  });
};
var ne = B && B.__generator || function(e3, t2) {
  var n2, o2, i2, r2, s2 = { label: 0, sent: function() {
    if (1 & i2[0]) throw i2[1];
    return i2[1];
  }, trys: [], ops: [] };
  return r2 = { next: a2(0), throw: a2(1), return: a2(2) }, "function" == typeof Symbol && (r2[Symbol.iterator] = function() {
    return this;
  }), r2;
  function a2(r3) {
    return function(a3) {
      return (function(r4) {
        if (n2) throw new TypeError("Generator is already executing.");
        for (; s2; ) try {
          if (n2 = 1, o2 && (i2 = 2 & r4[0] ? o2.return : r4[0] ? o2.throw || ((i2 = o2.return) && i2.call(o2), 0) : o2.next) && !(i2 = i2.call(o2, r4[1])).done) return i2;
          switch (o2 = 0, i2 && (r4 = [2 & r4[0], i2.value]), r4[0]) {
            case 0:
            case 1:
              i2 = r4;
              break;
            case 4:
              return s2.label++, { value: r4[1], done: false };
            case 5:
              s2.label++, o2 = r4[1], r4 = [0];
              continue;
            case 7:
              r4 = s2.ops.pop(), s2.trys.pop();
              continue;
            default:
              if (!(i2 = s2.trys, (i2 = i2.length > 0 && i2[i2.length - 1]) || 6 !== r4[0] && 2 !== r4[0])) {
                s2 = 0;
                continue;
              }
              if (3 === r4[0] && (!i2 || r4[1] > i2[0] && r4[1] < i2[3])) {
                s2.label = r4[1];
                break;
              }
              if (6 === r4[0] && s2.label < i2[1]) {
                s2.label = i2[1], i2 = r4;
                break;
              }
              if (i2 && s2.label < i2[2]) {
                s2.label = i2[2], s2.ops.push(r4);
                break;
              }
              i2[2] && s2.ops.pop(), s2.trys.pop();
              continue;
          }
          r4 = t2.call(e3, s2);
        } catch (e4) {
          r4 = [6, e4], o2 = 0;
        } finally {
          n2 = i2 = 0;
        }
        if (5 & r4[0]) throw r4[1];
        return { value: r4[0] ? r4[1] : void 0, done: true };
      })([r3, a3]);
    };
  }
};
var oe = B;
Object.defineProperty(Q, "__esModule", { value: true });
var ie = $;
var re = "browser-tabs-lock-key";
var se = { key: function(e3) {
  return te(oe, void 0, void 0, function() {
    return ne(this, function(e4) {
      throw new Error("Unsupported");
    });
  });
}, getItem: function(e3) {
  return te(oe, void 0, void 0, function() {
    return ne(this, function(e4) {
      throw new Error("Unsupported");
    });
  });
}, clear: function() {
  return te(oe, void 0, void 0, function() {
    return ne(this, function(e3) {
      return [2, window.localStorage.clear()];
    });
  });
}, removeItem: function(e3) {
  return te(oe, void 0, void 0, function() {
    return ne(this, function(e4) {
      throw new Error("Unsupported");
    });
  });
}, setItem: function(e3, t2) {
  return te(oe, void 0, void 0, function() {
    return ne(this, function(e4) {
      throw new Error("Unsupported");
    });
  });
}, keySync: function(e3) {
  return window.localStorage.key(e3);
}, getItemSync: function(e3) {
  return window.localStorage.getItem(e3);
}, clearSync: function() {
  return window.localStorage.clear();
}, removeItemSync: function(e3) {
  return window.localStorage.removeItem(e3);
}, setItemSync: function(e3, t2) {
  return window.localStorage.setItem(e3, t2);
} };
function ae(e3) {
  return new Promise(function(t2) {
    return setTimeout(t2, e3);
  });
}
function ce(e3) {
  for (var t2 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz", n2 = "", o2 = 0; o2 < e3; o2++) {
    n2 += t2[Math.floor(61 * Math.random())];
  }
  return n2;
}
var ue = (function() {
  function e3(t2) {
    this.acquiredIatSet = /* @__PURE__ */ new Set(), this.storageHandler = void 0, this.id = Date.now().toString() + ce(15), this.acquireLock = this.acquireLock.bind(this), this.releaseLock = this.releaseLock.bind(this), this.releaseLock__private__ = this.releaseLock__private__.bind(this), this.waitForSomethingToChange = this.waitForSomethingToChange.bind(this), this.refreshLockWhileAcquired = this.refreshLockWhileAcquired.bind(this), this.storageHandler = t2, void 0 === e3.waiters && (e3.waiters = []);
  }
  return e3.prototype.acquireLock = function(t2, n2) {
    return void 0 === n2 && (n2 = 5e3), te(this, void 0, void 0, function() {
      var o2, i2, r2, s2, a2, c2, u2;
      return ne(this, function(l2) {
        switch (l2.label) {
          case 0:
            o2 = Date.now() + ce(4), i2 = Date.now() + n2, r2 = re + "-" + t2, s2 = void 0 === this.storageHandler ? se : this.storageHandler, l2.label = 1;
          case 1:
            return Date.now() < i2 ? [4, ae(30)] : [3, 8];
          case 2:
            return l2.sent(), null !== s2.getItemSync(r2) ? [3, 5] : (a2 = this.id + "-" + t2 + "-" + o2, [4, ae(Math.floor(25 * Math.random()))]);
          case 3:
            return l2.sent(), s2.setItemSync(r2, JSON.stringify({ id: this.id, iat: o2, timeoutKey: a2, timeAcquired: Date.now(), timeRefreshed: Date.now() })), [4, ae(30)];
          case 4:
            return l2.sent(), null !== (c2 = s2.getItemSync(r2)) && (u2 = JSON.parse(c2)).id === this.id && u2.iat === o2 ? (this.acquiredIatSet.add(o2), this.refreshLockWhileAcquired(r2, o2), [2, true]) : [3, 7];
          case 5:
            return e3.lockCorrector(void 0 === this.storageHandler ? se : this.storageHandler), [4, this.waitForSomethingToChange(i2)];
          case 6:
            l2.sent(), l2.label = 7;
          case 7:
            return o2 = Date.now() + ce(4), [3, 1];
          case 8:
            return [2, false];
        }
      });
    });
  }, e3.prototype.refreshLockWhileAcquired = function(e4, t2) {
    return te(this, void 0, void 0, function() {
      var n2 = this;
      return ne(this, function(o2) {
        return setTimeout(function() {
          return te(n2, void 0, void 0, function() {
            var n3, o3, i2;
            return ne(this, function(r2) {
              switch (r2.label) {
                case 0:
                  return [4, ie.default().lock(t2)];
                case 1:
                  return r2.sent(), this.acquiredIatSet.has(t2) ? (n3 = void 0 === this.storageHandler ? se : this.storageHandler, null === (o3 = n3.getItemSync(e4)) ? (ie.default().unlock(t2), [2]) : ((i2 = JSON.parse(o3)).timeRefreshed = Date.now(), n3.setItemSync(e4, JSON.stringify(i2)), ie.default().unlock(t2), this.refreshLockWhileAcquired(e4, t2), [2])) : (ie.default().unlock(t2), [2]);
              }
            });
          });
        }, 1e3), [2];
      });
    });
  }, e3.prototype.waitForSomethingToChange = function(t2) {
    return te(this, void 0, void 0, function() {
      return ne(this, function(n2) {
        switch (n2.label) {
          case 0:
            return [4, new Promise(function(n3) {
              var o2 = false, i2 = Date.now(), r2 = false;
              function s2() {
                if (r2 || (window.removeEventListener("storage", s2), e3.removeFromWaiting(s2), clearTimeout(a2), r2 = true), !o2) {
                  o2 = true;
                  var t3 = 50 - (Date.now() - i2);
                  t3 > 0 ? setTimeout(n3, t3) : n3(null);
                }
              }
              window.addEventListener("storage", s2), e3.addToWaiting(s2);
              var a2 = setTimeout(s2, Math.max(0, t2 - Date.now()));
            })];
          case 1:
            return n2.sent(), [2];
        }
      });
    });
  }, e3.addToWaiting = function(t2) {
    this.removeFromWaiting(t2), void 0 !== e3.waiters && e3.waiters.push(t2);
  }, e3.removeFromWaiting = function(t2) {
    void 0 !== e3.waiters && (e3.waiters = e3.waiters.filter(function(e4) {
      return e4 !== t2;
    }));
  }, e3.notifyWaiters = function() {
    void 0 !== e3.waiters && e3.waiters.slice().forEach(function(e4) {
      return e4();
    });
  }, e3.prototype.releaseLock = function(e4) {
    return te(this, void 0, void 0, function() {
      return ne(this, function(t2) {
        switch (t2.label) {
          case 0:
            return [4, this.releaseLock__private__(e4)];
          case 1:
            return [2, t2.sent()];
        }
      });
    });
  }, e3.prototype.releaseLock__private__ = function(t2) {
    return te(this, void 0, void 0, function() {
      var n2, o2, i2, r2;
      return ne(this, function(s2) {
        switch (s2.label) {
          case 0:
            return n2 = void 0 === this.storageHandler ? se : this.storageHandler, o2 = re + "-" + t2, null === (i2 = n2.getItemSync(o2)) ? [2] : (r2 = JSON.parse(i2)).id !== this.id ? [3, 2] : [4, ie.default().lock(r2.iat)];
          case 1:
            s2.sent(), this.acquiredIatSet.delete(r2.iat), n2.removeItemSync(o2), ie.default().unlock(r2.iat), e3.notifyWaiters(), s2.label = 2;
          case 2:
            return [2];
        }
      });
    });
  }, e3.lockCorrector = function(t2) {
    for (var n2 = Date.now() - 5e3, o2 = t2, i2 = [], r2 = 0; ; ) {
      var s2 = o2.keySync(r2);
      if (null === s2) break;
      i2.push(s2), r2++;
    }
    for (var a2 = false, c2 = 0; c2 < i2.length; c2++) {
      var u2 = i2[c2];
      if (u2.includes(re)) {
        var l2 = o2.getItemSync(u2);
        if (null !== l2) {
          var d2 = JSON.parse(l2);
          (void 0 === d2.timeRefreshed && d2.timeAcquired < n2 || void 0 !== d2.timeRefreshed && d2.timeRefreshed < n2) && (o2.removeItemSync(u2), a2 = true);
        }
      }
    }
    a2 && e3.notifyWaiters();
  }, e3.waiters = void 0, e3;
})();
var le = Q.default = ue;
var de = class {
  async runWithLock(e3, t2, n2) {
    const o2 = new AbortController(), i2 = setTimeout(() => o2.abort(), t2);
    try {
      return await navigator.locks.request(e3, { mode: "exclusive", signal: o2.signal }, async (e4) => {
        if (clearTimeout(i2), !e4) throw new Error("Lock not available");
        return await n2();
      });
    } catch (e4) {
      if (clearTimeout(i2), o2.signal.aborted && "AbortError" === (null == e4 ? void 0 : e4.name)) throw new I();
      throw e4;
    }
  }
};
var he = class {
  constructor() {
    this.activeLocks = /* @__PURE__ */ new Set(), this.lock = new le(), this.pagehideHandler = () => {
      this.activeLocks.forEach((e3) => this.lock.releaseLock(e3)), this.activeLocks.clear();
    };
  }
  async runWithLock(e3, t2, n2) {
    let o2 = false;
    for (let n3 = 0; n3 < 10 && !o2; n3++) o2 = await this.lock.acquireLock(e3, t2);
    if (!o2) throw new I();
    this.activeLocks.add(e3), 1 === this.activeLocks.size && "undefined" != typeof window && window.addEventListener("pagehide", this.pagehideHandler);
    try {
      return await n2();
    } finally {
      this.activeLocks.delete(e3), await this.lock.releaseLock(e3), 0 === this.activeLocks.size && "undefined" != typeof window && window.removeEventListener("pagehide", this.pagehideHandler);
    }
  }
};
function pe() {
  return "undefined" != typeof navigator && "function" == typeof (null === (e3 = navigator.locks) || void 0 === e3 ? void 0 : e3.request) ? new de() : new he();
  var e3;
}
var fe = null;
function me() {
  return fe || (fe = pe()), fe;
}
var ye = {};
var we = new TextEncoder();
var ge = new TextDecoder();
function ve(e3) {
  return "string" == typeof e3 ? we.encode(e3) : ge.decode(e3);
}
function be(e3) {
  if ("number" != typeof e3.modulusLength || e3.modulusLength < 2048) throw new Pe(`${e3.name} modulusLength must be at least 2048 bits`);
}
async function _e(e3, t2, n2) {
  if (false === n2.usages.includes("sign")) throw new TypeError('private CryptoKey instances used for signing assertions must include "sign" in their "usages"');
  const o2 = `${Se(ve(JSON.stringify(e3)))}.${Se(ve(JSON.stringify(t2)))}`;
  return `${o2}.${Se(await crypto.subtle.sign((function(e4) {
    switch (e4.algorithm.name) {
      case "ECDSA":
        return { name: e4.algorithm.name, hash: "SHA-256" };
      case "RSA-PSS":
        return be(e4.algorithm), { name: e4.algorithm.name, saltLength: 32 };
      case "RSASSA-PKCS1-v1_5":
        return be(e4.algorithm), { name: e4.algorithm.name };
      case "Ed25519":
        return { name: e4.algorithm.name };
    }
    throw new Te();
  })(n2), n2, ve(o2)))}`;
}
var ke;
if (Uint8Array.prototype.toBase64) ke = (e3) => (e3 instanceof ArrayBuffer && (e3 = new Uint8Array(e3)), e3.toBase64({ alphabet: "base64url", omitPadding: true }));
else {
  const e3 = 32768;
  ke = (t2) => {
    t2 instanceof ArrayBuffer && (t2 = new Uint8Array(t2));
    const n2 = [];
    for (let o2 = 0; o2 < t2.byteLength; o2 += e3) n2.push(String.fromCharCode.apply(null, t2.subarray(o2, o2 + e3)));
    return btoa(n2.join("")).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
}
function Se(e3) {
  return ke(e3);
}
var Te = class extends Error {
  constructor(e3) {
    var t2;
    super(null != e3 ? e3 : "operation not supported"), this.name = this.constructor.name, null === (t2 = Error.captureStackTrace) || void 0 === t2 || t2.call(Error, this, this.constructor);
  }
};
var Pe = class extends Error {
  constructor(e3) {
    var t2;
    super(e3), this.name = this.constructor.name, null === (t2 = Error.captureStackTrace) || void 0 === t2 || t2.call(Error, this, this.constructor);
  }
};
function Ce(e3) {
  switch (e3.algorithm.name) {
    case "RSA-PSS":
      return (function(e4) {
        if ("SHA-256" === e4.algorithm.hash.name) return "PS256";
        throw new Te("unsupported RsaHashedKeyAlgorithm hash name");
      })(e3);
    case "RSASSA-PKCS1-v1_5":
      return (function(e4) {
        if ("SHA-256" === e4.algorithm.hash.name) return "RS256";
        throw new Te("unsupported RsaHashedKeyAlgorithm hash name");
      })(e3);
    case "ECDSA":
      return (function(e4) {
        if ("P-256" === e4.algorithm.namedCurve) return "ES256";
        throw new Te("unsupported EcKeyAlgorithm namedCurve");
      })(e3);
    case "Ed25519":
      return "Ed25519";
    default:
      throw new Te("unsupported CryptoKey algorithm name");
  }
}
function Ee(e3) {
  return e3 instanceof CryptoKey;
}
function Re(e3) {
  return Ee(e3) && "public" === e3.type;
}
async function Ae(e3, t2, n2, o2, i2, r2) {
  const s2 = null == e3 ? void 0 : e3.privateKey, a2 = null == e3 ? void 0 : e3.publicKey;
  if (!Ee(c2 = s2) || "private" !== c2.type) throw new TypeError('"keypair.privateKey" must be a private CryptoKey');
  var c2;
  if (!Re(a2)) throw new TypeError('"keypair.publicKey" must be a public CryptoKey');
  if (true !== a2.extractable) throw new TypeError('"keypair.publicKey.extractable" must be true');
  if ("string" != typeof t2) throw new TypeError('"htu" must be a string');
  if ("string" != typeof n2) throw new TypeError('"htm" must be a string');
  if (void 0 !== o2 && "string" != typeof o2) throw new TypeError('"nonce" must be a string or undefined');
  if (void 0 !== i2 && "string" != typeof i2) throw new TypeError('"accessToken" must be a string or undefined');
  if (void 0 !== r2 && ("object" != typeof r2 || null === r2 || Array.isArray(r2))) throw new TypeError('"additional" must be an object');
  const u2 = Object.assign(/* @__PURE__ */ Object.create(null), r2, { iat: Math.floor(Date.now() / 1e3), jti: crypto.randomUUID(), htm: n2, nonce: o2, htu: t2, ath: i2 ? Se(await crypto.subtle.digest("SHA-256", ve(i2))) : void 0 });
  return _e({ alg: Ce(s2), typ: "dpop+jwt", jwk: await xe(a2) }, u2, s2);
}
async function xe(e3) {
  const { kty: t2, e: n2, n: o2, x: i2, y: r2, crv: s2 } = await crypto.subtle.exportKey("jwk", e3);
  return { kty: t2, crv: s2, e: n2, n: o2, x: i2, y: r2 };
}
var Ie = "dpop-nonce";
var Oe = ["authorization_code", "refresh_token", "urn:ietf:params:oauth:grant-type:token-exchange", "urn:okta:params:oauth:grant-type:webauthn", "http://auth0.com/oauth/grant-type/mfa-oob", "http://auth0.com/oauth/grant-type/mfa-otp", "http://auth0.com/oauth/grant-type/mfa-recovery-code"];
function je() {
  return (async function(e3, t2) {
    var n2;
    let o2;
    if ("string" != typeof e3 || 0 === e3.length) throw new TypeError('"alg" must be a non-empty string');
    switch (e3) {
      case "PS256":
        o2 = { name: "RSA-PSS", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
        break;
      case "RS256":
        o2 = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]) };
        break;
      case "ES256":
        o2 = { name: "ECDSA", namedCurve: "P-256" };
        break;
      case "Ed25519":
        o2 = { name: "Ed25519" };
        break;
      default:
        throw new Te();
    }
    return crypto.subtle.generateKey(o2, null !== (n2 = null == t2 ? void 0 : t2.extractable) && void 0 !== n2 && n2, ["sign", "verify"]);
  })("ES256", { extractable: false });
}
function We(e3) {
  return (async function(e4) {
    if (!Re(e4)) throw new TypeError('"publicKey" must be a public CryptoKey');
    if (true !== e4.extractable) throw new TypeError('"publicKey.extractable" must be true');
    const t2 = await xe(e4);
    let n2;
    switch (t2.kty) {
      case "EC":
        n2 = { crv: t2.crv, kty: t2.kty, x: t2.x, y: t2.y };
        break;
      case "OKP":
        n2 = { crv: t2.crv, kty: t2.kty, x: t2.x };
        break;
      case "RSA":
        n2 = { e: t2.e, kty: t2.kty, n: t2.n };
        break;
      default:
        throw new Te("unsupported JWK kty");
    }
    return Se(await crypto.subtle.digest({ name: "SHA-256" }, ve(JSON.stringify(n2))));
  })(e3.publicKey);
}
function Ne(e3) {
  let t2 = e3.keyPair, n2 = e3.url, o2 = e3.method, i2 = e3.nonce, r2 = e3.accessToken;
  const s2 = (function(e4) {
    const t3 = new URL(e4);
    return t3.search = "", t3.hash = "", t3.href;
  })(n2);
  return Ae(t2, s2, o2, i2, r2);
}
var Me = (e3, t2) => new Promise(function(n2, o2) {
  const i2 = new MessageChannel();
  i2.port1.onmessage = function(e4) {
    e4.data.error ? o2(new Error(e4.data.error)) : n2(e4.data), i2.port1.close();
  }, t2.postMessage(e3, [i2.port2]);
});
var Ue = (e3, t2, n2) => {
  const o2 = new AbortController();
  let i2;
  return t2.signal = o2.signal, Promise.race([fetch(e3, t2), new Promise((e4, t3) => {
    i2 = setTimeout(() => {
      o2.abort(), t3(new Error("Timeout when executing 'fetch'"));
    }, n2);
  })]).finally(() => {
    clearTimeout(i2);
  });
};
var Le = async function(e3, t2, n2, o2, i2, r2) {
  let s2 = arguments.length > 6 && void 0 !== arguments[6] ? arguments[6] : b;
  return i2 ? (async (e4, t3, n3, o3, i3, r3, s3, a2, c2, u2) => Me({ type: "refresh", auth: { audience: t3, scope: n3 }, timeout: i3, fetchUrl: e4, fetchOptions: o3, useFormData: s3, useMrrt: a2, skipTokenStorage: c2, preserveRefreshToken: u2 }, r3))(e3, t2, n2, o2, s2, i2, r2, arguments.length > 7 ? arguments[7] : void 0, arguments.length > 8 ? arguments[8] : void 0, arguments.length > 9 ? arguments[9] : void 0) : (async (e4, t3, n3) => {
    const o3 = await Ue(e4, t3, n3);
    return { ok: o3.ok, json: await o3.json(), headers: (i3 = o3.headers, [...i3].reduce((e5, t4) => {
      let n4 = y(t4, 2), o4 = n4[0], i4 = n4[1];
      return e5[o4] = i4, e5;
    }, {})) };
    var i3;
  })(e3, o2, s2);
};
async function Ke(t2, n2, o2, i2, r2, s2, a2, c2, u2, l2, d2, h2) {
  if (u2) {
    const e3 = await u2.generateProof({ url: t2, method: r2.method || "GET", nonce: await u2.getNonce() });
    r2.headers = Object.assign(Object.assign({}, r2.headers), { dpop: e3 });
  }
  let p2, f2 = null;
  for (let e3 = 0; e3 < 3; e3++) try {
    p2 = await Le(t2, o2, i2, r2, s2, a2, n2, c2, d2, h2), f2 = null;
    break;
  } catch (e4) {
    f2 = e4;
  }
  if (f2) throw f2;
  const m2 = p2.json, y2 = m2.error, w2 = m2.error_description, g2 = e(m2, ["error", "error_description"]), v2 = p2, b2 = v2.headers, _2 = v2.ok;
  let k2;
  if (u2 && (k2 = b2[Ie], k2 && await u2.setNonce(k2)), !_2) {
    const e3 = w2 || "HTTP error. Unable to fetch ".concat(t2);
    if ("mfa_required" === y2) throw new N(y2, e3, g2.mfa_token, g2.mfa_requirements);
    if ("missing_refresh_token" === y2) throw new U(o2, i2);
    if ("use_dpop_nonce" === y2) {
      if (!u2 || !k2 || l2) throw new K(k2);
      return Ke(t2, n2, o2, i2, r2, s2, a2, c2, u2, true, d2, h2);
    }
    throw new E(y2 || "request_error", e3, g2);
  }
  return g2;
}
async function ze(t2, n2, o2) {
  var i2 = t2.baseUrl, r2 = t2.timeout, s2 = t2.audience, a2 = t2.scope, c2 = t2.auth0Client, u2 = t2.useFormData, l2 = t2.useMrrt, d2 = t2.dpop, h2 = t2.preserveRefreshToken, p2 = e(t2, ["baseUrl", "timeout", "audience", "scope", "auth0Client", "useFormData", "useMrrt", "dpop", "preserveRefreshToken"]);
  const f2 = "urn:ietf:params:oauth:grant-type:token-exchange" === p2.grant_type, m2 = "urn:okta:params:oauth:grant-type:webauthn" === p2.grant_type, y2 = "refresh_token" === p2.grant_type && l2, w2 = f2 || m2 || y2, g2 = Object.assign(Object.assign(Object.assign({}, p2), w2 && s2 && { audience: s2 }), w2 && a2 && { scope: a2 }), v2 = m2 || !u2, b2 = v2 ? JSON.stringify(g2) : V(g2), _2 = (k2 = p2.grant_type, Oe.includes(k2));
  var k2;
  return await Ke("".concat(i2, "/oauth/token"), r2, s2 || C, a2, { method: "POST", body: b2, headers: { "Content-Type": v2 ? "application/json" : "application/x-www-form-urlencoded", "Auth0-Client": btoa(JSON.stringify(F(c2 || T))) } }, n2, u2, l2, _2 ? d2 : void 0, void 0, o2, h2);
}
var Je = function() {
  for (var e3 = arguments.length, t2 = new Array(e3), n2 = 0; n2 < e3; n2++) t2[n2] = arguments[n2];
  return (o2 = t2.filter(Boolean).join(" ").trim().split(/\s+/), Array.from(new Set(o2))).join(" ");
  var o2;
};
var De = (e3, t2, n2) => {
  let o2;
  return n2 && (o2 = e3[n2]), o2 || (o2 = e3[C]), Je(o2, t2);
};
var He = "@@auth0spajs@@";
var Ze = "@@user@@";
var Fe = class _Fe {
  constructor(e3) {
    let t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : He, n2 = arguments.length > 2 ? arguments[2] : void 0;
    this.prefix = t2, this.suffix = n2, this.clientId = e3.clientId, this.scope = e3.scope, this.audience = e3.audience;
  }
  toKey() {
    return [this.prefix, this.clientId, this.audience, this.scope, this.suffix].filter(Boolean).join("::");
  }
  static fromKey(e3) {
    const t2 = y(e3.split("::"), 4), n2 = t2[0], o2 = t2[1], i2 = t2[2], r2 = t2[3];
    return new _Fe({ clientId: o2, scope: r2, audience: i2 }, n2);
  }
  static fromCacheEntry(e3) {
    const t2 = e3.scope, n2 = e3.audience, o2 = e3.client_id;
    return new _Fe({ scope: t2, audience: n2, clientId: o2 });
  }
};
var Ve = class {
  set(e3, t2) {
    localStorage.setItem(e3, JSON.stringify(t2));
  }
  get(e3) {
    const t2 = window.localStorage.getItem(e3);
    if (t2) try {
      return JSON.parse(t2);
    } catch (e4) {
      return;
    }
  }
  remove(e3) {
    localStorage.removeItem(e3);
  }
  allKeys() {
    return Object.keys(window.localStorage).filter((e3) => e3.startsWith(He));
  }
};
var Xe = class {
  constructor() {
    this.enclosedCache = /* @__PURE__ */ (function() {
      let e3 = {};
      return { set(t2, n2) {
        e3[t2] = n2;
      }, get(t2) {
        const n2 = e3[t2];
        if (n2) return n2;
      }, remove(t2) {
        delete e3[t2];
      }, allKeys: () => Object.keys(e3) };
    })();
  }
};
var Ge = class {
  constructor(e3, t2, n2) {
    this.cache = e3, this.keyManifest = t2, this.nowProvider = n2 || P;
  }
  async setIdToken(e3, t2, n2) {
    var o2;
    const i2 = this.getIdTokenCacheKey(e3);
    await this.cache.set(i2, { id_token: t2, decodedToken: n2 }), await (null === (o2 = this.keyManifest) || void 0 === o2 ? void 0 : o2.add(i2));
  }
  async getIdToken(e3) {
    const t2 = await this.cache.get(this.getIdTokenCacheKey(e3.clientId));
    if (!t2 && e3.scope && e3.audience) {
      const t3 = await this.get(e3);
      if (!t3) return;
      if (!t3.id_token || !t3.decodedToken) return;
      return { id_token: t3.id_token, decodedToken: t3.decodedToken };
    }
    if (t2) return { id_token: t2.id_token, decodedToken: t2.decodedToken };
  }
  async get(e3) {
    let t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 0, n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2], o2 = arguments.length > 3 ? arguments[3] : void 0;
    var i2;
    let r2 = await this.cache.get(e3.toKey()), s2 = e3;
    if (!r2) {
      const t3 = await this.getCacheKeys();
      if (!t3) return;
      const i3 = this.matchExistingCacheKey(e3, t3);
      if (i3 && (r2 = await this.cache.get(i3), s2 = Fe.fromKey(i3)), !r2 && n2 && "cache-only" !== o2) return this.getEntryWithRefreshToken(e3, t3);
    }
    if (!r2) return;
    const a2 = await this.nowProvider(), c2 = Math.floor(a2 / 1e3);
    return r2.expiresAt - t2 < c2 ? r2.body.refresh_token ? this.modifiedCachedEntry(r2, s2) : (await this.cache.remove(s2.toKey()), void await (null === (i2 = this.keyManifest) || void 0 === i2 ? void 0 : i2.remove(s2.toKey()))) : r2.body;
  }
  async modifiedCachedEntry(e3, t2) {
    const n2 = { refresh_token: e3.body.refresh_token, audience: e3.body.audience, scope: e3.body.scope }, o2 = { body: n2, expiresAt: e3.expiresAt };
    return await this.cache.set(t2.toKey(), o2), { refresh_token: n2.refresh_token, audience: n2.audience, scope: n2.scope };
  }
  async set(e3) {
    var t2;
    const n2 = new Fe({ clientId: e3.client_id, scope: e3.scope, audience: e3.audience }), o2 = await this.wrapCacheEntry(e3);
    await this.cache.set(n2.toKey(), o2), await (null === (t2 = this.keyManifest) || void 0 === t2 ? void 0 : t2.add(n2.toKey()));
  }
  async remove(e3, t2, n2) {
    const o2 = new Fe({ clientId: e3, scope: n2, audience: t2 });
    await this.cache.remove(o2.toKey());
  }
  async stripRefreshToken(e3) {
    var t2;
    const n2 = await this.getCacheKeys();
    if (n2) for (const o2 of n2) {
      const n3 = await this.cache.get(o2);
      (null === (t2 = null == n3 ? void 0 : n3.body) || void 0 === t2 ? void 0 : t2.refresh_token) === e3 && (delete n3.body.refresh_token, await this.cache.set(o2, n3));
    }
  }
  async clear(e3) {
    var t2;
    const n2 = await this.getCacheKeys();
    n2 && (await n2.filter((t3) => !e3 || t3.includes(e3)).reduce(async (e4, t3) => {
      await e4, await this.cache.remove(t3);
    }, Promise.resolve()), await (null === (t2 = this.keyManifest) || void 0 === t2 ? void 0 : t2.clear()));
  }
  async wrapCacheEntry(e3) {
    const t2 = await this.nowProvider();
    return { body: e3, expiresAt: Math.floor(t2 / 1e3) + e3.expires_in };
  }
  async getCacheKeys() {
    var e3;
    return this.keyManifest ? null === (e3 = await this.keyManifest.get()) || void 0 === e3 ? void 0 : e3.keys : this.cache.allKeys ? this.cache.allKeys() : void 0;
  }
  getIdTokenCacheKey(e3) {
    return new Fe({ clientId: e3 }, He, Ze).toKey();
  }
  matchExistingCacheKey(e3, t2) {
    return t2.filter((t3) => {
      var n2;
      const o2 = Fe.fromKey(t3), i2 = new Set(o2.scope && o2.scope.split(" ")), r2 = (null === (n2 = e3.scope) || void 0 === n2 ? void 0 : n2.split(" ")) || [], s2 = o2.scope && r2.reduce((e4, t4) => e4 && i2.has(t4), true);
      return o2.prefix === He && o2.clientId === e3.clientId && o2.audience === e3.audience && s2;
    })[0];
  }
  async getEntryWithRefreshToken(e3, t2) {
    var n2;
    for (const o2 of t2) {
      const t3 = Fe.fromKey(o2);
      if (t3.prefix === He && t3.clientId === e3.clientId) {
        const e4 = await this.cache.get(o2);
        if (null === (n2 = null == e4 ? void 0 : e4.body) || void 0 === n2 ? void 0 : n2.refresh_token) return { refresh_token: e4.body.refresh_token, audience: e4.body.audience, scope: e4.body.scope };
      }
    }
  }
  async getRefreshTokensByAudience(e3, t2) {
    var n2;
    const o2 = await this.getCacheKeys();
    if (!o2) return [];
    const i2 = /* @__PURE__ */ new Set();
    for (const r2 of o2) {
      const o3 = Fe.fromKey(r2);
      if (o3.prefix === He && o3.clientId === t2 && o3.audience === e3) {
        const e4 = await this.cache.get(r2);
        (null === (n2 = null == e4 ? void 0 : e4.body) || void 0 === n2 ? void 0 : n2.refresh_token) && i2.add(e4.body.refresh_token);
      }
    }
    return Array.from(i2);
  }
  async updateEntry(e3, t2, n2) {
    let o2 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3];
    const i2 = await this.getCacheKeys();
    if (i2) for (const r2 of i2) {
      if (Fe.fromKey(r2).clientId !== n2) continue;
      const i3 = await this.cache.get(r2);
      if (!(null == i3 ? void 0 : i3.body)) continue;
      const s2 = i3.body.refresh_token;
      s2 && (o2 || s2 === e3) && (i3.body.refresh_token = t2, await this.cache.set(r2, i3));
    }
  }
};
var qe = class {
  constructor(e3, t2, n2) {
    this.storage = e3, this.clientId = t2, this.cookieDomain = n2, this.storageKey = "".concat("a0.spajs.txs", ".").concat(this.clientId);
  }
  create(e3) {
    this.storage.save(this.storageKey, e3, { daysUntilExpire: 1, cookieDomain: this.cookieDomain });
  }
  get() {
    return this.storage.get(this.storageKey);
  }
  remove() {
    this.storage.remove(this.storageKey, { cookieDomain: this.cookieDomain });
  }
};
var Ye = (e3) => "number" == typeof e3;
var Be = ["iss", "aud", "exp", "nbf", "iat", "jti", "azp", "nonce", "auth_time", "at_hash", "c_hash", "acr", "amr", "sub_jwk", "cnf", "sip_from_tag", "sip_date", "sip_callid", "sip_cseq_num", "sip_via_branch", "orig", "dest", "mky", "events", "toe", "txn", "rph", "sid", "vot", "vtm"];
var Qe = (e3) => {
  if (!e3.id_token) throw new Error("ID token is required but missing");
  const t2 = ((e4) => {
    const t3 = e4.split("."), n3 = y(t3, 3), o3 = n3[0], i3 = n3[1], r2 = n3[2];
    if (3 !== t3.length || !o3 || !i3 || !r2) throw new Error("ID token could not be decoded");
    const s2 = JSON.parse(G(i3)), a2 = { __raw: e4 }, c2 = {};
    return Object.keys(s2).forEach((e5) => {
      a2[e5] = s2[e5], Be.includes(e5) || (c2[e5] = s2[e5]);
    }), { encoded: { header: o3, payload: i3, signature: r2 }, header: JSON.parse(G(o3)), claims: a2, user: c2 };
  })(e3.id_token);
  if (!t2.claims.iss) throw new Error("Issuer (iss) claim must be a string present in the ID token");
  if (t2.claims.iss !== e3.iss) throw new Error('Issuer (iss) claim mismatch in the ID token; expected "'.concat(e3.iss, '", found "').concat(t2.claims.iss, '"'));
  if (!t2.user.sub) throw new Error("Subject (sub) claim must be a string present in the ID token");
  if ("RS256" !== t2.header.alg) throw new Error('Signature algorithm of "'.concat(t2.header.alg, '" is not supported. Expected the ID token to be signed with "RS256".'));
  if (!t2.claims.aud || "string" != typeof t2.claims.aud && !Array.isArray(t2.claims.aud)) throw new Error("Audience (aud) claim must be a string or array of strings present in the ID token");
  if (Array.isArray(t2.claims.aud)) {
    if (!t2.claims.aud.includes(e3.aud)) throw new Error('Audience (aud) claim mismatch in the ID token; expected "'.concat(e3.aud, '" but was not one of "').concat(t2.claims.aud.join(", "), '"'));
    if (t2.claims.aud.length > 1) {
      if (!t2.claims.azp) throw new Error("Authorized Party (azp) claim must be a string present in the ID token when Audience (aud) claim has multiple values");
      if (t2.claims.azp !== e3.aud) throw new Error('Authorized Party (azp) claim mismatch in the ID token; expected "'.concat(e3.aud, '", found "').concat(t2.claims.azp, '"'));
    }
  } else if (t2.claims.aud !== e3.aud) throw new Error('Audience (aud) claim mismatch in the ID token; expected "'.concat(e3.aud, '" but found "').concat(t2.claims.aud, '"'));
  if (e3.nonce) {
    if (!t2.claims.nonce) throw new Error("Nonce (nonce) claim must be a string present in the ID token");
    if (t2.claims.nonce !== e3.nonce) throw new Error('Nonce (nonce) claim mismatch in the ID token; expected "'.concat(e3.nonce, '", found "').concat(t2.claims.nonce, '"'));
  }
  if (null != e3.max_age && !Ye(t2.claims.auth_time)) throw new Error("Authentication Time (auth_time) claim must be a number present in the ID token when Max Age (max_age) is specified");
  if (null == t2.claims.exp || !Ye(t2.claims.exp)) throw new Error("Expiration Time (exp) claim must be a number present in the ID token");
  if (!Ye(t2.claims.iat)) throw new Error("Issued At (iat) claim must be a number present in the ID token");
  const n2 = e3.leeway || 60, o2 = new Date(e3.now || Date.now()), i2 = /* @__PURE__ */ new Date(0);
  if (i2.setUTCSeconds(t2.claims.exp + n2), o2 > i2) throw new Error("Expiration Time (exp) claim error in the ID token; current time (".concat(o2, ") is after expiration time (").concat(i2, ")"));
  if (null != t2.claims.nbf && Ye(t2.claims.nbf)) {
    const e4 = /* @__PURE__ */ new Date(0);
    if (e4.setUTCSeconds(t2.claims.nbf - n2), o2 < e4) throw new Error("Not Before time (nbf) claim in the ID token indicates that this token can't be used just yet. Current time (".concat(o2, ") is before ").concat(e4));
  }
  if (null != t2.claims.auth_time && Ye(t2.claims.auth_time)) {
    const i3 = /* @__PURE__ */ new Date(0);
    if (i3.setUTCSeconds(parseInt(t2.claims.auth_time) + e3.max_age + n2), o2 > i3) throw new Error("Authentication Time (auth_time) claim in the ID token indicates that too much time has passed since the last end-user authentication. Current time (".concat(o2, ") is after last auth at ").concat(i3));
  }
  if (e3.organization) {
    const n3 = e3.organization.trim();
    if (n3.startsWith("org_")) {
      const e4 = n3;
      if (!t2.claims.org_id) throw new Error("Organization ID (org_id) claim must be a string present in the ID token");
      if (e4 !== t2.claims.org_id) throw new Error('Organization ID (org_id) claim mismatch in the ID token; expected "'.concat(e4, '", found "').concat(t2.claims.org_id, '"'));
    } else {
      const e4 = n3.toLowerCase();
      if (!t2.claims.org_name) throw new Error("Organization Name (org_name) claim must be a string present in the ID token");
      if (e4 !== t2.claims.org_name) throw new Error('Organization Name (org_name) claim mismatch in the ID token; expected "'.concat(e4, '", found "').concat(t2.claims.org_name, '"'));
    }
  }
  return t2;
};
var $e = B && B.__assign || function() {
  return $e = Object.assign || function(e3) {
    for (var t2, n2 = 1, o2 = arguments.length; n2 < o2; n2++) for (var i2 in t2 = arguments[n2]) Object.prototype.hasOwnProperty.call(t2, i2) && (e3[i2] = t2[i2]);
    return e3;
  }, $e.apply(this, arguments);
};
function et(e3, t2) {
  if (!t2) return "";
  var n2 = "; " + e3;
  return true === t2 ? n2 : n2 + "=" + t2;
}
function tt(e3, t2, n2) {
  return encodeURIComponent(e3).replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent).replace(/\(/g, "%28").replace(/\)/g, "%29") + "=" + encodeURIComponent(t2).replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent) + (function(e4) {
    if ("number" == typeof e4.expires) {
      var t3 = /* @__PURE__ */ new Date();
      t3.setMilliseconds(t3.getMilliseconds() + 864e5 * e4.expires), e4.expires = t3;
    }
    return et("Expires", e4.expires ? e4.expires.toUTCString() : "") + et("Domain", e4.domain) + et("Path", e4.path) + et("Secure", e4.secure) + et("SameSite", e4.sameSite);
  })(n2);
}
function nt() {
  return (function(e3) {
    for (var t2 = {}, n2 = e3 ? e3.split("; ") : [], o2 = /(%[\dA-F]{2})+/gi, i2 = 0; i2 < n2.length; i2++) {
      var r2 = n2[i2].split("="), s2 = r2.slice(1).join("=");
      '"' === s2.charAt(0) && (s2 = s2.slice(1, -1));
      try {
        t2[r2[0].replace(o2, decodeURIComponent)] = s2.replace(o2, decodeURIComponent);
      } catch (e4) {
      }
    }
    return t2;
  })(document.cookie);
}
var ot = function(e3) {
  return nt()[e3];
};
function it(e3, t2, n2) {
  document.cookie = tt(e3, t2, $e({ path: "/" }, n2));
}
var rt = it;
var st = function(e3, t2) {
  it(e3, "", $e($e({}, t2), { expires: -1 }));
};
var at = { get(e3) {
  const t2 = ot(e3);
  if (void 0 !== t2) return JSON.parse(t2);
}, save(e3, t2, n2) {
  let o2 = {};
  "https:" === window.location.protocol && (o2 = { secure: true, sameSite: "none" }), (null == n2 ? void 0 : n2.daysUntilExpire) && (o2.expires = n2.daysUntilExpire), (null == n2 ? void 0 : n2.cookieDomain) && (o2.domain = n2.cookieDomain), rt(e3, JSON.stringify(t2), o2);
}, remove(e3, t2) {
  let n2 = {};
  (null == t2 ? void 0 : t2.cookieDomain) && (n2.domain = t2.cookieDomain), st(e3, n2);
} };
var ct = "_legacy_";
var ut = { get(e3) {
  const t2 = at.get(e3);
  return t2 || at.get("".concat(ct).concat(e3));
}, save(e3, t2, n2) {
  let o2 = {};
  "https:" === window.location.protocol && (o2 = { secure: true }), (null == n2 ? void 0 : n2.daysUntilExpire) && (o2.expires = n2.daysUntilExpire), (null == n2 ? void 0 : n2.cookieDomain) && (o2.domain = n2.cookieDomain), rt("".concat(ct).concat(e3), JSON.stringify(t2), o2), at.save(e3, t2, n2);
}, remove(e3, t2) {
  let n2 = {};
  (null == t2 ? void 0 : t2.cookieDomain) && (n2.domain = t2.cookieDomain), st(e3, n2), at.remove(e3, t2), at.remove("".concat(ct).concat(e3), t2);
} };
var lt = { get(e3) {
  if ("undefined" == typeof sessionStorage) return;
  const t2 = sessionStorage.getItem(e3);
  return null != t2 ? JSON.parse(t2) : void 0;
}, save(e3, t2) {
  sessionStorage.setItem(e3, JSON.stringify(t2));
}, remove(e3) {
  sessionStorage.removeItem(e3);
} };
var ht;
!(function(e3) {
  e3.Code = "code", e3.ConnectCode = "connect_code";
})(ht || (ht = {}));
function ft(e3, t2, n2) {
  var o2 = void 0 === t2 ? null : t2, i2 = (function(e4, t3) {
    var n3 = atob(e4);
    if (t3) {
      for (var o3 = new Uint8Array(n3.length), i3 = 0, r3 = n3.length; i3 < r3; ++i3) o3[i3] = n3.charCodeAt(i3);
      return String.fromCharCode.apply(null, new Uint16Array(o3.buffer));
    }
    return n3;
  })(e3, void 0 !== n2 && n2), r2 = i2.indexOf("\n", 10) + 1, s2 = i2.substring(r2) + (o2 ? "//# sourceMappingURL=" + o2 : ""), a2 = new Blob([s2], { type: "application/javascript" });
  return URL.createObjectURL(a2);
}
var mt;
var yt;
var wt;
var gt;
var vt = (mt = "Lyogcm9sbHVwLXBsdWdpbi13ZWItd29ya2VyLWxvYWRlciAqLwohZnVuY3Rpb24oKXsidXNlIHN0cmljdCI7ZnVuY3Rpb24gZShlLHQpeyhudWxsPT10fHx0PmUubGVuZ3RoKSYmKHQ9ZS5sZW5ndGgpO2Zvcih2YXIgcj0wLG89QXJyYXkodCk7cjx0O3IrKylvW3JdPWVbcl07cmV0dXJuIG99ZnVuY3Rpb24gdCh0LHIpe3JldHVybiBmdW5jdGlvbihlKXtpZihBcnJheS5pc0FycmF5KGUpKXJldHVybiBlfSh0KXx8ZnVuY3Rpb24oZSx0KXt2YXIgcj1udWxsPT1lP251bGw6InVuZGVmaW5lZCIhPXR5cGVvZiBTeW1ib2wmJmVbU3ltYm9sLml0ZXJhdG9yXXx8ZVsiQEBpdGVyYXRvciJdO2lmKG51bGwhPXIpe3ZhciBvLG4scyxhLGk9W10sYz0hMCxsPSExO3RyeXtpZihzPShyPXIuY2FsbChlKSkubmV4dCwwPT09dCl7aWYoT2JqZWN0KHIpIT09cilyZXR1cm47Yz0hMX1lbHNlIGZvcig7IShjPShvPXMuY2FsbChyKSkuZG9uZSkmJihpLnB1c2goby52YWx1ZSksaS5sZW5ndGghPT10KTtjPSEwKTt9Y2F0Y2goZSl7bD0hMCxuPWV9ZmluYWxseXt0cnl7aWYoIWMmJm51bGwhPXIucmV0dXJuJiYoYT1yLnJldHVybigpLE9iamVjdChhKSE9PWEpKXJldHVybn1maW5hbGx5e2lmKGwpdGhyb3cgbn19cmV0dXJuIGl9fSh0LHIpfHxmdW5jdGlvbih0LHIpe2lmKHQpe2lmKCJzdHJpbmciPT10eXBlb2YgdClyZXR1cm4gZSh0LHIpO3ZhciBvPXt9LnRvU3RyaW5nLmNhbGwodCkuc2xpY2UoOCwtMSk7cmV0dXJuIk9iamVjdCI9PT1vJiZ0LmNvbnN0cnVjdG9yJiYobz10LmNvbnN0cnVjdG9yLm5hbWUpLCJNYXAiPT09b3x8IlNldCI9PT1vP0FycmF5LmZyb20odCk6IkFyZ3VtZW50cyI9PT1vfHwvXig/OlVpfEkpbnQoPzo4fDE2fDMyKSg/OkNsYW1wZWQpP0FycmF5JC8udGVzdChvKT9lKHQscik6dm9pZCAwfX0odCxyKXx8ZnVuY3Rpb24oKXt0aHJvdyBuZXcgVHlwZUVycm9yKCJJbnZhbGlkIGF0dGVtcHQgdG8gZGVzdHJ1Y3R1cmUgbm9uLWl0ZXJhYmxlIGluc3RhbmNlLlxuSW4gb3JkZXIgdG8gYmUgaXRlcmFibGUsIG5vbi1hcnJheSBvYmplY3RzIG11c3QgaGF2ZSBhIFtTeW1ib2wuaXRlcmF0b3JdKCkgbWV0aG9kLiIpfSgpfWNsYXNzIHIgZXh0ZW5kcyBFcnJvcntjb25zdHJ1Y3RvcihlLHQsbyl7c3VwZXIodCksdGhpcy5lcnJvcj1lLHRoaXMuZXJyb3JfZGVzY3JpcHRpb249dCx0aGlzLmRhdGE9byxPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcyxyLnByb3RvdHlwZSl9c3RhdGljIGZyb21QYXlsb2FkKGUpe2xldCB0PWUuZXJyb3Isbz1lLmVycm9yX2Rlc2NyaXB0aW9uO3JldHVybiBuZXcgcih0LG8pfX1jbGFzcyBvIGV4dGVuZHMgcntjb25zdHJ1Y3RvcihlLHQpe3N1cGVyKCJtaXNzaW5nX3JlZnJlc2hfdG9rZW4iLCJNaXNzaW5nIFJlZnJlc2ggVG9rZW4gKGF1ZGllbmNlOiAnIi5jb25jYXQobihlLFsiZGVmYXVsdCJdKSwiJywgc2NvcGU6ICciKS5jb25jYXQobih0KSwiJykiKSksdGhpcy5hdWRpZW5jZT1lLHRoaXMuc2NvcGU9dCxPYmplY3Quc2V0UHJvdG90eXBlT2YodGhpcyxvLnByb3RvdHlwZSl9fWZ1bmN0aW9uIG4oZSl7cmV0dXJuIGUmJiEoYXJndW1lbnRzLmxlbmd0aD4xJiZ2b2lkIDAhPT1hcmd1bWVudHNbMV0/YXJndW1lbnRzWzFdOltdKS5pbmNsdWRlcyhlKT9lOiIifSJmdW5jdGlvbiI9PXR5cGVvZiBTdXBwcmVzc2VkRXJyb3ImJlN1cHByZXNzZWRFcnJvcjtjb25zdCBzPWU9Pnt2YXIgdD1lLmNsaWVudElkLHI9ZnVuY3Rpb24oZSx0KXt2YXIgcj17fTtmb3IodmFyIG8gaW4gZSlPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwoZSxvKSYmdC5pbmRleE9mKG8pPDAmJihyW29dPWVbb10pO2lmKG51bGwhPWUmJiJmdW5jdGlvbiI9PXR5cGVvZiBPYmplY3QuZ2V0T3duUHJvcGVydHlTeW1ib2xzKXt2YXIgbj0wO2ZvcihvPU9iamVjdC5nZXRPd25Qcm9wZXJ0eVN5bWJvbHMoZSk7bjxvLmxlbmd0aDtuKyspdC5pbmRleE9mKG9bbl0pPDAmJk9iamVjdC5wcm90b3R5cGUucHJvcGVydHlJc0VudW1lcmFibGUuY2FsbChlLG9bbl0pJiYocltvW25dXT1lW29bbl1dKX1yZXR1cm4gcn0oZSxbImNsaWVudElkIl0pO3JldHVybiBuZXcgVVJMU2VhcmNoUGFyYW1zKChlPT5PYmplY3Qua2V5cyhlKS5maWx0ZXIodD0+dm9pZCAwIT09ZVt0XSkucmVkdWNlKCh0LHIpPT5PYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30sdCkse1tyXTplW3JdfSkse30pKShPYmplY3QuYXNzaWduKHtjbGllbnRfaWQ6dH0scikpKS50b1N0cmluZygpfTtsZXQgYT17fSxpPW51bGw7Y29uc3QgYz0oZSx0KT0+IiIuY29uY2F0KGUsInwiKS5jb25jYXQodCksbD0oZSx0KT0+dC5zdGFydHNXaXRoKCIiLmNvbmNhdChlLCJ8IikpLHU9KGUsdCk9PmFbYyhlLHQpXSxmPWU9PntPYmplY3QuZW50cmllcyhhKS5mb3JFYWNoKHI9PntsZXQgbz10KHIsMiksbj1vWzBdO29bMV09PT1lJiZkZWxldGUgYVtuXX0pfSxoPWU9Pntjb25zdCB0PW5ldyBVUkxTZWFyY2hQYXJhbXMoZSkscj17fTtyZXR1cm4gdC5mb3JFYWNoKChlLHQpPT57clt0XT1lfSkscn0sZD1hc3luYyBlPT57bGV0IHIsbixpPWUuZGF0YSxmPWkudGltZW91dCxkPWkuYXV0aCxwPWkuZmV0Y2hVcmwseT1pLmZldGNoT3B0aW9ucyxnPWkudXNlRm9ybURhdGEsYj1pLnVzZU1ycnQsTz1pLnNraXBUb2tlblN0b3JhZ2Usaz1pLnByZXNlcnZlUmVmcmVzaFRva2VuLG09dChlLnBvcnRzLDEpWzBdLGo9e307Y29uc3Qgdj1kfHx7fSxfPXYuYXVkaWVuY2Usdz12LnNjb3BlO3RyeXtjb25zdCBlPWc/aCh5LmJvZHkpOkpTT04ucGFyc2UoeS5ib2R5KTtpZihlLnJlZnJlc2hfdG9rZW58fCJyZWZyZXNoX3Rva2VuIiE9PWUuZ3JhbnRfdHlwZSllLm1mYV90b2tlbiYmKG49dShfLHcpLCFuJiZiJiYobj1hLmxhdGVzdF9yZWZyZXNoX3Rva2VuKSk7ZWxzZXtpZihuPXUoXyx3KSwhbiYmYil7Y29uc3QgZT1hLmxhdGVzdF9yZWZyZXNoX3Rva2VuLHQ9KChlLHQpPT4hIU9iamVjdC5rZXlzKGEpLmZpbmQocj0+e2lmKCJsYXRlc3RfcmVmcmVzaF90b2tlbiIhPT1yKXtjb25zdCBvPWwodCxyKSxuPXIuc3BsaXQoInwiKVsxXS5zcGxpdCgiICIpLHM9ZS5zcGxpdCgiICIpLmV2ZXJ5KGU9Pm4uaW5jbHVkZXMoZSkpO3JldHVybiBvJiZzfX0pKSh3LF8pO2UmJiF0JiYobj1lKX1pZighbil0aHJvdyBuZXcgbyhfLHcpO3kuYm9keT1nP3MoT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LGUpLHtyZWZyZXNoX3Rva2VuOm59KSk6SlNPTi5zdHJpbmdpZnkoT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LGUpLHtyZWZyZXNoX3Rva2VuOm59KSl9bGV0IGksZDsiZnVuY3Rpb24iPT10eXBlb2YgQWJvcnRDb250cm9sbGVyJiYoaT1uZXcgQWJvcnRDb250cm9sbGVyLHkuc2lnbmFsPWkuc2lnbmFsKTt0cnl7ZD1hd2FpdCBQcm9taXNlLnJhY2UoWyhQPWYsbmV3IFByb21pc2UoZT0+c2V0VGltZW91dChlLFApKSksZmV0Y2gocCxPYmplY3QuYXNzaWduKHt9LHkpKV0pfWNhdGNoKGUpe3JldHVybiB2b2lkIG0ucG9zdE1lc3NhZ2Uoe2Vycm9yOmUubWVzc2FnZX0pfWlmKCFkKXJldHVybiBpJiZpLmFib3J0KCksdm9pZCBtLnBvc3RNZXNzYWdlKHtlcnJvcjoiVGltZW91dCB3aGVuIGV4ZWN1dGluZyAnZmV0Y2gnIn0pO2lmKFU9ZC5oZWFkZXJzLGo9Wy4uLlVdLnJlZHVjZSgoZSxyKT0+e2xldCBvPXQociwyKSxuPW9bMF0scz1vWzFdO3JldHVybiBlW25dPXMsZX0se30pLHI9YXdhaXQgZC5qc29uKCksTylyZXR1cm4gZGVsZXRlIHIucmVmcmVzaF90b2tlbix2b2lkIG0ucG9zdE1lc3NhZ2Uoe29rOmQub2ssanNvbjpyLGhlYWRlcnM6an0pO3IucmVmcmVzaF90b2tlbj8oYiYmKGEubGF0ZXN0X3JlZnJlc2hfdG9rZW49ci5yZWZyZXNoX3Rva2VuLFM9bixNPXIucmVmcmVzaF90b2tlbixPYmplY3QuZW50cmllcyhhKS5mb3JFYWNoKGU9PntsZXQgcj10KGUsMiksbz1yWzBdO3JbMV09PT1TJiYoYVtvXT1NKX0pKSwoKGUsdCxyKT0+e2FbYyh0LHIpXT1lfSkoci5yZWZyZXNoX3Rva2VuLF8sdyksZGVsZXRlIHIucmVmcmVzaF90b2tlbik6a3x8KChlLHQpPT57ZGVsZXRlIGFbYyhlLHQpXX0pKF8sdyksbS5wb3N0TWVzc2FnZSh7b2s6ZC5vayxqc29uOnIsaGVhZGVyczpqfSl9Y2F0Y2goZSl7bS5wb3N0TWVzc2FnZSh7b2s6ITEsanNvbjp7ZXJyb3I6ZS5lcnJvcixlcnJvcl9kZXNjcmlwdGlvbjplLm1lc3NhZ2V9LGhlYWRlcnM6an0pfXZhciBTLE0sVSxQfSxwPWFzeW5jIGU9PntsZXQgcj1lLmRhdGEsbz1yLnRpbWVvdXQsbj1yLmF1dGgsaT1yLmZldGNoVXJsLGM9ci5mZXRjaE9wdGlvbnMsdT1yLnVzZUZvcm1EYXRhLGQ9dChlLnBvcnRzLDEpWzBdO2NvbnN0IHA9KG58fHt9KS5hdWRpZW5jZTt0cnl7Y29uc3QgZT0oZT0+e2NvbnN0IHI9bmV3IFNldDtyZXR1cm4gT2JqZWN0LmVudHJpZXMoYSkuZm9yRWFjaChvPT57bGV0IG49dChvLDIpLHM9blswXSxhPW5bMV07bChlLHMpJiZyLmFkZChhKX0pLEFycmF5LmZyb20ocil9KShwKTtpZigwPT09ZS5sZW5ndGgpcmV0dXJuIHZvaWQgZC5wb3N0TWVzc2FnZSh7b2s6ITB9KTtjb25zdCByPXU/aChjLmJvZHkpOkpTT04ucGFyc2UoYy5ib2R5KTtmb3IoY29uc3QgdCBvZiBlKXtjb25zdCBlPXU/cyhPYmplY3QuYXNzaWduKE9iamVjdC5hc3NpZ24oe30scikse3Rva2VuOnR9KSk6SlNPTi5zdHJpbmdpZnkoT2JqZWN0LmFzc2lnbihPYmplY3QuYXNzaWduKHt9LHIpLHt0b2tlbjp0fSkpO2xldCBuLGEsbCxoOyJmdW5jdGlvbiI9PXR5cGVvZiBBYm9ydENvbnRyb2xsZXImJihuPW5ldyBBYm9ydENvbnRyb2xsZXIsYT1uLnNpZ25hbCk7dHJ5e2g9YXdhaXQgUHJvbWlzZS5yYWNlKFtuZXcgUHJvbWlzZShlPT57bD1zZXRUaW1lb3V0KGUsbyl9KSxmZXRjaChpLE9iamVjdC5hc3NpZ24oT2JqZWN0LmFzc2lnbih7fSxjKSx7Ym9keTplLHNpZ25hbDphfSkpXSkuZmluYWxseSgoKT0+Y2xlYXJUaW1lb3V0KGwpKX1jYXRjaChlKXtyZXR1cm4gdm9pZCBkLnBvc3RNZXNzYWdlKHtlcnJvcjplLm1lc3NhZ2V9KX1pZighaClyZXR1cm4gbiYmbi5hYm9ydCgpLHZvaWQgZC5wb3N0TWVzc2FnZSh7ZXJyb3I6IlRpbWVvdXQgd2hlbiBleGVjdXRpbmcgJ2ZldGNoJyJ9KTtpZighaC5vayl7bGV0IGU7dHJ5e2NvbnN0IHQ9SlNPTi5wYXJzZShhd2FpdCBoLnRleHQoKSk7ZT10LmVycm9yX2Rlc2NyaXB0aW9ufWNhdGNoKGUpe31yZXR1cm4gdm9pZCBkLnBvc3RNZXNzYWdlKHtlcnJvcjplfHwiSFRUUCBlcnJvciAiLmNvbmNhdChoLnN0YXR1cyl9KX1mKHQpfWQucG9zdE1lc3NhZ2Uoe29rOiEwfSl9Y2F0Y2goZSl7ZC5wb3N0TWVzc2FnZSh7ZXJyb3I6ZS5tZXNzYWdlfHwiVW5rbm93biBlcnJvciBkdXJpbmcgdG9rZW4gcmV2b2NhdGlvbiJ9KX19LHk9KGUsdCk9PntpZighaSlyZXR1cm4hMTt0cnl7Y29uc3Qgcj1uZXcgVVJMKGkpLm9yaWdpbixvPW5ldyBVUkwoZS5mZXRjaFVybCk7cmV0dXJuIG8ub3JpZ2luPT09ciYmby5wYXRobmFtZT09PXR9Y2F0Y2goZSl7cmV0dXJuITF9fTthZGRFdmVudExpc3RlbmVyKCJtZXNzYWdlIixlPT57Y29uc3Qgcj1lLmRhdGEsbz10KGUucG9ydHMsMSlbMF07aWYoISgidHlwZSJpbiByKXx8ImluaXQiIT09ci50eXBlKXJldHVybiJ0eXBlImluIHImJiJjbGVhciI9PT1yLnR5cGU/KGE9e30sdm9pZChudWxsPT1vfHxvLnBvc3RNZXNzYWdlKHtvazohMH0pKSk6InR5cGUiaW4gciYmInJldm9rZSI9PT1yLnR5cGU/eShyLCIvb2F1dGgvcmV2b2tlIik/dm9pZCBwKGUpOnZvaWQobnVsbD09b3x8by5wb3N0TWVzc2FnZSh7b2s6ITEsanNvbjp7ZXJyb3I6ImludmFsaWRfZmV0Y2hfdXJsIixlcnJvcl9kZXNjcmlwdGlvbjoiVW5hdXRob3JpemVkIGZldGNoIFVSTCJ9LGhlYWRlcnM6e319KSk6dm9pZCgiZmV0Y2hVcmwiaW4gciYmeShyLCIvb2F1dGgvdG9rZW4iKT9kKGUpOm51bGw9PW98fG8ucG9zdE1lc3NhZ2Uoe29rOiExLGpzb246e2Vycm9yOiJpbnZhbGlkX2ZldGNoX3VybCIsZXJyb3JfZGVzY3JpcHRpb246IlVuYXV0aG9yaXplZCBmZXRjaCBVUkwifSxoZWFkZXJzOnt9fSkpO2lmKG51bGw9PT1pKXRyeXtuZXcgVVJMKHIuYWxsb3dlZEJhc2VVcmwpLGk9ci5hbGxvd2VkQmFzZVVybH1jYXRjaChlKXtyZXR1cm59fSl9KCk7Cgo=", yt = null, wt = false, function(e3) {
  return gt = gt || ft(mt, yt, wt), new Worker(gt, e3);
});
var bt = class {
  constructor(e3, t2) {
    this.cache = e3, this.clientId = t2, this.manifestKey = this.createManifestKeyFrom(this.clientId);
  }
  async add(e3) {
    var t2;
    const n2 = new Set((null === (t2 = await this.cache.get(this.manifestKey)) || void 0 === t2 ? void 0 : t2.keys) || []);
    n2.add(e3), await this.cache.set(this.manifestKey, { keys: [...n2] });
  }
  async remove(e3) {
    const t2 = await this.cache.get(this.manifestKey);
    if (t2) {
      const n2 = new Set(t2.keys);
      return n2.delete(e3), n2.size > 0 ? await this.cache.set(this.manifestKey, { keys: [...n2] }) : await this.cache.remove(this.manifestKey);
    }
  }
  get() {
    return this.cache.get(this.manifestKey);
  }
  clear() {
    return this.cache.remove(this.manifestKey);
  }
  createManifestKeyFrom(e3) {
    return "".concat(He, "::").concat(e3);
  }
};
var _t = "auth0.is.authenticated";
var kt = { memory: () => new Xe().enclosedCache, localstorage: () => new Ve() };
var St = (e3) => kt[e3];
var Tt = (t2) => {
  const n2 = t2.openUrl, o2 = t2.onRedirect, i2 = e(t2, ["openUrl", "onRedirect"]);
  return Object.assign(Object.assign({}, i2), { openUrl: false === n2 || n2 ? n2 : o2 });
};
var Pt = (e3, t2, n2) => {
  const o2 = (null == e3 ? void 0 : e3.split(" ")) || [], i2 = n2 ? o2.filter((e4) => e4 !== S) : o2;
  const r2 = (null == t2 ? void 0 : t2.split(" ")) || [];
  return i2.filter((e4) => -1 == r2.indexOf(e4)).join(",");
};
var Ct = { NONCE: "nonce", KEYPAIR: "keypair" };
var Et = class {
  constructor(e3) {
    this.clientId = e3;
  }
  getVersion() {
    return 1;
  }
  createDbHandle() {
    const e3 = window.indexedDB.open("auth0-spa-js", this.getVersion());
    return new Promise((t2, n2) => {
      e3.onupgradeneeded = () => Object.values(Ct).forEach((t3) => e3.result.createObjectStore(t3)), e3.onerror = () => n2(e3.error), e3.onsuccess = () => t2(e3.result);
    });
  }
  async getDbHandle() {
    return this.dbHandle || (this.dbHandle = await this.createDbHandle()), this.dbHandle;
  }
  async executeDbRequest(e3, t2, n2) {
    const o2 = n2((await this.getDbHandle()).transaction(e3, t2).objectStore(e3));
    return new Promise((e4, t3) => {
      o2.onsuccess = () => e4(o2.result), o2.onerror = () => t3(o2.error);
    });
  }
  buildKey(e3) {
    const t2 = e3 ? "_".concat(e3) : "auth0";
    return "".concat(this.clientId, "::").concat(t2);
  }
  setNonce(e3, t2) {
    return this.save(Ct.NONCE, this.buildKey(t2), e3);
  }
  setKeyPair(e3) {
    return this.save(Ct.KEYPAIR, this.buildKey(), e3);
  }
  async save(e3, t2, n2) {
    await this.executeDbRequest(e3, "readwrite", (e4) => e4.put(n2, t2));
  }
  findNonce(e3) {
    return this.find(Ct.NONCE, this.buildKey(e3));
  }
  findKeyPair() {
    return this.find(Ct.KEYPAIR, this.buildKey());
  }
  find(e3, t2) {
    return this.executeDbRequest(e3, "readonly", (e4) => e4.get(t2));
  }
  async deleteBy(e3, t2) {
    const n2 = await this.executeDbRequest(e3, "readonly", (e4) => e4.getAllKeys());
    await Promise.all((null == n2 ? void 0 : n2.filter(t2).map((t3) => this.executeDbRequest(e3, "readwrite", (e4) => e4.delete(t3)))) || []);
  }
  deleteByClientId(e3, t2) {
    return this.deleteBy(e3, (e4) => "string" == typeof e4 && e4.startsWith("".concat(t2, "::")));
  }
  clearNonces() {
    return this.deleteByClientId(Ct.NONCE, this.clientId);
  }
  clearKeyPairs() {
    return this.deleteByClientId(Ct.KEYPAIR, this.clientId);
  }
};
var Rt = class {
  constructor(e3) {
    this.storage = new Et(e3);
  }
  getNonce(e3) {
    return this.storage.findNonce(e3);
  }
  setNonce(e3, t2) {
    return this.storage.setNonce(e3, t2);
  }
  async getOrGenerateKeyPair() {
    let e3 = await this.storage.findKeyPair();
    return e3 || (e3 = await je(), await this.storage.setKeyPair(e3)), e3;
  }
  async generateProof(e3) {
    const t2 = await this.getOrGenerateKeyPair();
    return Ne(Object.assign({ keyPair: t2 }, e3));
  }
  async calculateThumbprint() {
    return We(await this.getOrGenerateKeyPair());
  }
  async clear() {
    await Promise.all([this.storage.clearNonces(), this.storage.clearKeyPairs()]);
  }
};
var At;
!(function(e3) {
  e3.Bearer = "Bearer", e3.DPoP = "DPoP";
})(At || (At = {}));
var xt = class {
  constructor(e3, t2) {
    this.hooks = t2, this.config = Object.assign(Object.assign({}, e3), { fetch: e3.fetch || ("undefined" == typeof window ? fetch : window.fetch.bind(window)) });
  }
  isAbsoluteUrl(e3) {
    return /^(https?:)?\/\//i.test(e3);
  }
  buildUrl(e3, t2) {
    if (t2) {
      if (this.isAbsoluteUrl(t2)) return t2;
      if (e3) return "".concat(e3.replace(/\/?\/$/, ""), "/").concat(t2.replace(/^\/+/, ""));
    }
    throw new TypeError("`url` must be absolute or `baseUrl` non-empty.");
  }
  getAccessToken(e3) {
    return this.config.getAccessToken ? this.config.getAccessToken(e3) : this.hooks.getAccessToken(e3);
  }
  extractUrl(e3) {
    return "string" == typeof e3 ? e3 : e3 instanceof URL ? e3.href : e3.url;
  }
  buildBaseRequest(e3, t2) {
    if (!this.config.baseUrl) return new Request(e3, t2);
    const n2 = this.buildUrl(this.config.baseUrl, this.extractUrl(e3)), o2 = e3 instanceof Request ? new Request(n2, e3) : n2;
    return new Request(o2, t2);
  }
  setAuthorizationHeader(e3, t2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : At.Bearer;
    e3.headers.set("authorization", "".concat(n2, " ").concat(t2));
  }
  async setDpopProofHeader(e3, t2) {
    if (!this.config.dpopNonceId) return;
    const n2 = await this.hooks.getDpopNonce(), o2 = await this.hooks.generateDpopProof({ accessToken: t2, method: e3.method, nonce: n2, url: e3.url });
    e3.headers.set("dpop", o2);
  }
  async prepareRequest(e3, t2) {
    const n2 = await this.getAccessToken(t2);
    if (void 0 === n2) throw new E("missing_access_token", "No access token available");
    let o2, i2;
    "string" == typeof n2 ? (o2 = this.config.dpopNonceId ? At.DPoP : At.Bearer, i2 = n2) : (o2 = n2.token_type, i2 = n2.access_token), this.setAuthorizationHeader(e3, i2, o2), o2 === At.DPoP && await this.setDpopProofHeader(e3, i2);
  }
  getHeader(e3, t2) {
    return Array.isArray(e3) ? new Headers(e3).get(t2) || "" : "function" == typeof e3.get ? e3.get(t2) || "" : e3[t2] || "";
  }
  hasUseDpopNonceError(e3) {
    if (401 !== e3.status) return false;
    const t2 = this.getHeader(e3.headers, "www-authenticate");
    return t2.includes("invalid_dpop_nonce") || t2.includes("use_dpop_nonce");
  }
  async handleResponse(e3, t2) {
    const n2 = this.getHeader(e3.headers, Ie);
    if (n2 && await this.hooks.setDpopNonce(n2), !this.hasUseDpopNonceError(e3)) return e3;
    if (!n2 || !t2.onUseDpopNonceError) throw new K(n2);
    return t2.onUseDpopNonceError();
  }
  async internalFetchWithAuth(e3, t2, n2, o2) {
    const i2 = this.buildBaseRequest(e3, t2);
    await this.prepareRequest(i2, o2);
    const r2 = await this.config.fetch(i2);
    return this.handleResponse(r2, n2);
  }
  fetchWithAuth(e3, t2, n2) {
    const o2 = { onUseDpopNonceError: () => this.internalFetchWithAuth(e3, t2, Object.assign(Object.assign({}, o2), { onUseDpopNonceError: void 0 }), n2) };
    return this.internalFetchWithAuth(e3, t2, o2, n2);
  }
};
var It = class {
  constructor(e3, t2) {
    this.myAccountFetcher = e3, this.apiBase = t2;
  }
  async connectAccount(e3) {
    const t2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/connected-accounts/connect"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e3) }, { scope: ["create:me:connected_accounts"] });
    return this._handleResponse(t2);
  }
  async completeAccount(e3) {
    const t2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/connected-accounts/complete"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e3) }, { scope: ["create:me:connected_accounts"] });
    return this._handleResponse(t2);
  }
  async getFactors() {
    const e3 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/factors"), { method: "GET" }, { scope: ["read:me:factors"] });
    return (await this._handleResponse(e3)).factors;
  }
  async getAuthenticationMethods(e3) {
    const t2 = e3 ? "?".concat(new URLSearchParams({ type: e3 })) : "", n2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/authentication-methods").concat(t2), { method: "GET" }, { scope: ["read:me:authentication_methods"] });
    return (await this._handleResponse(n2)).authentication_methods;
  }
  async getAuthenticationMethod(e3) {
    const t2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/authentication-methods/").concat(encodeURIComponent(e3)), { method: "GET" }, { scope: ["read:me:authentication_methods"] });
    return this._handleResponse(t2);
  }
  async deleteAuthenticationMethod(e3) {
    const t2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/authentication-methods/").concat(encodeURIComponent(e3)), { method: "DELETE" }, { scope: ["delete:me:authentication_methods"] });
    t2.ok || await this._handleResponse(t2);
  }
  async updateAuthenticationMethod(e3, t2) {
    const n2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/authentication-methods/").concat(encodeURIComponent(e3)), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t2) }, { scope: ["update:me:authentication_methods"] });
    return this._handleResponse(n2);
  }
  async enrollmentChallenge(e3) {
    var t2;
    const n2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/authentication-methods"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e3) }, { scope: ["create:me:authentication_methods"] }), o2 = await this._handleResponse(n2), i2 = null !== (t2 = n2.headers.get("location")) && void 0 !== t2 ? t2 : "", r2 = decodeURIComponent(i2.split("/").pop() || "");
    return Object.assign(Object.assign({}, o2), { id: r2, location: i2 });
  }
  async enrollmentVerify(t2) {
    const n2 = t2, o2 = n2.location;
    n2.type;
    const i2 = e(n2, ["location", "type"]), r2 = await this.myAccountFetcher.fetchWithAuth("".concat(o2, "/verify"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(i2) }, { scope: ["create:me:authentication_methods"] });
    return this._handleResponse(r2);
  }
  async getUserProfile(e3) {
    var t2;
    const n2 = new URLSearchParams();
    (null === (t2 = null == e3 ? void 0 : e3.fields) || void 0 === t2 ? void 0 : t2.length) && n2.set("fields", e3.fields.join(",")), false === (null == e3 ? void 0 : e3.includeFields) && n2.set("include_fields", "false");
    const o2 = n2.toString() ? "?".concat(n2) : "", i2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/profile").concat(o2), { method: "GET" }, { scope: ["read:me:profile"] });
    return this._handleResponse(i2);
  }
  async updateUserProfile(e3) {
    const t2 = await this.myAccountFetcher.fetchWithAuth("".concat(this.apiBase, "v1/profile"), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(e3) }, { scope: ["update:me:profile"] });
    return this._handleResponse(t2);
  }
  async _handleResponse(e3) {
    let t2;
    try {
      t2 = await e3.text(), t2 = JSON.parse(t2);
    } catch (n2) {
      throw new Ot({ type: "invalid_json", status: e3.status, title: "Invalid JSON response", detail: t2 || String(n2) });
    }
    if (e3.ok) return t2;
    throw new Ot(t2);
  }
};
var Ot = class _Ot extends Error {
  constructor(e3) {
    let t2 = e3.type, n2 = e3.status, o2 = e3.title, i2 = e3.detail, r2 = e3.validation_errors;
    super(i2), this.name = "MyAccountApiError", this.type = t2, this.status = n2, this.title = o2, this.detail = i2, this.validation_errors = r2, Object.setPrototypeOf(this, _Ot.prototype);
  }
};
var jt = { otp: { authenticatorTypes: ["otp"] }, sms: { authenticatorTypes: ["oob"], oobChannels: ["sms"] }, email: { authenticatorTypes: ["oob"], oobChannels: ["email"] }, push: { authenticatorTypes: ["oob"], oobChannels: ["auth0"] }, voice: { authenticatorTypes: ["oob"], oobChannels: ["voice"] } };
var Wt = "http://auth0.com/oauth/grant-type/mfa-otp";
var Nt = "http://auth0.com/oauth/grant-type/mfa-oob";
var Mt = "http://auth0.com/oauth/grant-type/mfa-recovery-code";
var Ut;
var Lt;
var Kt;
if ("undefined" == typeof navigator || null === (Ut = navigator.userAgent) || void 0 === Ut || null === (Lt = Ut.startsWith) || void 0 === Lt || !Lt.call(Ut, "Mozilla/5.0 ")) {
  const e3 = "v3.8.6";
  Kt = "".concat("oauth4webapi", "/").concat(e3);
}
function zt(e3, t2) {
  if (null == e3) return false;
  try {
    return e3 instanceof t2 || Object.getPrototypeOf(e3)[Symbol.toStringTag] === t2.prototype[Symbol.toStringTag];
  } catch (e4) {
    return false;
  }
}
var Jt = "ERR_INVALID_ARG_VALUE";
var Dt = "ERR_INVALID_ARG_TYPE";
function Ht(e3, t2, n2) {
  const o2 = new TypeError(e3, { cause: n2 });
  return Object.assign(o2, { code: t2 }), o2;
}
var Zt = Symbol();
var Ft = Symbol();
var Vt = Symbol();
var Xt = Symbol();
var Gt = Symbol();
var qt = Symbol();
var Yt = new TextEncoder();
var Bt = new TextDecoder();
function Qt(e3) {
  return "string" == typeof e3 ? Yt.encode(e3) : Bt.decode(e3);
}
var $t;
var en;
if (Uint8Array.prototype.toBase64) $t = (e3) => (e3 instanceof ArrayBuffer && (e3 = new Uint8Array(e3)), e3.toBase64({ alphabet: "base64url", omitPadding: true }));
else {
  const e3 = 32768;
  $t = (t2) => {
    t2 instanceof ArrayBuffer && (t2 = new Uint8Array(t2));
    const n2 = [];
    for (let o2 = 0; o2 < t2.byteLength; o2 += e3) n2.push(String.fromCharCode.apply(null, t2.subarray(o2, o2 + e3)));
    return btoa(n2.join("")).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  };
}
function tn(e3) {
  return "string" == typeof e3 ? en(e3) : $t(e3);
}
en = Uint8Array.fromBase64 ? (e3) => {
  try {
    return Uint8Array.fromBase64(e3, { alphabet: "base64url" });
  } catch (e4) {
    throw Ht("The input to be decoded is not correctly encoded.", Jt, e4);
  }
} : (e3) => {
  try {
    const t2 = atob(e3.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, "")), n2 = new Uint8Array(t2.length);
    for (let e4 = 0; e4 < t2.length; e4++) n2[e4] = t2.charCodeAt(e4);
    return n2;
  } catch (e4) {
    throw Ht("The input to be decoded is not correctly encoded.", Jt, e4);
  }
};
var nn = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "code", void 0), this.name = this.constructor.name, this.code = lo, null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
var on = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "code", void 0), this.name = this.constructor.name, null != t2 && t2.code && (this.code = null == t2 ? void 0 : t2.code), null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
function rn(e3, t2, n2) {
  return new on(e3, { code: t2, cause: n2 });
}
function sn(e3, t2) {
  if ((function(e4, t3) {
    if (!(e4 instanceof CryptoKey)) throw Ht("".concat(t3, " must be a CryptoKey"), Dt);
  })(e3, t2), "private" !== e3.type) throw Ht("".concat(t2, " must be a private CryptoKey"), Jt);
}
function an(e3) {
  return null !== e3 && "object" == typeof e3 && !Array.isArray(e3);
}
function cn(e3) {
  zt(e3, Headers) && (e3 = Object.fromEntries(e3.entries()));
  const t2 = new Headers(null != e3 ? e3 : {});
  if (Kt && !t2.has("user-agent") && t2.set("user-agent", Kt), t2.has("authorization")) throw Ht('"options.headers" must not include the "authorization" header name', Jt);
  return t2;
}
function un(e3, t2) {
  if (void 0 !== t2) {
    if ("function" == typeof t2 && (t2 = t2(e3.href)), !(t2 instanceof AbortSignal)) throw Ht('"options.signal" must return or be an instance of AbortSignal', Dt);
    return t2;
  }
}
function ln(e3) {
  return e3.includes("//") ? e3.replace("//", "/") : e3;
}
async function dn(e3, t2) {
  return (async function(e4, t3, n2, o2) {
    if (!(e4 instanceof URL)) throw Ht('"'.concat(t3, '" must be an instance of URL'), Dt);
    Pn(e4, true !== (null == o2 ? void 0 : o2[Zt]));
    const i2 = n2(new URL(e4.href)), r2 = cn(null == o2 ? void 0 : o2.headers);
    return r2.set("accept", "application/json"), ((null == o2 ? void 0 : o2[Xt]) || fetch)(i2.href, { body: void 0, headers: Object.fromEntries(r2.entries()), method: "GET", redirect: "manual", signal: un(i2, null == o2 ? void 0 : o2.signal) });
  })(e3, "issuerIdentifier", (e4) => {
    switch (null == t2 ? void 0 : t2.algorithm) {
      case void 0:
      case "oidc":
        !(function(e5, t3) {
          e5.pathname = ln("".concat(e5.pathname, "/").concat(t3));
        })(e4, ".well-known/openid-configuration");
        break;
      case "oauth2":
        !(function(e5, t3) {
          let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
          "/" === e5.pathname ? e5.pathname = t3 : e5.pathname = ln("".concat(t3, "/").concat(n2 ? e5.pathname : e5.pathname.replace(/(\/)$/, "")));
        })(e4, ".well-known/oauth-authorization-server");
        break;
      default:
        throw Ht('"options.algorithm" must be "oidc" (default), or "oauth2"', Jt);
    }
    return e4;
  }, t2);
}
function hn(e3, t2, n2, o2, i2) {
  try {
    if ("number" != typeof e3 || !Number.isFinite(e3)) throw Ht("".concat(n2, " must be a number"), Dt, i2);
    if (e3 > 0) return;
    if (t2) {
      if (0 !== e3) throw Ht("".concat(n2, " must be a non-negative number"), Jt, i2);
      return;
    }
    throw Ht("".concat(n2, " must be a positive number"), Jt, i2);
  } catch (e4) {
    if (o2) throw rn(e4.message, o2, i2);
    throw e4;
  }
}
function pn(e3, t2, n2, o2) {
  try {
    if ("string" != typeof e3) throw Ht("".concat(t2, " must be a string"), Dt, o2);
    if (0 === e3.length) throw Ht("".concat(t2, " must not be empty"), Jt, o2);
  } catch (e4) {
    if (n2) throw rn(e4.message, n2, o2);
    throw e4;
  }
}
function fn(e3) {
  !(function(e4, t2) {
    if (Dn(e4) !== t2) throw (function(e5) {
      let t3 = '"response" content-type must be ';
      for (var n2 = arguments.length, o2 = new Array(n2 > 1 ? n2 - 1 : 0), i2 = 1; i2 < n2; i2++) o2[i2 - 1] = arguments[i2];
      if (o2.length > 2) {
        const e6 = o2.pop();
        t3 += "".concat(o2.join(", "), ", or ").concat(e6);
      } else 2 === o2.length ? t3 += "".concat(o2[0], " or ").concat(o2[1]) : t3 += o2[0];
      return rn(t3, yo, e5);
    })(e4, t2);
  })(e3, "application/json");
}
function mn() {
  return tn(crypto.getRandomValues(new Uint8Array(32)));
}
function yn(e3) {
  switch (e3.algorithm.name) {
    case "RSA-PSS":
      return (function(e4) {
        switch (e4.algorithm.hash.name) {
          case "SHA-256":
            return "PS256";
          case "SHA-384":
            return "PS384";
          case "SHA-512":
            return "PS512";
          default:
            throw new nn("unsupported RsaHashedKeyAlgorithm hash name", { cause: e4 });
        }
      })(e3);
    case "RSASSA-PKCS1-v1_5":
      return (function(e4) {
        switch (e4.algorithm.hash.name) {
          case "SHA-256":
            return "RS256";
          case "SHA-384":
            return "RS384";
          case "SHA-512":
            return "RS512";
          default:
            throw new nn("unsupported RsaHashedKeyAlgorithm hash name", { cause: e4 });
        }
      })(e3);
    case "ECDSA":
      return (function(e4) {
        switch (e4.algorithm.namedCurve) {
          case "P-256":
            return "ES256";
          case "P-384":
            return "ES384";
          case "P-521":
            return "ES512";
          default:
            throw new nn("unsupported EcKeyAlgorithm namedCurve", { cause: e4 });
        }
      })(e3);
    case "Ed25519":
    case "ML-DSA-44":
    case "ML-DSA-65":
    case "ML-DSA-87":
      return e3.algorithm.name;
    case "EdDSA":
      return "Ed25519";
    default:
      throw new nn("unsupported CryptoKey algorithm name", { cause: e3 });
  }
}
function wn(e3) {
  const t2 = null == e3 ? void 0 : e3[Ft];
  return "number" == typeof t2 && Number.isFinite(t2) ? t2 : 0;
}
function gn(e3) {
  const t2 = null == e3 ? void 0 : e3[Vt];
  return "number" == typeof t2 && Number.isFinite(t2) && -1 !== Math.sign(t2) ? t2 : 30;
}
function vn() {
  return Math.floor(Date.now() / 1e3);
}
function bn(e3) {
  if ("object" != typeof e3 || null === e3) throw Ht('"as" must be an object', Dt);
  pn(e3.issuer, '"as.issuer"');
}
function _n(e3) {
  if ("object" != typeof e3 || null === e3) throw Ht('"client" must be an object', Dt);
  pn(e3.client_id, '"client.client_id"');
}
function kn(e3) {
  return pn(e3, '"clientSecret"'), (t2, n2, o2, i2) => {
    o2.set("client_id", n2.client_id), o2.set("client_secret", e3);
  };
}
function Sn(e3, t2) {
  const n2 = (r2 = e3) instanceof CryptoKey ? { key: r2 } : (null == r2 ? void 0 : r2.key) instanceof CryptoKey ? (void 0 !== r2.kid && pn(r2.kid, '"kid"'), { key: r2.key, kid: r2.kid }) : {}, o2 = n2.key, i2 = n2.kid;
  var r2;
  return sn(o2, '"clientPrivateKey.key"'), async (e4, n3, r3, s2) => {
    var a2;
    const c2 = { alg: yn(o2), kid: i2 }, u2 = (function(e5, t3) {
      const n4 = vn() + wn(t3);
      return { jti: mn(), aud: e5.issuer, exp: n4 + 60, iat: n4, nbf: n4, iss: t3.client_id, sub: t3.client_id };
    })(e4, n3);
    null == t2 || null === (a2 = t2[Gt]) || void 0 === a2 || a2.call(t2, c2, u2), r3.set("client_id", n3.client_id), r3.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"), r3.set("client_assertion", await (async function(e5, t3, n4) {
      if (!n4.usages.includes("sign")) throw Ht('CryptoKey instances used for signing assertions must include "sign" in their "usages"', Jt);
      const o3 = "".concat(tn(Qt(JSON.stringify(e5))), ".").concat(tn(Qt(JSON.stringify(t3)))), i3 = tn(await crypto.subtle.sign((function(e6) {
        switch (e6.algorithm.name) {
          case "ECDSA":
            return { name: e6.algorithm.name, hash: Ro(e6) };
          case "RSA-PSS":
            switch (Eo(e6), e6.algorithm.hash.name) {
              case "SHA-256":
              case "SHA-384":
              case "SHA-512":
                return { name: e6.algorithm.name, saltLength: parseInt(e6.algorithm.hash.name.slice(-3), 10) >> 3 };
              default:
                throw new nn("unsupported RSA-PSS hash name", { cause: e6 });
            }
          case "RSASSA-PKCS1-v1_5":
            return Eo(e6), e6.algorithm.name;
          case "ML-DSA-44":
          case "ML-DSA-65":
          case "ML-DSA-87":
          case "Ed25519":
            return e6.algorithm.name;
        }
        throw new nn("unsupported CryptoKey algorithm name", { cause: e6 });
      })(n4), n4, Qt(o3)));
      return "".concat(o3, ".").concat(i3);
    })(c2, u2, o2));
  };
}
var Tn = URL.parse ? (e3, t2) => URL.parse(e3, t2) : (e3, t2) => {
  try {
    return new URL(e3, t2);
  } catch (e4) {
    return null;
  }
};
function Pn(e3, t2) {
  if (t2 && "https:" !== e3.protocol) throw rn("only requests to HTTPS are allowed", go, e3);
  if ("https:" !== e3.protocol && "http:" !== e3.protocol) throw rn("only HTTP and HTTPS requests are allowed", vo, e3);
}
function Cn(e3, t2, n2, o2) {
  let i2;
  if ("string" != typeof e3 || !(i2 = Tn(e3))) throw rn("authorization server metadata does not contain a valid ".concat(n2 ? '"as.mtls_endpoint_aliases.'.concat(t2, '"') : '"as.'.concat(t2, '"')), void 0 === e3 ? So : To, { attribute: n2 ? "mtls_endpoint_aliases.".concat(t2) : t2 });
  return Pn(i2, o2), i2;
}
function En(e3, t2, n2, o2) {
  return n2 && e3.mtls_endpoint_aliases && t2 in e3.mtls_endpoint_aliases ? Cn(e3.mtls_endpoint_aliases[t2], t2, n2, o2) : Cn(e3[t2], t2, n2, o2);
}
var Rn = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "error", void 0), h(this, "status", void 0), h(this, "error_description", void 0), h(this, "response", void 0), this.name = this.constructor.name, this.code = uo, this.cause = t2.cause, this.error = t2.cause.error, this.status = t2.response.status, this.error_description = t2.cause.error_description, Object.defineProperty(this, "response", { enumerable: false, value: t2.response }), null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
var An = class extends Error {
  constructor(e3, t2) {
    var n2, o2;
    super(e3, t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "error", void 0), h(this, "error_description", void 0), this.name = this.constructor.name, this.code = ho, this.cause = t2.cause, this.error = t2.cause.get("error"), this.error_description = null !== (n2 = t2.cause.get("error_description")) && void 0 !== n2 ? n2 : void 0, null === (o2 = Error.captureStackTrace) || void 0 === o2 || o2.call(Error, this, this.constructor);
  }
};
var xn = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "response", void 0), h(this, "status", void 0), this.name = this.constructor.name, this.code = co, this.cause = t2.cause, this.status = t2.response.status, this.response = t2.response, Object.defineProperty(this, "response", { enumerable: false }), null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
var In = "[a-zA-Z0-9!#$%&\\'\\*\\+\\-\\.\\^_`\\|~]+";
var On = "(" + In + ')\\s*=\\s*"((?:[^"\\\\]|\\\\[\\s\\S])*)"';
var jn = "(" + In + ")\\s*=\\s*(" + In + ")";
var Wn = new RegExp("^[,\\s]*(" + In + ")");
var Nn = new RegExp("^[,\\s]*" + On + "[,\\s]*(.*)");
var Mn = new RegExp("^[,\\s]*" + jn + "[,\\s]*(.*)");
var Un = new RegExp("^([a-zA-Z0-9\\-\\._\\~\\+\\/]+={0,2})(?:$|[,\\s])(.*)");
async function Ln(e3, t2, n2) {
  if (e3.status !== t2) {
    let t3;
    var o2;
    if (Yn(e3), t3 = await (async function(e4) {
      if (e4.status > 399 && e4.status < 500) {
        Co(e4), fn(e4);
        try {
          const t4 = await e4.clone().json();
          if (an(t4) && "string" == typeof t4.error && t4.error.length) return t4;
        } catch (e5) {
        }
      }
    })(e3)) throw await (null === (o2 = e3.body) || void 0 === o2 ? void 0 : o2.cancel()), new Rn("server responded with an error in the response body", { cause: t3, response: e3 });
    throw rn('"response" is not a conform '.concat(n2, " response (unexpected HTTP status code)"), wo, e3);
  }
}
function Kn(e3) {
  if (!to.has(e3)) throw Ht('"options.DPoP" is not a valid DPoPHandle', Jt);
}
async function zn(e3, t2, n2, o2) {
  bn(e3), _n(t2);
  const i2 = En(e3, "userinfo_endpoint", t2.use_mtls_endpoint_aliases, true !== (null == o2 ? void 0 : o2[Zt])), r2 = cn(null == o2 ? void 0 : o2.headers);
  return t2.userinfo_signed_response_alg ? r2.set("accept", "application/jwt") : (r2.set("accept", "application/json"), r2.append("accept", "application/jwt")), (async function(e4, t3, n3, o3, i3, r3) {
    var s2;
    if (pn(e4, '"accessToken"'), !(n3 instanceof URL)) throw Ht('"url" must be an instance of URL', Dt);
    Pn(n3, true !== (null == r3 ? void 0 : r3[Zt])), o3 = cn(o3), null != r3 && r3.DPoP && (Kn(r3.DPoP), await r3.DPoP.addProof(n3, o3, t3.toUpperCase(), e4)), o3.set("authorization", "".concat(o3.has("dpop") ? "DPoP" : "Bearer", " ").concat(e4));
    const a2 = await ((null == r3 ? void 0 : r3[Xt]) || fetch)(n3.href, { duplex: zt(i3, ReadableStream) ? "half" : void 0, body: i3, headers: Object.fromEntries(o3.entries()), method: t3, redirect: "manual", signal: un(n3, null == r3 ? void 0 : r3.signal) });
    return null == r3 || null === (s2 = r3.DPoP) || void 0 === s2 || s2.cacheNonce(a2, n3), a2;
  })(n2, "GET", i2, r2, null, f(f({}, o2), {}, { [Ft]: wn(t2) }));
}
var Jn = Symbol();
function Dn(e3) {
  var t2;
  return null === (t2 = e3.headers.get("content-type")) || void 0 === t2 ? void 0 : t2.split(";")[0];
}
async function Hn(e3, t2, n2, o2, i2) {
  if (bn(e3), _n(t2), !zt(o2, Response)) throw Ht('"response" must be an instance of Response', Dt);
  if (Yn(o2), 200 !== o2.status) throw rn('"response" is not a conform UserInfo Endpoint response (unexpected HTTP status code)', wo, o2);
  let r2;
  if (Co(o2), "application/jwt" === Dn(o2)) {
    const n3 = await Ao(await o2.text(), Io.bind(void 0, t2.userinfo_signed_response_alg, e3.userinfo_signing_alg_values_supported, void 0), wn(t2), gn(t2), null == i2 ? void 0 : i2[qt]).then(Bn.bind(void 0, t2.client_id)).then($n.bind(void 0, e3)), s2 = n3.claims, a2 = n3.jwt;
    Xn.set(o2, a2), r2 = s2;
  } else {
    if (t2.userinfo_signed_response_alg) throw rn("JWT UserInfo Response expected", po, o2);
    r2 = await Mo(o2);
  }
  if (pn(r2.sub, '"response" body "sub" property', mo, { body: r2 }), n2 === Jn) ;
  else if (pn(n2, '"expectedSubject"'), r2.sub !== n2) throw rn('unexpected "response" body "sub" property value', ko, { expected: n2, body: r2, attribute: "sub" });
  return r2;
}
async function Zn(e3, t2, n2, o2, i2, r2, s2) {
  return await n2(e3, t2, i2, r2), r2.set("content-type", "application/x-www-form-urlencoded;charset=UTF-8"), ((null == s2 ? void 0 : s2[Xt]) || fetch)(o2.href, { body: i2, headers: Object.fromEntries(r2.entries()), method: "POST", redirect: "manual", signal: un(o2, null == s2 ? void 0 : s2.signal) });
}
async function Fn(e3, t2, n2, o2, i2, r2) {
  var s2;
  const a2 = En(e3, "token_endpoint", t2.use_mtls_endpoint_aliases, true !== (null == r2 ? void 0 : r2[Zt]));
  i2.set("grant_type", o2);
  const c2 = cn(null == r2 ? void 0 : r2.headers);
  c2.set("accept", "application/json"), void 0 !== (null == r2 ? void 0 : r2.DPoP) && (Kn(r2.DPoP), await r2.DPoP.addProof(a2, c2, "POST"));
  const u2 = await Zn(e3, t2, n2, a2, i2, c2, r2);
  return null == r2 || null === (s2 = r2.DPoP) || void 0 === s2 || s2.cacheNonce(u2, a2), u2;
}
var Vn = /* @__PURE__ */ new WeakMap();
var Xn = /* @__PURE__ */ new WeakMap();
function Gn(e3) {
  if (!e3.id_token) return;
  const t2 = Vn.get(e3);
  if (!t2) throw Ht('"ref" was already garbage collected or did not resolve from the proper sources', Jt);
  return t2;
}
async function qn(e3, t2, n2, o2, i2, r2) {
  if (bn(e3), _n(t2), !zt(n2, Response)) throw Ht('"response" must be an instance of Response', Dt);
  await Ln(n2, 200, "Token Endpoint"), Co(n2);
  const s2 = await Mo(n2);
  if (pn(s2.access_token, '"response" body "access_token" property', mo, { body: s2 }), pn(s2.token_type, '"response" body "token_type" property', mo, { body: s2 }), s2.token_type = s2.token_type.toLowerCase(), void 0 !== s2.expires_in) {
    let e4 = "number" != typeof s2.expires_in ? parseFloat(s2.expires_in) : s2.expires_in;
    hn(e4, true, '"response" body "expires_in" property', mo, { body: s2 }), s2.expires_in = e4;
  }
  if (void 0 !== s2.refresh_token && pn(s2.refresh_token, '"response" body "refresh_token" property', mo, { body: s2 }), void 0 !== s2.scope && "string" != typeof s2.scope) throw rn('"response" body "scope" property must be a string', mo, { body: s2 });
  if (void 0 !== s2.id_token) {
    pn(s2.id_token, '"response" body "id_token" property', mo, { body: s2 });
    const r3 = ["aud", "exp", "iat", "iss", "sub"];
    true === t2.require_auth_time && r3.push("auth_time"), void 0 !== t2.default_max_age && (hn(t2.default_max_age, true, '"client.default_max_age"'), r3.push("auth_time")), null != o2 && o2.length && r3.push(...o2);
    const a2 = await Ao(s2.id_token, Io.bind(void 0, t2.id_token_signed_response_alg, e3.id_token_signing_alg_values_supported, "RS256"), wn(t2), gn(t2), i2).then(io.bind(void 0, r3)).then(eo.bind(void 0, e3)).then(Qn.bind(void 0, t2.client_id)), c2 = a2.claims, u2 = a2.jwt;
    if (Array.isArray(c2.aud) && 1 !== c2.aud.length) {
      if (void 0 === c2.azp) throw rn('ID Token "aud" (audience) claim includes additional untrusted audiences', _o, { claims: c2, claim: "aud" });
      if (c2.azp !== t2.client_id) throw rn('unexpected ID Token "azp" (authorized party) claim value', _o, { expected: t2.client_id, claims: c2, claim: "azp" });
    }
    void 0 !== c2.auth_time && hn(c2.auth_time, true, 'ID Token "auth_time" (authentication time)', mo, { claims: c2 }), Xn.set(n2, u2), Vn.set(s2, c2);
  }
  if (void 0 !== (null == r2 ? void 0 : r2[s2.token_type])) r2[s2.token_type](n2, s2);
  else if ("dpop" !== s2.token_type && "bearer" !== s2.token_type) throw new nn("unsupported `token_type` value", { cause: { body: s2 } });
  return s2;
}
function Yn(e3) {
  let t2;
  if (t2 = (function(e4) {
    if (!zt(e4, Response)) throw Ht('"response" must be an instance of Response', Dt);
    const t3 = e4.headers.get("www-authenticate");
    if (null === t3) return;
    const n2 = [];
    let o2 = t3;
    for (; o2; ) {
      var i2;
      let e5 = o2.match(Wn);
      const t4 = null === (i2 = e5) || void 0 === i2 ? void 0 : i2[1].toLowerCase();
      if (!t4) return;
      const c2 = o2.substring(e5[0].length);
      if (c2 && !c2.match(/^[\s,]/)) return;
      const u2 = c2.match(/^\s+(.*)$/), l2 = !!u2;
      o2 = u2 ? u2[1] : void 0;
      const d2 = {};
      let h2;
      if (l2) for (; o2; ) {
        let t5, n3;
        if (e5 = o2.match(Nn)) {
          var r2 = y(e5, 4);
          if (t5 = r2[1], n3 = r2[2], o2 = r2[3], n3.includes("\\")) try {
            n3 = JSON.parse('"'.concat(n3, '"'));
          } catch (e6) {
          }
          d2[t5.toLowerCase()] = n3;
        } else {
          if (!(e5 = o2.match(Mn))) {
            if (e5 = o2.match(Un)) {
              if (Object.keys(d2).length) break;
              var s2 = y(e5, 3);
              h2 = s2[1], o2 = s2[2];
              break;
            }
            return;
          }
          var a2 = y(e5, 4);
          t5 = a2[1], n3 = a2[2], o2 = a2[3], d2[t5.toLowerCase()] = n3;
        }
      }
      else o2 = c2 || void 0;
      const p2 = { scheme: t4, parameters: d2 };
      h2 && (p2.token68 = h2), n2.push(p2);
    }
    return n2.length ? n2 : void 0;
  })(e3)) throw new xn("server responded with a challenge in the WWW-Authenticate HTTP Header", { cause: t2, response: e3 });
}
function Bn(e3, t2) {
  return void 0 !== t2.claims.aud ? Qn(e3, t2) : t2;
}
function Qn(e3, t2) {
  if (Array.isArray(t2.claims.aud)) {
    if (!t2.claims.aud.includes(e3)) throw rn('unexpected JWT "aud" (audience) claim value', _o, { expected: e3, claims: t2.claims, claim: "aud" });
  } else if (t2.claims.aud !== e3) throw rn('unexpected JWT "aud" (audience) claim value', _o, { expected: e3, claims: t2.claims, claim: "aud" });
  return t2;
}
function $n(e3, t2) {
  return void 0 !== t2.claims.iss ? eo(e3, t2) : t2;
}
function eo(e3, t2) {
  var n2, o2;
  const i2 = null !== (n2 = null === (o2 = e3[Lo]) || void 0 === o2 ? void 0 : o2.call(e3, t2)) && void 0 !== n2 ? n2 : e3.issuer;
  if (t2.claims.iss !== i2) throw rn('unexpected JWT "iss" (issuer) claim value', _o, { expected: i2, claims: t2.claims, claim: "iss" });
  return t2;
}
var to = /* @__PURE__ */ new WeakSet();
var no = Symbol();
var oo = { aud: "audience", c_hash: "code hash", client_id: "client id", exp: "expiration time", iat: "issued at", iss: "issuer", jti: "jwt id", nonce: "nonce", s_hash: "state hash", sub: "subject", ath: "access token hash", htm: "http method", htu: "http uri", cnf: "confirmation", auth_time: "authentication time" };
function io(e3, t2) {
  for (const n2 of e3) if (void 0 === t2.claims[n2]) throw rn('JWT "'.concat(n2, '" (').concat(oo[n2], ") claim missing"), mo, { claims: t2.claims });
  return t2;
}
var ro = Symbol();
var so = Symbol();
async function ao(e3, t2, n2, o2) {
  return "string" == typeof (null == o2 ? void 0 : o2.expectedNonce) || "number" == typeof (null == o2 ? void 0 : o2.maxAge) || null != o2 && o2.requireIdToken ? (async function(e4, t3, n3, o3, i2, r2, s2) {
    const a2 = [];
    switch (o3) {
      case void 0:
        o3 = ro;
        break;
      case ro:
        break;
      default:
        pn(o3, '"expectedNonce" argument'), a2.push("nonce");
    }
    switch (null != i2 || (i2 = t3.default_max_age), i2) {
      case void 0:
        i2 = so;
        break;
      case so:
        break;
      default:
        hn(i2, true, '"maxAge" argument'), a2.push("auth_time");
    }
    const c2 = await qn(e4, t3, n3, a2, r2, s2);
    pn(c2.id_token, '"response" body "id_token" property', mo, { body: c2 });
    const u2 = Gn(c2);
    if (i2 !== so) {
      const e5 = vn() + wn(t3), n4 = gn(t3);
      if (u2.auth_time + i2 < e5 - n4) throw rn("too much time has elapsed since the last End-User authentication", bo, { claims: u2, now: e5, tolerance: n4, claim: "auth_time" });
    }
    if (o3 === ro) {
      if (void 0 !== u2.nonce) throw rn('unexpected ID Token "nonce" claim value', _o, { expected: void 0, claims: u2, claim: "nonce" });
    } else if (u2.nonce !== o3) throw rn('unexpected ID Token "nonce" claim value', _o, { expected: o3, claims: u2, claim: "nonce" });
    return c2;
  })(e3, t2, n2, o2.expectedNonce, o2.maxAge, o2[qt], o2.recognizedTokenTypes) : (async function(e4, t3, n3, o3, i2) {
    const r2 = await qn(e4, t3, n3, void 0, o3, i2), s2 = Gn(r2);
    if (s2) {
      if (void 0 !== t3.default_max_age) {
        hn(t3.default_max_age, true, '"client.default_max_age"');
        const e5 = vn() + wn(t3), n4 = gn(t3);
        if (s2.auth_time + t3.default_max_age < e5 - n4) throw rn("too much time has elapsed since the last End-User authentication", bo, { claims: s2, now: e5, tolerance: n4, claim: "auth_time" });
      }
      if (void 0 !== s2.nonce) throw rn('unexpected ID Token "nonce" claim value', _o, { expected: void 0, claims: s2, claim: "nonce" });
    }
    return r2;
  })(e3, t2, n2, null == o2 ? void 0 : o2[qt], null == o2 ? void 0 : o2.recognizedTokenTypes);
}
var co = "OAUTH_WWW_AUTHENTICATE_CHALLENGE";
var uo = "OAUTH_RESPONSE_BODY_ERROR";
var lo = "OAUTH_UNSUPPORTED_OPERATION";
var ho = "OAUTH_AUTHORIZATION_RESPONSE_ERROR";
var po = "OAUTH_JWT_USERINFO_EXPECTED";
var fo = "OAUTH_PARSE_ERROR";
var mo = "OAUTH_INVALID_RESPONSE";
var yo = "OAUTH_RESPONSE_IS_NOT_JSON";
var wo = "OAUTH_RESPONSE_IS_NOT_CONFORM";
var go = "OAUTH_HTTP_REQUEST_FORBIDDEN";
var vo = "OAUTH_REQUEST_PROTOCOL_FORBIDDEN";
var bo = "OAUTH_JWT_TIMESTAMP_CHECK_FAILED";
var _o = "OAUTH_JWT_CLAIM_COMPARISON_FAILED";
var ko = "OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED";
var So = "OAUTH_MISSING_SERVER_METADATA";
var To = "OAUTH_INVALID_SERVER_METADATA";
async function Po(e3) {
  if (!zt(e3, Response)) throw Ht('"response" must be an instance of Response', Dt);
  await Ln(e3, 200, "Revocation Endpoint");
}
function Co(e3) {
  if (e3.bodyUsed) throw Ht('"response" body has been used already', Jt);
}
function Eo(e3) {
  const t2 = e3.algorithm;
  if ("number" != typeof t2.modulusLength || t2.modulusLength < 2048) throw new nn("unsupported ".concat(t2.name, " modulusLength"), { cause: e3 });
}
function Ro(e3) {
  switch (e3.algorithm.namedCurve) {
    case "P-256":
      return "SHA-256";
    case "P-384":
      return "SHA-384";
    case "P-521":
      return "SHA-512";
    default:
      throw new nn("unsupported ECDSA namedCurve", { cause: e3 });
  }
}
async function Ao(e3, t2, n2, o2, i2) {
  let r2, s2, a2 = e3.split("."), c2 = a2[0], u2 = a2[1], l2 = a2.length;
  if (5 === l2) {
    if (void 0 === i2) throw new nn("JWE decryption is not configured", { cause: e3 });
    var d2 = (e3 = await i2(e3)).split(".");
    c2 = d2[0], u2 = d2[1], l2 = d2.length;
  }
  if (3 !== l2) throw rn("Invalid JWT", mo, e3);
  try {
    r2 = JSON.parse(Qt(tn(c2)));
  } catch (e4) {
    throw rn("failed to parse JWT Header body as base64url encoded JSON", fo, e4);
  }
  if (!an(r2)) throw rn("JWT Header must be a top level object", mo, e3);
  if (t2(r2), void 0 !== r2.crit) throw new nn('no JWT "crit" header parameter extensions are supported', { cause: { header: r2 } });
  try {
    s2 = JSON.parse(Qt(tn(u2)));
  } catch (e4) {
    throw rn("failed to parse JWT Payload body as base64url encoded JSON", fo, e4);
  }
  if (!an(s2)) throw rn("JWT Payload must be a top level object", mo, e3);
  const h2 = vn() + n2;
  if (void 0 !== s2.exp) {
    if ("number" != typeof s2.exp) throw rn('unexpected JWT "exp" (expiration time) claim type', mo, { claims: s2 });
    if (s2.exp <= h2 - o2) throw rn('unexpected JWT "exp" (expiration time) claim value, expiration is past current timestamp', bo, { claims: s2, now: h2, tolerance: o2, claim: "exp" });
  }
  if (void 0 !== s2.iat && "number" != typeof s2.iat) throw rn('unexpected JWT "iat" (issued at) claim type', mo, { claims: s2 });
  if (void 0 !== s2.iss && "string" != typeof s2.iss) throw rn('unexpected JWT "iss" (issuer) claim type', mo, { claims: s2 });
  if (void 0 !== s2.nbf) {
    if ("number" != typeof s2.nbf) throw rn('unexpected JWT "nbf" (not before) claim type', mo, { claims: s2 });
    if (s2.nbf > h2 + o2) throw rn('unexpected JWT "nbf" (not before) claim value', bo, { claims: s2, now: h2, tolerance: o2, claim: "nbf" });
  }
  if (void 0 !== s2.aud && "string" != typeof s2.aud && !Array.isArray(s2.aud)) throw rn('unexpected JWT "aud" (audience) claim type', mo, { claims: s2 });
  return { header: r2, claims: s2, jwt: e3 };
}
async function xo(e3) {
  if ("POST" !== e3.method) throw Ht("form_post responses are expected to use the POST method", Jt, { cause: e3 });
  if ("application/x-www-form-urlencoded" !== Dn(e3)) throw Ht("form_post responses are expected to use the application/x-www-form-urlencoded content-type", Jt, { cause: e3 });
  return (async function(e4) {
    if (e4.bodyUsed) throw Ht("form_post Request instances must contain a readable body", Jt, { cause: e4 });
    return e4.text();
  })(e3);
}
function Io(e3, t2, n2, o2) {
  if (void 0 === e3) if (Array.isArray(t2)) {
    if (!t2.includes(o2.alg)) throw rn('unexpected JWT "alg" header parameter', mo, { header: o2, expected: t2, reason: "authorization server metadata" });
  } else {
    if (void 0 === n2) throw rn('missing client or server configuration to verify used JWT "alg" header parameter', void 0, { client: e3, issuer: t2, fallback: n2 });
    if ("string" == typeof n2 ? o2.alg !== n2 : "function" == typeof n2 ? !n2(o2.alg) : !n2.includes(o2.alg)) throw rn('unexpected JWT "alg" header parameter', mo, { header: o2, expected: n2, reason: "default value" });
  }
  else if ("string" == typeof e3 ? o2.alg !== e3 : !e3.includes(o2.alg)) throw rn('unexpected JWT "alg" header parameter', mo, { header: o2, expected: e3, reason: "client configuration" });
}
function Oo(e3, t2) {
  const n2 = e3.getAll(t2), o2 = n2[0];
  if (n2.length > 1) throw rn('"'.concat(t2, '" parameter must be provided only once'), mo);
  return o2;
}
var jo = Symbol();
var Wo = Symbol();
function No(e3, t2, n2, o2) {
  if (bn(e3), _n(t2), n2 instanceof URL && (n2 = n2.searchParams), !(n2 instanceof URLSearchParams)) throw Ht('"parameters" must be an instance of URLSearchParams, or URL', Dt);
  if (Oo(n2, "response")) throw rn('"parameters" contains a JARM response, use validateJwtAuthResponse() instead of validateAuthResponse()', mo, { parameters: n2 });
  const i2 = Oo(n2, "iss"), r2 = Oo(n2, "state");
  if (!i2 && e3.authorization_response_iss_parameter_supported) throw rn('response parameter "iss" (issuer) missing', mo, { parameters: n2 });
  if (i2 && i2 !== e3.issuer) throw rn('unexpected "iss" (issuer) response parameter value', mo, { expected: e3.issuer, parameters: n2 });
  switch (o2) {
    case void 0:
    case Wo:
      if (void 0 !== r2) throw rn('unexpected "state" response parameter encountered', mo, { expected: void 0, parameters: n2 });
      break;
    case jo:
      break;
    default:
      if (pn(o2, '"expectedState" argument'), r2 !== o2) throw rn(void 0 === r2 ? 'response parameter "state" missing' : 'unexpected "state" response parameter value', mo, { expected: o2, parameters: n2 });
  }
  if (Oo(n2, "error")) throw new An("authorization response from the server is an error", { cause: n2 });
  const s2 = Oo(n2, "id_token"), a2 = Oo(n2, "token");
  if (void 0 !== s2 || void 0 !== a2) throw new nn("implicit and hybrid flows are not supported");
  return c2 = new URLSearchParams(n2), to.add(c2), c2;
  var c2;
}
async function Mo(e3) {
  let t2, n2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : fn;
  try {
    t2 = await e3.json();
  } catch (t3) {
    throw n2(e3), rn('failed to parse "response" body as JSON', fo, t3);
  }
  if (!an(t2)) throw rn('"response" body must be a top level object', mo, { body: t2 });
  return t2;
}
var Uo = Symbol();
var Lo = Symbol();
var Ko = new TextEncoder();
var zo = new TextDecoder();
var Jo = new TextDecoder("utf-8", { fatal: true });
function Do() {
  for (var e3 = arguments.length, t2 = new Array(e3), n2 = 0; n2 < e3; n2++) t2[n2] = arguments[n2];
  const o2 = t2.reduce((e4, t3) => e4 + t3.length, 0), i2 = new Uint8Array(o2);
  let r2 = 0;
  for (const e4 of t2) i2.set(e4, r2), r2 += e4.length;
  return i2;
}
var Ho = /[^\x00-\x7f]/;
function Zo(e3) {
  if ("string" == typeof e3 && e3.length >= 128) {
    if (Ho.test(e3)) throw new TypeError("non-ASCII string encountered in encode()");
    return Ko.encode(e3);
  }
  const t2 = new Uint8Array(e3.length);
  for (let n2 = 0; n2 < e3.length; n2++) {
    const o2 = e3.charCodeAt(n2);
    if (o2 > 127) throw new TypeError("non-ASCII string encountered in encode()");
    t2[n2] = o2;
  }
  return t2;
}
function Fo(e3) {
  let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
  if (Uint8Array.fromBase64) return Uint8Array.fromBase64(e3, { alphabet: t2 ? "base64url" : "base64" });
  if (t2) {
    if (e3.includes("+") || e3.includes("/")) throw new TypeError("Invalid base64url");
    e3 = e3.replace(/-/g, "+").replace(/_/g, "/");
  }
  const n2 = atob(e3), o2 = new Uint8Array(n2.length);
  for (let e4 = 0; e4 < n2.length; e4++) o2[e4] = n2.charCodeAt(e4);
  return o2;
}
var Vo = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "code", "ERR_JOSE_GENERIC"), this.name = this.constructor.name, null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
h(Vo, "code", "ERR_JOSE_GENERIC");
var Xo = class extends Vo {
  constructor(e3, t2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "unspecified", o2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "unspecified";
    super(e3, { cause: { claim: n2, reason: o2, payload: t2 } }), h(this, "code", "ERR_JWT_CLAIM_VALIDATION_FAILED"), h(this, "claim", void 0), h(this, "reason", void 0), h(this, "payload", void 0), this.claim = n2, this.reason = o2, this.payload = t2;
  }
};
h(Xo, "code", "ERR_JWT_CLAIM_VALIDATION_FAILED");
var Go = class extends Vo {
  constructor(e3, t2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "unspecified", o2 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : "unspecified";
    super(e3, { cause: { claim: n2, reason: o2, payload: t2 } }), h(this, "code", "ERR_JWT_EXPIRED"), h(this, "claim", void 0), h(this, "reason", void 0), h(this, "payload", void 0), this.claim = n2, this.reason = o2, this.payload = t2;
  }
};
h(Go, "code", "ERR_JWT_EXPIRED");
var qo = class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JOSE_ALG_NOT_ALLOWED");
  }
};
h(qo, "code", "ERR_JOSE_ALG_NOT_ALLOWED");
var Yo = class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JOSE_NOT_SUPPORTED");
  }
};
h(Yo, "code", "ERR_JOSE_NOT_SUPPORTED");
h(class extends Vo {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "decryption operation failed", arguments.length > 1 ? arguments[1] : void 0), h(this, "code", "ERR_JWE_DECRYPTION_FAILED");
  }
}, "code", "ERR_JWE_DECRYPTION_FAILED");
h(class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JWE_INVALID");
  }
}, "code", "ERR_JWE_INVALID");
var Bo = class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JWS_INVALID");
  }
};
h(Bo, "code", "ERR_JWS_INVALID");
var Qo = class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JWT_INVALID");
  }
};
h(Qo, "code", "ERR_JWT_INVALID");
h(class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JWK_INVALID");
  }
}, "code", "ERR_JWK_INVALID");
var $o = class extends Vo {
  constructor() {
    super(...arguments), h(this, "code", "ERR_JWKS_INVALID");
  }
};
h($o, "code", "ERR_JWKS_INVALID");
var ei = class extends Vo {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "no applicable key found in the JSON Web Key Set", arguments.length > 1 ? arguments[1] : void 0), h(this, "code", "ERR_JWKS_NO_MATCHING_KEY");
  }
};
h(ei, "code", "ERR_JWKS_NO_MATCHING_KEY");
var ti = class extends Vo {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "multiple matching keys found in the JSON Web Key Set", arguments.length > 1 ? arguments[1] : void 0), h(this, Symbol.asyncIterator, w(function* () {
    })), h(this, "code", "ERR_JWKS_MULTIPLE_MATCHING_KEYS");
  }
};
h(ti, "code", "ERR_JWKS_MULTIPLE_MATCHING_KEYS");
var ni = class extends Vo {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "request timed out", arguments.length > 1 ? arguments[1] : void 0), h(this, "code", "ERR_JWKS_TIMEOUT");
  }
};
h(ni, "code", "ERR_JWKS_TIMEOUT");
var oi = class extends Vo {
  constructor() {
    super(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "signature verification failed", arguments.length > 1 ? arguments[1] : void 0), h(this, "code", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
  }
};
h(oi, "code", "ERR_JWS_SIGNATURE_VERIFICATION_FAILED");
function ii(e3) {
  try {
    return Fo("string" == typeof e3 ? e3 : zo.decode(e3), true);
  } catch (e4) {
    throw new TypeError("The input to be decoded is not correctly encoded.", { cause: e4 });
  }
}
function ri(e3) {
  return (function(e4) {
    let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
    if (Uint8Array.prototype.toBase64) return e4.toBase64({ alphabet: t2 ? "base64url" : "base64", omitPadding: t2 });
    const n2 = [];
    for (let t3 = 0; t3 < e4.length; t3 += 32768) n2.push(String.fromCharCode.apply(null, e4.subarray(t3, t3 + 32768)));
    const o2 = btoa(n2.join(""));
    return t2 ? o2.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_") : o2;
  })("string" == typeof e3 ? Ko.encode(e3) : e3, true);
}
function si(e3) {
  if ("object" != typeof e3 || null === e3 || "[object Object]" !== Object.prototype.toString.call(e3)) return false;
  const t2 = Object.getPrototypeOf(e3);
  return null === t2 || null === Object.getPrototypeOf(t2);
}
function ai(e3) {
  return si(e3) && Array.isArray(e3.keys) && Array.from(e3.keys).every(si);
}
function ci() {
  const e3 = /* @__PURE__ */ new Set();
  for (var t2 = arguments.length, n2 = new Array(t2), o2 = 0; o2 < t2; o2++) n2[o2] = arguments[o2];
  for (const t3 of n2) if (t3) for (const n3 of Object.keys(t3)) {
    if (e3.has(n3)) return false;
    e3.add(n3);
  }
  return true;
}
function ui(e3, t2, n2) {
  try {
    return ii(e3);
  } catch (e4) {
    throw new n2("Failed to base64url decode the ".concat(t2), { cause: e4 });
  }
}
var li = { __proto__: null, b64: true };
function di(e3, t2) {
  if (void 0 !== t2 && (!Array.isArray(t2) || t2.some((e4) => "string" != typeof e4))) throw new TypeError('"'.concat(e3, '" option must be an array of strings'));
  return void 0 === t2 ? void 0 : new Set(t2);
}
function hi(e3, t2, n2, o2, i2) {
  if (void 0 !== i2.crit && void 0 === (null == o2 ? void 0 : o2.crit)) throw new e3('"crit" (Critical) Header Parameter MUST be integrity protected');
  if (!o2 || void 0 === o2.crit) return [];
  if (!Array.isArray(o2.crit) || 0 === o2.crit.length || o2.crit.some((e4) => "string" != typeof e4 || 0 === e4.length)) throw new e3('"crit" (Critical) Header Parameter MUST be an array of non-empty strings when present');
  const r2 = void 0 === n2 ? t2 : f(f({ __proto__: null }, n2), t2);
  for (const t3 of o2.crit) {
    if (!(t3 in r2)) throw new Yo('Extension Header Parameter "'.concat(t3, '" is not recognized'));
    if (!Object.hasOwn(i2, t3) || void 0 === i2[t3]) throw new e3('Extension Header Parameter "'.concat(t3, '" is missing'));
    if (r2[t3] && (!Object.hasOwn(o2, t3) || void 0 === o2[t3])) throw new e3('Extension Header Parameter "'.concat(t3, '" MUST be integrity protected'));
  }
  return o2.crit;
}
function pi(e3, t2) {
  if (t2.includes("b64")) {
    const t3 = e3.b64;
    if ("boolean" != typeof t3) throw new Bo('The "b64" (base64url-encode payload) Header Parameter must be a boolean');
    return t3;
  }
  return true;
}
function fi(e3, t2) {
  let n2, o2;
  try {
    n2 = JSON.stringify(t2), o2 = JSON.parse(n2);
  } catch (t3) {
    throw new e3("JOSE Header is not valid JSON", { cause: t3 });
  }
  if (!si(o2)) throw new e3("JOSE Header is not a JSON object");
  return [o2, n2];
}
async function mi(e3, t2, n2) {
  var o2;
  const i2 = e3.alg, r2 = e3.secret, s2 = "decrypt" === n2 || "sign" === n2;
  if (r2 && t2 instanceof Uint8Array) return t2;
  let a2, c2;
  if (si(t2)) {
    if (a2 = (function(e4) {
      const t3 = Ti(e4);
      if (void 0 !== t3.ext && "boolean" != typeof t3.ext) throw new TypeError('"ext" (Extractable) Parameter must be a boolean');
      if (void 0 !== t3.key_ops) {
        const e5 = t3.key_ops, n3 = Array.isArray(e5) ? [...e5] : void 0;
        if (!n3 || n3.some((e6) => "string" != typeof e6) || new Set(n3).size !== n3.length) throw new TypeError('"key_ops" (Key Operations) Parameter must be an array of unique strings');
        t3.key_ops = n3;
      }
      return t3;
    })(t2), "string" != typeof a2.kty) throw bi(i2, t2, r2);
    if (!(r2 ? "oct" === a2.kty && "string" == typeof a2.k : "oct" !== a2.kty && (s2 ? "AKP" === a2.kty && "string" == typeof a2.priv || "string" == typeof a2.d : void 0 === a2.d && void 0 === a2.priv))) throw new TypeError(r2 ? 'JSON Web Key for symmetric algorithms must have JWK "kty" (Key Type) equal to "oct" and the JWK "k" (Key Value) present' : "JSON Web Key for this operation must be a ".concat(s2 ? "private" : "public", " JWK"));
    if (((e4, t3, n3) => {
      const o3 = e4.alg;
      if (void 0 !== t3.use) {
        const e5 = "sign" === n3 || "verify" === n3 ? "sig" : "enc";
        if (t3.use !== e5) throw new TypeError('Invalid key for this operation, its "use" must be "'.concat(e5, '" when present'));
      }
      if (void 0 !== t3.alg && t3.alg !== o3) throw new TypeError('Invalid key for this operation, its "alg" must be "'.concat(o3, '" when present'));
      if (Array.isArray(t3.key_ops)) {
        var i3;
        const o4 = "encrypt" === n3 || "decrypt" === n3 ? null === (i3 = e4.ops) || void 0 === i3 ? void 0 : i3["encrypt" === n3 ? 0 : 1] : n3;
        if (o4 && !t3.key_ops.includes(o4)) throw new TypeError('Invalid key for this operation, its "key_ops" must include "'.concat(o4, '" when present'));
      }
    })(e3, a2, n2), "oct" === a2.kty) return ii(a2.k);
    if (!Object.isFrozen(t2)) {
      const e4 = t2.key_ops;
      Array.isArray(e4) && Object.freeze(e4), Object.freeze(t2);
    }
  } else {
    if (!vi(t2)) throw bi(i2, t2, r2);
    const e4 = r2 ? "secret" : s2 ? "private" : "public";
    if (t2.type !== e4 && (r2 || ["secret", "public", "private"].includes(t2.type))) throw new TypeError("".concat(((e5) => e5[Symbol.toStringTag])(t2), ' instances must be of type "').concat(e4, '" for the ').concat(i2, " algorithm"));
    if (gi(t2)) return t2;
    if (c2 = t2, "secret" === c2.type) return c2.export();
  }
  yi || (yi = /* @__PURE__ */ new WeakMap());
  const u2 = t2;
  let l2 = yi.get(u2);
  if (null !== (o2 = l2) && void 0 !== o2 && o2[i2]) return l2[i2];
  if (l2 || yi.set(u2, l2 = {}), c2 && "function" == typeof c2.toCryptoKey) {
    var d2, h2, p2;
    const t3 = "public" === c2.type, n3 = wi[null === (d2 = c2.asymmetricKeyDetails) || void 0 === d2 ? void 0 : d2.namedCurve], o3 = null !== (h2 = null === (p2 = e3.resolve) || void 0 === p2 ? void 0 : p2.call(e3, { crv: n3, asymmetricKeyType: c2.asymmetricKeyType })) && void 0 !== h2 ? h2 : e3.subtle;
    return l2[i2] = c2.toCryptoKey(o3, t3, e3.usages[t3 ? 0 : 1]);
  }
  return null != a2 || (a2 = c2.export({ format: "jwk" })), a2.alg = i2, l2[i2] = await Pi(e3, a2);
}
var yi;
var wi = { __proto__: null, prime256v1: "P-256", secp384r1: "P-384", secp521r1: "P-521" };
var gi = (e3) => {
  if ("CryptoKey" === (null == e3 ? void 0 : e3[Symbol.toStringTag])) return true;
  try {
    return e3 instanceof CryptoKey;
  } catch (e4) {
    return false;
  }
};
var vi = (e3) => gi(e3) || ((e4) => "KeyObject" === (null == e4 ? void 0 : e4[Symbol.toStringTag]))(e3);
function bi(e3, t2, n2) {
  const o2 = ["CryptoKey", "KeyObject", "JSON Web Key"];
  return n2 && o2.push("Uint8Array"), new TypeError((function(e4, t3) {
    for (var n3, o3 = arguments.length, i2 = new Array(o3 > 2 ? o3 - 2 : 0), r2 = 2; r2 < o3; r2++) i2[r2 - 2] = arguments[r2];
    if (i2.length > 2) {
      const t4 = i2.pop();
      e4 += "one of type ".concat(i2.join(", "), ", or ").concat(t4, ".");
    } else 2 === i2.length ? e4 += "one of type ".concat(i2[0], " or ").concat(i2[1], ".") : e4 += "of type ".concat(i2[0], ".");
    return null == t3 ? e4 += " Received ".concat(t3) : "function" == typeof t3 && t3.name ? e4 += " Received function ".concat(t3.name) : "object" == typeof t3 && null != t3 && (null === (n3 = t3.constructor) || void 0 === n3 ? void 0 : n3.name) && (e4 += " Received an instance of ".concat(t3.constructor.name)), e4;
  })("Key for the ".concat(e3, " algorithm must be "), t2, ...o2));
}
var _i = function(e3) {
  return new TypeError("CryptoKey does not support this operation, its ".concat(arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : "algorithm.name", " must be ").concat(e3));
};
function ki(e3, t2) {
  const n2 = t2.algorithm.modulusLength;
  if ("number" != typeof n2 || n2 < 2048) throw new TypeError("".concat(e3, " requires key modulusLength to be 2048 bits or larger"));
}
function Si(e3, t2, n2) {
  var o2;
  const i2 = e3.algorithm;
  if (i2.name !== t2.name) throw _i(t2.name);
  if (t2.hash && (null === (o2 = i2.hash) || void 0 === o2 ? void 0 : o2.name) !== t2.hash) throw _i(t2.hash, "algorithm.hash");
  if (t2.namedCurve && i2.namedCurve !== t2.namedCurve) throw _i(t2.namedCurve, "algorithm.namedCurve");
  if (void 0 !== t2.length && i2.length !== t2.length) throw _i(t2.length, "algorithm.length");
  !(function(e4, t3) {
    if (t3 && !e4.usages.includes(t3)) throw new TypeError("CryptoKey does not support this operation, its usages must include ".concat(t3, "."));
  })(e3, n2);
}
function Ti(e3) {
  return f({ __proto__: null }, e3);
}
async function Pi(e3, t2, n2) {
  var o2, i2, r2, s2;
  if (!e3.kty.includes(t2.kty)) throw new Yo('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
  const a2 = null !== (o2 = null === (i2 = e3.resolve) || void 0 === i2 ? void 0 : i2.call(e3, { kty: t2.kty, crv: t2.crv })) && void 0 !== o2 ? o2 : e3.subtle, c2 = !(!t2.d && !t2.priv), u2 = f(f({}, t2), {}, { ext: null != n2 ? n2 : t2.ext });
  return "AKP" !== u2.kty && delete u2.alg, delete u2.use, crypto.subtle.importKey("jwk", u2, a2, null !== (r2 = u2.ext) && void 0 !== r2 ? r2 : !c2, null !== (s2 = t2.key_ops) && void 0 !== s2 ? s2 : e3.usages[c2 ? 1 : 0]);
}
async function Ci(e3, t2, n2) {
  let o2 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3];
  return e3 instanceof Uint8Array && (e3 = await crypto.subtle.importKey("raw", e3, t2, o2, [n2])), Si(e3, t2, n2), e3;
}
function Ei(e3) {
  const t2 = { __proto__: null };
  for (const n2 in e3) t2[n2] = f(f({}, e3[n2]), {}, { alg: n2 });
  return t2;
}
var Ri = [["encrypt", "wrapKey"], ["decrypt", "unwrapKey"]];
var Ai = [[], ["deriveBits"]];
var xi = [[], []];
function Ii(e3) {
  return { kty: ["RSA"], mode: "key-encryption", subtle: { name: "RSA-OAEP", hash: "SHA-".concat(e3) }, usages: Ri, ops: ["wrapKey", "unwrapKey"] };
}
function Oi(e3) {
  return { kty: ["EC", "OKP"], mode: e3, subtle: { name: "ECDH" }, resolve: (e4) => {
    let t2 = e4.kty, n2 = e4.crv, o2 = e4.asymmetricKeyType;
    if ("X25519" === n2 || "x25519" === o2) return { name: "X25519" };
    if ("OKP" === t2) throw new Yo('Invalid or unsupported JWK "alg" (Algorithm) Parameter value');
    return { name: "ECDH", namedCurve: n2 };
  }, usages: Ai, ops: [void 0, "deriveBits"] };
}
function ji(e3) {
  let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
  return { kty: ["oct"], mode: "key-wrapping", secret: true, subtle: { name: t2 ? "AES-GCM" : "AES-KW", length: e3 }, usages: xi, ops: t2 ? ["encrypt", "decrypt"] : ["wrapKey", "unwrapKey"] };
}
function Wi() {
  return { kty: ["oct"], mode: "key-wrapping", secret: true, subtle: { name: "PBKDF2" }, usages: xi, ops: ["deriveBits", "deriveBits"] };
}
var Ni = Ei({ dir: { kty: ["oct"], mode: "direct-encryption", secret: true, subtle: { name: "AES-GCM" }, usages: xi, ops: ["encrypt", "decrypt"] }, "RSA-OAEP": Ii(1), "RSA-OAEP-256": Ii(256), "RSA-OAEP-384": Ii(384), "RSA-OAEP-512": Ii(512), "ECDH-ES": Oi("direct-key-agreement"), "ECDH-ES+A128KW": Oi("key-agreement-with-key-wrapping"), "ECDH-ES+A192KW": Oi("key-agreement-with-key-wrapping"), "ECDH-ES+A256KW": Oi("key-agreement-with-key-wrapping"), A128KW: ji(128), A192KW: ji(192), A256KW: ji(256), A128GCMKW: ji(128, true), A192GCMKW: ji(192, true), A256GCMKW: ji(256, true), "PBES2-HS256+A128KW": Wi(), "PBES2-HS384+A192KW": Wi(), "PBES2-HS512+A256KW": Wi() });
var Mi = ["encrypt", "decrypt"];
function Ui(e3) {
  let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
  return { kty: ["oct"], secret: true, subtle: { name: t2 ? "AES-CBC" : "AES-GCM", length: e3 }, usages: xi, ops: Mi, cekBits: e3, ivBits: t2 ? 128 : 96, cbc: t2 };
}
var Li;
var Ki;
var zi;
var Ji;
if (Ei({ A128GCM: Ui(128), A192GCM: Ui(192), A256GCM: Ui(256), "A128CBC-HS256": Ui(256, true), "A192CBC-HS384": Ui(384, true), "A256CBC-HS512": Ui(512, true) }), "undefined" == typeof navigator || null === (Li = navigator.userAgent) || void 0 === Li || null === (Ki = Li.startsWith) || void 0 === Ki || !Ki.call(Li, "Mozilla/5.0 ")) {
  const e3 = "v6.8.4";
  Ji = "".concat("openid-client", "/").concat(e3), zi = { "user-agent": Ji };
}
var Di = (e3) => Hi.get(e3);
var Hi;
var Zi;
function Fi(e3) {
  return void 0 !== e3 ? kn(e3) : (Zi || (Zi = /* @__PURE__ */ new WeakMap()), (e4, t2, n2, o2) => {
    let i2;
    return (i2 = Zi.get(t2)) || (!(function(e5, t3) {
      if ("string" != typeof e5) throw Yi("".concat(t3, " must be a string"), qi);
      if (0 === e5.length) throw Yi("".concat(t3, " must not be empty"), Gi);
    })(t2.client_secret, '"metadata.client_secret"'), i2 = kn(t2.client_secret), Zi.set(t2, i2)), i2(e4, t2, n2, o2);
  });
}
var Vi = Jn;
var Xi = Xt;
var Gi = "ERR_INVALID_ARG_VALUE";
var qi = "ERR_INVALID_ARG_TYPE";
function Yi(e3, t2, n2) {
  const o2 = new TypeError(e3, { cause: n2 });
  return Object.assign(o2, { code: t2 }), o2;
}
function Bi(e3) {
  return (async function(e4) {
    return pn(e4, "codeVerifier"), tn(await crypto.subtle.digest("SHA-256", Qt(e4)));
  })(e3);
}
function Qi() {
  return mn();
}
var $i = class extends Error {
  constructor(e3, t2) {
    var n2;
    super(e3, t2), h(this, "code", void 0), this.name = this.constructor.name, this.code = null == t2 ? void 0 : t2.code, null === (n2 = Error.captureStackTrace) || void 0 === n2 || n2.call(Error, this, this.constructor);
  }
};
function er(e3, t2, n2) {
  return new $i(e3, { cause: t2, code: n2 });
}
function tr(e3) {
  if (e3 instanceof TypeError || e3 instanceof $i || e3 instanceof Rn || e3 instanceof An || e3 instanceof xn) throw e3;
  if (e3 instanceof on) switch (e3.code) {
    case go:
      throw er("only requests to HTTPS are allowed", e3, e3.code);
    case vo:
      throw er("only requests to HTTP or HTTPS are allowed", e3, e3.code);
    case wo:
      throw er("unexpected HTTP response status code", e3.cause, e3.code);
    case yo:
      throw er("unexpected response content-type", e3.cause, e3.code);
    case fo:
      throw er("parsing error occured", e3, e3.code);
    case mo:
      throw er("invalid response encountered", e3, e3.code);
    case _o:
      throw er("unexpected JWT claim value encountered", e3, e3.code);
    case ko:
      throw er("unexpected JSON attribute value encountered", e3, e3.code);
    case bo:
      throw er("JWT timestamp claim value failed validation", e3, e3.code);
    default:
      throw er(e3.message, e3, e3.code);
  }
  if (e3 instanceof nn) throw er("unsupported operation", e3, e3.code);
  if (e3 instanceof DOMException) switch (e3.name) {
    case "OperationError":
      throw er("runtime operation error", e3, lo);
    case "NotSupportedError":
      throw er("runtime unsupported operation", e3, lo);
    case "TimeoutError":
      throw er("operation timed out", e3, "OAUTH_TIMEOUT");
    case "AbortError":
      throw er("operation aborted", e3, "OAUTH_ABORT");
  }
  throw new $i("something went wrong", { cause: e3 });
}
async function nr(e3, t2, n2, o2, i2) {
  const r2 = await (async function(e4, t3) {
    var n3, o3;
    if (!(e4 instanceof URL)) throw Yi('"server" must be an instance of URL', qi);
    const i3 = !e4.href.includes("/.well-known/"), r3 = null !== (n3 = null == t3 ? void 0 : t3.timeout) && void 0 !== n3 ? n3 : 30, s3 = AbortSignal.timeout(1e3 * r3), a3 = await (i3 ? dn(e4, { algorithm: null == t3 ? void 0 : t3.algorithm, [Xt]: null == t3 ? void 0 : t3[Xi], [Zt]: null == t3 || null === (o3 = t3.execute) || void 0 === o3 ? void 0 : o3.includes(lr), signal: s3, headers: new Headers(zi) }) : ((null == t3 ? void 0 : t3[Xi]) || fetch)((Pn(e4, null == t3 || null === (c2 = t3.execute) || void 0 === c2 || !c2.includes(lr)), e4.href), { headers: Object.fromEntries(new Headers(f({ accept: "application/json" }, zi)).entries()), body: void 0, method: "GET", redirect: "manual", signal: s3 })).then((e5) => (async function(e6, t4) {
      const n4 = e6;
      if (!(n4 instanceof URL) && n4 !== Uo) throw Ht('"expectedIssuerIdentifier" must be an instance of URL', Dt);
      if (!zt(t4, Response)) throw Ht('"response" must be an instance of Response', Dt);
      if (200 !== t4.status) throw rn('"response" is not a conform Authorization Server Metadata response (unexpected HTTP status code)', wo, t4);
      Co(t4);
      const o4 = await Mo(t4);
      if (pn(o4.issuer, '"response" body "issuer" property', mo, { body: o4 }), n4 !== Uo && new URL(o4.issuer).href !== n4.href) throw rn('"response" body "issuer" property does not match the expected value', ko, { expected: n4.href, body: o4, attribute: "issuer" });
      return o4;
    })(Uo, e5)).catch(tr);
    var c2;
    i3 && new URL(a3.issuer).href !== e4.href && ((function(e5, t4, n4) {
      return !("https://login.microsoftonline.com" !== e5.origin || null != n4 && n4.algorithm && "oidc" !== n4.algorithm || (t4[or] = true, 0));
    })(e4, a3, t3) || (function(e5, t4) {
      return !(!e5.hostname.endsWith(".b2clogin.com") || null != t4 && t4.algorithm && "oidc" !== t4.algorithm);
    })(e4, t3) || (() => {
      throw new $i("discovered metadata issuer does not match the expected issuer", { code: ko, cause: { expected: e4.href, body: a3, attribute: "issuer" } });
    })());
    return a3;
  })(e3, i2), s2 = new ir(r2, t2, n2, o2);
  let a2 = Di(s2);
  if (null != i2 && i2[Xi] && (a2.fetch = i2[Xi]), null != i2 && i2.timeout && (a2.timeout = i2.timeout), null != i2 && i2.execute) for (const e4 of i2.execute) e4(s2);
  return s2;
}
new TextDecoder();
var or = Symbol();
var ir = class {
  constructor(e3, t2, n2, o2) {
    var i2, r2, s2, a2, c2;
    if ("string" != typeof t2 || !t2.length) throw Yi('"clientId" must be a non-empty string', qi);
    if ("string" == typeof n2 && (n2 = { client_secret: n2 }), void 0 !== (null === (i2 = n2) || void 0 === i2 ? void 0 : i2.client_id) && t2 !== n2.client_id) throw Yi('"clientId" and "metadata.client_id" must be the same', Gi);
    const u2 = f(f({}, structuredClone(n2)), {}, { client_id: t2 });
    let l2;
    u2[Ft] = null !== (r2 = null === (s2 = n2) || void 0 === s2 ? void 0 : s2[Ft]) && void 0 !== r2 ? r2 : 0, u2[Vt] = null !== (a2 = null === (c2 = n2) || void 0 === c2 ? void 0 : c2[Vt]) && void 0 !== a2 ? a2 : 30, l2 = o2 || ("string" == typeof u2.client_secret && u2.client_secret.length ? Fi(u2.client_secret) : (e4, t3, n3, o3) => {
      n3.set("client_id", t3.client_id);
    });
    let d2 = Object.freeze(u2);
    const h2 = structuredClone(e3);
    or in e3 && (h2[Lo] = (t3) => {
      let n3 = t3.claims.tid;
      return e3.issuer.replace("{tenantid}", n3);
    });
    let p2 = Object.freeze(h2);
    Hi || (Hi = /* @__PURE__ */ new WeakMap()), Hi.set(this, { __proto__: null, as: p2, c: d2, auth: l2, tlsOnly: true, jwksCache: {} });
  }
  serverMetadata() {
    const e3 = structuredClone(Di(this).as);
    return (function(e4) {
      Object.defineProperties(e4, /* @__PURE__ */ (function(e5) {
        return { supportsPKCE: { __proto__: null, value() {
          var t2;
          let n2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : "S256";
          return true === (null === (t2 = e5.code_challenge_methods_supported) || void 0 === t2 ? void 0 : t2.includes(n2));
        } } };
      })(e4));
    })(e3), e3;
  }
  clientMetadata() {
    return structuredClone(Di(this).c);
  }
  get timeout() {
    return Di(this).timeout;
  }
  set timeout(e3) {
    Di(this).timeout = e3;
  }
  get [Xi]() {
    return Di(this).fetch;
  }
  set [Xi](e3) {
    Di(this).fetch = e3;
  }
};
function rr(e3) {
  Object.defineProperties(e3, (function(e4) {
    let t2;
    if (void 0 !== e4.expires_in) {
      const n2 = /* @__PURE__ */ new Date();
      n2.setSeconds(n2.getSeconds() + e4.expires_in), t2 = n2.getTime();
    }
    return { expiresIn: { __proto__: null, value() {
      if (t2) {
        const e5 = Date.now();
        return t2 > e5 ? Math.floor((t2 - e5) / 1e3) : 0;
      }
    } }, claims: { __proto__: null, value() {
      try {
        return Gn(this);
      } catch (e5) {
        return;
      }
    } } };
  })(e3));
}
async function sr(e3, t2, n2) {
  var o2;
  let i2 = arguments.length > 3 && void 0 !== arguments[3] && arguments[3];
  const r2 = null === (o2 = e3.headers.get("retry-after")) || void 0 === o2 ? void 0 : o2.trim();
  if (void 0 === r2) return;
  let s2;
  if (/^\d+$/.test(r2)) s2 = parseInt(r2, 10);
  else {
    const e4 = new Date(r2);
    if (Number.isFinite(e4.getTime())) {
      const t3 = /* @__PURE__ */ new Date(), n3 = e4.getTime() - t3.getTime();
      n3 > 0 && (s2 = Math.ceil(n3 / 1e3));
    }
  }
  if (i2 && !Number.isFinite(s2)) throw new on("invalid Retry-After header value", { cause: e3 });
  s2 > t2 && await ar(s2 - t2, n2);
}
function ar(e3, t2) {
  return new Promise((n2, o2) => {
    const i2 = (e4) => {
      try {
        t2.throwIfAborted();
      } catch (e5) {
        return void o2(e5);
      }
      if (e4 <= 0) return void n2();
      const r2 = Math.min(e4, 5);
      setTimeout(() => i2(e4 - r2), 1e3 * r2);
    };
    i2(e3);
  });
}
async function cr(e3, t2) {
  yr(e3);
  const n2 = Di(e3), o2 = n2.as, i2 = n2.c, r2 = n2.auth, s2 = n2.fetch, a2 = n2.tlsOnly, c2 = n2.timeout;
  return (async function(e4, t3, n3, o3, i3) {
    bn(e4), _n(t3);
    const r3 = En(e4, "backchannel_authentication_endpoint", t3.use_mtls_endpoint_aliases, true !== (null == i3 ? void 0 : i3[Zt])), s3 = new URLSearchParams(o3);
    s3.set("client_id", t3.client_id);
    const a3 = cn(null == i3 ? void 0 : i3.headers);
    return a3.set("accept", "application/json"), Zn(e4, t3, n3, r3, s3, a3, i3);
  })(o2, i2, r2, t2, { [Xt]: s2, [Zt]: !a2, headers: new Headers(zi), signal: wr(c2) }).then((e4) => (async function(e5, t3, n3) {
    if (bn(e5), _n(t3), !zt(n3, Response)) throw Ht('"response" must be an instance of Response', Dt);
    await Ln(n3, 200, "Backchannel Authentication Endpoint"), Co(n3);
    const o3 = await Mo(n3);
    pn(o3.auth_req_id, '"response" body "auth_req_id" property', mo, { body: o3 });
    let i3 = "number" != typeof o3.expires_in ? parseFloat(o3.expires_in) : o3.expires_in;
    return hn(i3, true, '"response" body "expires_in" property', mo, { body: o3 }), o3.expires_in = i3, void 0 !== o3.interval && hn(o3.interval, false, '"response" body "interval" property', mo, { body: o3 }), o3;
  })(o2, i2, e4)).catch(tr);
}
async function ur(e3, t2, n2, o2) {
  var i2, r2;
  yr(e3), n2 = new URLSearchParams(n2);
  let s2 = null !== (i2 = t2.interval) && void 0 !== i2 ? i2 : 5;
  const a2 = null !== (r2 = null == o2 ? void 0 : o2.signal) && void 0 !== r2 ? r2 : AbortSignal.timeout(1e3 * t2.expires_in);
  try {
    await ar(s2, a2);
  } catch (e4) {
    tr(e4);
  }
  const c2 = Di(e3), u2 = c2.as, l2 = c2.c, d2 = c2.auth, h2 = c2.fetch, p2 = c2.tlsOnly, m2 = c2.nonRepudiation, y2 = c2.timeout, w2 = c2.decrypt, g2 = (i3, r3) => ur(e3, f(f({}, t2), {}, { interval: i3 }), n2, f(f({}, o2), {}, { signal: a2, flag: r3 })), v2 = (function(e4, t3) {
    const n3 = wr(t3);
    if (!n3) return { signal: e4, cleanup() {
    } };
    const o3 = new AbortController(), i3 = (e5) => {
      const t4 = e5.target;
      o3.abort(t4.reason);
    };
    return e4.aborted ? o3.abort(e4.reason) : n3.aborted ? o3.abort(n3.reason) : (e4.addEventListener("abort", i3, { once: true }), n3.addEventListener("abort", i3, { once: true })), { signal: o3.signal, cleanup() {
      e4.removeEventListener("abort", i3), n3.removeEventListener("abort", i3);
    } };
  })(a2, y2), b2 = await (async function(e4, t3, n3, o3, i3) {
    bn(e4), _n(t3), pn(o3, '"authReqId"');
    const r3 = new URLSearchParams(null == i3 ? void 0 : i3.additionalParameters);
    return r3.set("auth_req_id", o3), Fn(e4, t3, n3, "urn:openid:params:grant-type:ciba", r3, i3);
  })(u2, l2, d2, t2.auth_req_id, { [Xt]: h2, [Zt]: !p2, additionalParameters: n2, DPoP: null == o2 ? void 0 : o2.DPoP, headers: new Headers(zi), signal: v2.signal }).catch(tr).finally(v2.cleanup);
  var _2;
  if (503 === b2.status && b2.headers.has("retry-after")) return await sr(b2, s2, a2, true), await (null === (_2 = b2.body) || void 0 === _2 ? void 0 : _2.cancel()), g2(s2);
  const k2 = (async function(e4, t3, n3, o3) {
    return qn(e4, t3, n3, void 0, null == o3 ? void 0 : o3[qt], null == o3 ? void 0 : o3.recognizedTokenTypes);
  })(u2, l2, b2, { [qt]: w2 });
  let S2;
  try {
    S2 = await k2;
  } catch (e4) {
    if (vr(e4, o2)) return g2(s2, br);
    if (e4 instanceof Rn) switch (e4.error) {
      case "slow_down":
        s2 += 5;
      case "authorization_pending":
        return await sr(e4.response, s2, a2), g2(s2);
    }
    tr(e4);
  }
  return S2.id_token && await (null == m2 ? void 0 : m2(b2)), rr(S2), S2;
}
function lr(e3) {
  Di(e3).tlsOnly = false;
}
async function dr(e3, t2, n2, o2, i2) {
  if (yr(e3), !((null == i2 ? void 0 : i2.flag) === br || t2 instanceof URL || (function(e4, t3) {
    try {
      return Object.getPrototypeOf(e4)[Symbol.toStringTag] === t3;
    } catch (e5) {
      return false;
    }
  })(t2, "Request"))) throw Yi('"currentUrl" must be an instance of URL, or Request', qi);
  let r2, s2;
  const a2 = Di(e3), c2 = a2.as, u2 = a2.c, l2 = a2.auth, d2 = a2.fetch, h2 = a2.tlsOnly, p2 = a2.jarm, m2 = a2.hybrid, w2 = a2.nonRepudiation, g2 = a2.timeout, v2 = a2.decrypt, b2 = a2.implicit;
  if ((null == i2 ? void 0 : i2.flag) === br) r2 = i2.authResponse, s2 = i2.redirectUri;
  else {
    if (!(t2 instanceof URL)) {
      const e4 = t2;
      switch (t2 = new URL(t2.url), e4.method) {
        case "GET":
          break;
        case "POST":
          const n3 = new URLSearchParams(await xo(e4));
          if (m2) t2.hash = n3.toString();
          else for (const e5 of n3.entries()) {
            var _2 = y(e5, 2);
            const n4 = _2[0], o3 = _2[1];
            t2.searchParams.append(n4, o3);
          }
          break;
        default:
          throw Yi("unexpected Request HTTP method", Gi);
      }
    }
    switch (s2 = (function(e4) {
      return (e4 = new URL(e4)).search = "", e4.hash = "", e4.href;
    })(t2), true) {
      case !!p2:
        r2 = await p2(t2, null == n2 ? void 0 : n2.expectedState);
        break;
      case !!m2:
        r2 = await m2(t2, null == n2 ? void 0 : n2.expectedNonce, null == n2 ? void 0 : n2.expectedState, null == n2 ? void 0 : n2.maxAge);
        break;
      case !!b2:
        throw new TypeError("authorizationCodeGrant() cannot be used by response_type=id_token clients");
      default:
        try {
          r2 = No(c2, u2, t2.searchParams, null == n2 ? void 0 : n2.expectedState);
        } catch (e4) {
          tr(e4);
        }
    }
  }
  const k2 = await (async function(e4, t3, n3, o3, i3, r3, s3) {
    if (bn(e4), _n(t3), !to.has(o3)) throw Ht('"callbackParameters" must be an instance of URLSearchParams obtained from "validateAuthResponse()", or "validateJwtAuthResponse()', Jt);
    pn(i3, '"redirectUri"');
    const a3 = Oo(o3, "code");
    if (!a3) throw rn('no authorization code in "callbackParameters"', mo);
    const c3 = new URLSearchParams(null == s3 ? void 0 : s3.additionalParameters);
    return c3.set("redirect_uri", i3), c3.set("code", a3), r3 !== no && (pn(r3, '"codeVerifier"'), c3.set("code_verifier", r3)), Fn(e4, t3, n3, "authorization_code", c3, s3);
  })(c2, u2, l2, r2, s2, (null == n2 ? void 0 : n2.pkceCodeVerifier) || no, { additionalParameters: o2, [Xt]: d2, [Zt]: !h2, DPoP: null == i2 ? void 0 : i2.DPoP, headers: new Headers(zi), signal: wr(g2) }).catch(tr);
  "string" != typeof (null == n2 ? void 0 : n2.expectedNonce) && "number" != typeof (null == n2 ? void 0 : n2.maxAge) || (n2.idTokenExpected = true);
  const S2 = ao(c2, u2, k2, { expectedNonce: null == n2 ? void 0 : n2.expectedNonce, maxAge: null == n2 ? void 0 : n2.maxAge, requireIdToken: null == n2 ? void 0 : n2.idTokenExpected, [qt]: v2 });
  let T2;
  try {
    T2 = await S2;
  } catch (t3) {
    if (vr(t3, i2)) return dr(e3, void 0, n2, o2, f(f({}, i2), {}, { flag: br, authResponse: r2, redirectUri: s2 }));
    tr(t3);
  }
  return T2.id_token && await (null == w2 ? void 0 : w2(k2)), rr(T2), T2;
}
async function hr(e3, t2, n2, o2) {
  yr(e3), n2 = new URLSearchParams(n2);
  const i2 = Di(e3), r2 = i2.as, s2 = i2.c, a2 = i2.auth, c2 = i2.fetch, u2 = i2.tlsOnly, l2 = i2.nonRepudiation, d2 = i2.timeout, h2 = i2.decrypt, p2 = await (async function(e4, t3, n3, o3, i3) {
    bn(e4), _n(t3), pn(o3, '"refreshToken"');
    const r3 = new URLSearchParams(null == i3 ? void 0 : i3.additionalParameters);
    return r3.set("refresh_token", o3), Fn(e4, t3, n3, "refresh_token", r3, i3);
  })(r2, s2, a2, t2, { [Xt]: c2, [Zt]: !u2, additionalParameters: n2, DPoP: null == o2 ? void 0 : o2.DPoP, headers: new Headers(zi), signal: wr(d2) }).catch(tr), m2 = (async function(e4, t3, n3, o3) {
    return qn(e4, t3, n3, void 0, null == o3 ? void 0 : o3[qt], null == o3 ? void 0 : o3.recognizedTokenTypes);
  })(r2, s2, p2, { [qt]: h2 });
  let y2;
  try {
    y2 = await m2;
  } catch (i3) {
    if (vr(i3, o2)) return hr(e3, t2, n2, f(f({}, o2), {}, { flag: br }));
    tr(i3);
  }
  return y2.id_token && await (null == l2 ? void 0 : l2(p2)), rr(y2), y2;
}
async function pr(e3, t2, n2) {
  yr(e3), t2 = new URLSearchParams(t2);
  const o2 = Di(e3), i2 = o2.as, r2 = o2.c, s2 = o2.auth, a2 = o2.fetch, c2 = o2.tlsOnly, u2 = o2.timeout, l2 = await (async function(e4, t3, n3, o3, i3) {
    return bn(e4), _n(t3), Fn(e4, t3, n3, "client_credentials", new URLSearchParams(o3), i3);
  })(i2, r2, s2, t2, { [Xt]: a2, [Zt]: !c2, DPoP: null == n2 ? void 0 : n2.DPoP, headers: new Headers(zi), signal: wr(u2) }).catch(tr), d2 = (async function(e4, t3, n3, o3) {
    return qn(e4, t3, n3, void 0, null == o3 ? void 0 : o3[qt], null == o3 ? void 0 : o3.recognizedTokenTypes);
  })(i2, r2, l2);
  let h2;
  try {
    h2 = await d2;
  } catch (o3) {
    if (vr(o3, n2)) return pr(e3, t2, f(f({}, n2), {}, { flag: br }));
    tr(o3);
  }
  return rr(h2), h2;
}
function fr(e3, t2) {
  yr(e3);
  const n2 = Di(e3), o2 = n2.as, i2 = n2.c, r2 = n2.tlsOnly, s2 = n2.hybrid, a2 = n2.jarm, c2 = n2.implicit, u2 = En(o2, "authorization_endpoint", false, r2);
  if ((t2 = new URLSearchParams(t2)).has("client_id") || t2.set("client_id", i2.client_id), !t2.has("request_uri") && !t2.has("request")) {
    if (t2.has("response_type") || t2.set("response_type", s2 ? "code id_token" : c2 ? "id_token" : "code"), c2 && !t2.has("nonce")) throw Yi("response_type=id_token clients must provide a nonce parameter in their authorization request parameters", Gi);
    a2 && t2.set("response_mode", "jwt");
  }
  for (const e4 of t2.entries()) {
    var l2 = y(e4, 2);
    const t3 = l2[0], n3 = l2[1];
    u2.searchParams.append(t3, n3);
  }
  return u2;
}
async function mr(e3, t2, n2) {
  yr(e3);
  const o2 = fr(e3, t2), i2 = Di(e3), r2 = i2.as, s2 = i2.c, a2 = i2.auth, c2 = i2.fetch, u2 = i2.tlsOnly, l2 = i2.timeout, d2 = await (async function(e4, t3, n3, o3, i3) {
    var r3;
    bn(e4), _n(t3);
    const s3 = En(e4, "pushed_authorization_request_endpoint", t3.use_mtls_endpoint_aliases, true !== (null == i3 ? void 0 : i3[Zt])), a3 = new URLSearchParams(o3);
    a3.set("client_id", t3.client_id);
    const c3 = cn(null == i3 ? void 0 : i3.headers);
    c3.set("accept", "application/json"), void 0 !== (null == i3 ? void 0 : i3.DPoP) && (Kn(i3.DPoP), await i3.DPoP.addProof(s3, c3, "POST"));
    const u3 = await Zn(e4, t3, n3, s3, a3, c3, i3);
    return null == i3 || null === (r3 = i3.DPoP) || void 0 === r3 || r3.cacheNonce(u3, s3), u3;
  })(r2, s2, a2, o2.searchParams, { [Xt]: c2, [Zt]: !u2, DPoP: null == n2 ? void 0 : n2.DPoP, headers: new Headers(zi), signal: wr(l2) }).catch(tr), h2 = (async function(e4, t3, n3) {
    if (bn(e4), _n(t3), !zt(n3, Response)) throw Ht('"response" must be an instance of Response', Dt);
    await Ln(n3, 201, "Pushed Authorization Request Endpoint"), Co(n3);
    const o3 = await Mo(n3);
    pn(o3.request_uri, '"response" body "request_uri" property', mo, { body: o3 });
    let i3 = "number" != typeof o3.expires_in ? parseFloat(o3.expires_in) : o3.expires_in;
    return hn(i3, true, '"response" body "expires_in" property', mo, { body: o3 }), o3.expires_in = i3, o3;
  })(r2, s2, d2);
  let p2;
  try {
    p2 = await h2;
  } catch (o3) {
    if (vr(o3, n2)) return mr(e3, t2, f(f({}, n2), {}, { flag: br }));
    tr(o3);
  }
  return fr(e3, { request_uri: p2.request_uri });
}
function yr(e3) {
  if (!(e3 instanceof ir)) throw Yi('"config" must be an instance of Configuration', qi);
  if (Object.getPrototypeOf(e3) !== ir.prototype) throw Yi("subclassing Configuration is not allowed", Gi);
}
function wr(e3) {
  return e3 ? AbortSignal.timeout(1e3 * e3) : void 0;
}
async function gr(e3, t2, n2, o2) {
  yr(e3);
  const i2 = Di(e3), r2 = i2.as, s2 = i2.c, a2 = i2.fetch, c2 = i2.tlsOnly, u2 = i2.nonRepudiation, l2 = i2.timeout, d2 = i2.decrypt, h2 = await zn(r2, s2, t2, { [Xt]: a2, [Zt]: !c2, DPoP: null == o2 ? void 0 : o2.DPoP, headers: new Headers(zi), signal: wr(l2) }).catch(tr);
  let p2, m2 = Hn(r2, s2, n2, h2, { [qt]: d2 });
  try {
    p2 = await m2;
  } catch (i3) {
    if (vr(i3, o2)) return gr(e3, t2, n2, f(f({}, o2), {}, { flag: br }));
    tr(i3);
  }
  return "application/jwt" === Dn(h2) && await (null == u2 ? void 0 : u2(h2)), p2;
}
function vr(e3, t2) {
  return !(null == t2 || !t2.DPoP || t2.flag === br) && (function(e4) {
    if (e4 instanceof xn) {
      const t3 = e4.cause, n2 = t3[0];
      return 1 === t3.length && "dpop" === n2.scheme && "use_dpop_nonce" === n2.parameters.error;
    }
    return e4 instanceof Rn && "use_dpop_nonce" === e4.error;
  })(e3);
}
Object.freeze(ir.prototype);
var br = Symbol();
async function _r(e3, t2, n2, o2) {
  yr(e3);
  const i2 = Di(e3), r2 = i2.as, s2 = i2.c, a2 = i2.auth, c2 = i2.fetch, u2 = i2.tlsOnly, l2 = i2.timeout, d2 = i2.decrypt, h2 = i2.nonRepudiation, p2 = await (async function(e4, t3, n3, o3, i3, r3) {
    return bn(e4), _n(t3), pn(o3, '"grantType"'), Fn(e4, t3, n3, o3, new URLSearchParams(i3), r3);
  })(r2, s2, a2, t2, new URLSearchParams(n2), { [Xt]: c2, [Zt]: !u2, DPoP: null == o2 ? void 0 : o2.DPoP, headers: new Headers(zi), signal: wr(l2) }).catch(tr);
  let m2;
  "urn:ietf:params:oauth:grant-type:token-exchange" === t2 && (m2 = { n_a: () => {
  } });
  const y2 = (async function(e4, t3, n3, o3) {
    return qn(e4, t3, n3, void 0, null == o3 ? void 0 : o3[qt], null == o3 ? void 0 : o3.recognizedTokenTypes);
  })(r2, s2, p2, { [qt]: d2, recognizedTokenTypes: m2 });
  let w2;
  try {
    w2 = await y2;
  } catch (i3) {
    if (vr(i3, o2)) return _r(e3, t2, n2, f(f({}, o2), {}, { flag: br }));
    tr(i3);
  }
  return w2.id_token && await (null == h2 ? void 0 : h2(p2)), rr(w2), w2;
}
async function kr(e3, t2, n2) {
  yr(e3);
  const o2 = Di(e3), i2 = o2.as, r2 = o2.c, s2 = o2.auth, a2 = o2.fetch, c2 = o2.tlsOnly, u2 = o2.timeout;
  return (async function(e4, t3, n3, o3, i3) {
    bn(e4), _n(t3), pn(o3, '"token"');
    const r3 = En(e4, "revocation_endpoint", t3.use_mtls_endpoint_aliases, true !== (null == i3 ? void 0 : i3[Zt])), s3 = new URLSearchParams(null == i3 ? void 0 : i3.additionalParameters);
    s3.set("token", o3);
    const a3 = cn(null == i3 ? void 0 : i3.headers);
    return a3.delete("accept"), Zn(e4, t3, n3, r3, s3, a3, i3);
  })(i2, r2, s2, t2, { [Xt]: a2, [Zt]: !c2, additionalParameters: new URLSearchParams(n2), headers: new Headers(zi), signal: wr(u2) }).then(Po).catch(tr);
}
var Sr = [["verify"], ["sign"]];
function Tr(e3) {
  const t2 = { name: "HMAC", hash: "SHA-".concat(e3) };
  return { kty: ["oct"], secret: true, subtle: t2, signing: t2, usages: Sr };
}
function Pr(e3, t2) {
  const n2 = { name: t2 ? "RSA-PSS" : "RSASSA-PKCS1-v1_5", hash: "SHA-".concat(e3) };
  return { kty: ["RSA"], subtle: n2, signing: t2 ? f(f({}, n2), {}, { saltLength: t2 }) : n2, usages: Sr, minRsaBits: 2048 };
}
function Cr(e3, t2) {
  return { kty: ["EC"], crv: e3, subtle: { name: "ECDSA", namedCurve: e3 }, signing: { name: "ECDSA", hash: "SHA-".concat(t2) }, usages: Sr };
}
function Er() {
  const e3 = { name: "Ed25519" };
  return { kty: ["OKP"], crv: "Ed25519", subtle: e3, signing: e3, usages: Sr };
}
function Rr(e3) {
  const t2 = { name: "ML-DSA-".concat(e3) };
  return { kty: ["AKP"], subtle: t2, signing: t2, usages: Sr };
}
var Ar = Ei({ HS256: Tr(256), HS384: Tr(384), HS512: Tr(512), RS256: Pr(256), RS384: Pr(384), RS512: Pr(512), PS256: Pr(256, 32), PS384: Pr(384, 48), PS512: Pr(512, 64), ES256: Cr("P-256", 256), ES384: Cr("P-384", 384), ES512: Cr("P-521", 512), EdDSA: Er(), Ed25519: Er(), "ML-DSA-44": Rr(44), "ML-DSA-65": Rr(65), "ML-DSA-87": Rr(87) });
function xr(e3) {
  const t2 = "string" == typeof e3 ? Ar[e3] : void 0;
  if (!t2) throw new Yo("alg ".concat(e3, " is not supported either by JOSE or your javascript runtime"));
  return t2;
}
function Ir(e3) {
  return void 0 === e3 ? {} : (function(e4, t2, n2) {
    let o2;
    try {
      o2 = JSON.parse(Jo.decode(ii(e4)));
    } catch (e5) {
      throw new t2(n2, { cause: e5 });
    }
    if (!si(o2)) throw new t2(n2);
    return o2;
  })(e3, Bo, "JWS Protected Header is invalid");
}
function Or(e3) {
  try {
    return Zo(e3);
  } catch (e4) {
    throw new Bo("JWS Compact Serialization payload must use only ASCII characters", { cause: e4 });
  }
}
async function jr(e3, t2, n2, o2, i2) {
  var r2;
  const s2 = e3.protected, a2 = e3.header, c2 = e3.payload, u2 = null != i2 ? i2 : Ir(s2);
  if (!ci(u2, a2)) throw new Bo("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const l2 = f(f({}, u2), a2), d2 = pi(u2, hi(Bo, li, t2[1], u2, l2)), h2 = l2.alg;
  if ("string" != typeof h2 || !h2) throw new Bo('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  if (t2[0] && !t2[0].has(h2)) throw new qo('"alg" (Algorithm) Header Parameter value not allowed');
  if (d2) {
    if ("string" != typeof c2) throw new Bo("JWS Payload must be a string");
  } else if ("string" != typeof c2 && !(c2 instanceof Uint8Array)) throw new Bo("JWS Payload must be a string or an Uint8Array instance");
  const p2 = d2 || "string" != typeof c2 ? c2 : o2(c2);
  let m2 = false;
  "function" == typeof n2 && (n2 = await n2(u2, e3), m2 = true);
  const y2 = xr(h2), w2 = Do(void 0 !== s2 ? Zo(s2) : new Uint8Array(), Zo("."), "string" == typeof p2 ? null !== (r2 = t2[2]) && void 0 !== r2 ? r2 : t2[2] = (function(e4, t3, n3) {
    try {
      return Zo(e4);
    } catch (e5) {
      throw new n3("The ".concat(t3, " is not a valid base64url string"), { cause: e5 });
    }
  })(p2, "payload", Bo) : p2), g2 = ui(e3.signature, "signature", Bo), v2 = await mi(y2, n2, "verify"), b2 = await Ci(v2, y2.subtle, "verify");
  y2.minRsaBits && ki(y2.alg, b2);
  let _2 = false;
  try {
    _2 = await crypto.subtle.verify(y2.signing, b2, g2, w2);
  } catch (e4) {
    throw new oi(void 0, { cause: e4 });
  }
  if (!_2) throw new oi();
  const k2 = { payload: "string" == typeof p2 ? ui(p2, "payload", Bo) : p2 };
  return void 0 !== s2 && (k2.protectedHeader = u2), void 0 !== a2 && (k2.unprotectedHeader = a2), m2 ? [f(f({}, k2), {}, { key: v2 }), d2] : [k2, d2];
}
var Wr = (e3) => Math.floor(e3.getTime() / 1e3);
var Nr = { s: 1, m: 60, h: 3600, d: 86400, w: 604800, y: 31557600 };
var Mr = /^(\+|\-)? ?(\d+|\d+\.\d+) ?(seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)(?: (ago|from now))?$/i;
var Ur = "check_failed";
function Lr() {
  throw new TypeError("Invalid time period format");
}
function Kr(e3) {
  "string" != typeof e3 && Lr();
  const t2 = Mr.exec(e3);
  (!t2 || t2[4] && t2[1]) && Lr();
  const n2 = parseFloat(t2[2]), o2 = Math.round(n2 * Nr[t2[3][0].toLowerCase()]);
  return Number.isFinite(o2) || Lr(), "-" === t2[1] || "ago" === t2[4] ? -o2 : o2;
}
function zr(e3, t2) {
  if (!Number.isFinite(t2)) throw new TypeError("Invalid ".concat(e3, " input"));
  return t2;
}
function Jr(e3, t2) {
  if ("string" != typeof t2) throw new TypeError('"'.concat(e3, '" claim must be a string'));
}
function Dr(e3, t2) {
  return "number" == typeof e3 ? zr(t2, e3) : e3 instanceof Date ? zr(t2, Wr(e3)) : Wr(/* @__PURE__ */ new Date()) + Kr(e3);
}
var Hr = (e3) => {
  const t2 = e3.toLowerCase();
  return e3.includes("/") ? t2 : "application/".concat(t2);
};
function Zr(e3, t2) {
  let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
  const o2 = e3[t2];
  if (void 0 !== o2 || n2) {
    if ("number" != typeof o2) throw new Xo('"'.concat(t2, '" claim must be a number'), e3, t2, "invalid");
    return o2;
  }
}
function Fr(e3, t2) {
  throw new Xo('unexpected "'.concat(t2, '" claim value'), e3, t2, Ur);
}
function Vr(e3, t2) {
  let n2, o2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {};
  try {
    n2 = JSON.parse(Jo.decode(t2));
  } catch (e4) {
    throw new Qo("JWT Claims Set must be a top-level JSON object", { cause: e4 });
  }
  if (!si(n2)) throw new Qo("JWT Claims Set must be a top-level JSON object");
  const i2 = o2.typ;
  if (void 0 !== i2 && ("string" != typeof e3.typ || Hr(e3.typ) !== Hr(i2))) throw new Xo('unexpected "typ" JWT header value', n2, "typ", Ur);
  const r2 = o2.requiredClaims, s2 = void 0 === r2 ? [] : r2, a2 = o2.issuer, c2 = o2.subject, u2 = o2.audience, l2 = o2.maxTokenAge, d2 = [...s2];
  void 0 !== l2 && d2.push("iat"), void 0 !== u2 && d2.push("aud"), void 0 !== c2 && d2.push("sub"), void 0 !== a2 && d2.push("iss");
  for (const e4 of new Set(d2.reverse())) if (!Object.hasOwn(n2, e4)) throw new Xo('missing required "'.concat(e4, '" claim'), n2, e4, "missing");
  var h2, p2;
  void 0 !== a2 && !(Array.isArray(a2) ? a2 : [a2]).includes(n2.iss) && Fr(n2, "iss"), void 0 !== c2 && n2.sub !== c2 && Fr(n2, "sub"), void 0 !== u2 && (h2 = n2.aud, p2 = "string" == typeof u2 ? [u2] : u2, !("string" == typeof h2 ? p2.includes(h2) : Array.isArray(h2) && p2.some((e4) => h2.includes(e4)))) && Fr(n2, "aud");
  const f2 = o2.clockTolerance;
  let m2 = 0;
  if ("string" == typeof f2) m2 = Kr(f2);
  else if (void 0 !== f2) {
    if ("number" != typeof f2) throw new TypeError("Invalid clockTolerance option type");
    m2 = f2;
  }
  zr("clockTolerance option", m2);
  const y2 = o2.currentDate, w2 = zr("currentDate option", Wr(void 0 === y2 ? /* @__PURE__ */ new Date() : y2)), g2 = Zr(n2, "iat", void 0 !== l2), v2 = Zr(n2, "nbf");
  if (void 0 !== v2 && v2 > w2 + m2) throw new Xo('"nbf" claim timestamp check failed', n2, "nbf", Ur);
  const b2 = Zr(n2, "exp");
  if (void 0 !== b2 && b2 <= w2 - m2) throw new Go('"exp" claim timestamp check failed', n2, "exp", Ur);
  if (void 0 !== l2) {
    const e4 = w2 - g2;
    if (e4 - m2 > zr("maxTokenAge option", "number" == typeof l2 ? l2 : Kr(l2))) throw new Go('"iat" claim timestamp check failed (too far in the past)', n2, "iat", Ur);
    if (e4 < -m2) throw new Xo('"iat" claim timestamp check failed (it should be in the past)', n2, "iat", Ur);
  }
  return n2;
}
var Xr;
function Gr(e3) {
  return Xr.get(e3);
}
async function qr(e3, t2, n2) {
  const o2 = await (async function(e4, t3, n3) {
    if (e4 instanceof Uint8Array && (e4 = zo.decode(e4)), "string" != typeof e4) throw new Bo("Compact JWS must be a string or Uint8Array");
    const o3 = e4.split("."), i3 = o3[0], r3 = o3[1], s3 = o3[2];
    if (3 !== o3.length) throw new Bo("Invalid Compact JWS");
    return jr({ payload: r3, protected: i3, signature: s3 }, t3, n3, Or);
  })(e3, (function(e4) {
    return [e4 && di("algorithms", e4.algorithms), null == e4 ? void 0 : e4.crit];
  })(n2), t2), i2 = y(o2, 2), r2 = i2[0];
  if (!i2[1]) throw new Qo("JWTs MUST NOT use unencoded payload");
  const s2 = Vr(r2.protectedHeader, r2.payload, n2);
  return f(f({}, r2), {}, { payload: s2 });
}
async function Yr(e3, t2, n2) {
  let o2 = y(e3, 4), i2 = o2[0], r2 = o2[1], s2 = o2[2], a2 = o2[3], c2 = "";
  if (void 0 !== r2) {
    const e4 = fi(Bo, r2);
    r2 = e4[0], c2 = ri(e4[1]);
  }
  if (void 0 !== s2 && (s2 = fi(Bo, s2)[0]), !r2 && !s2) throw new Bo("either setProtectedHeader or setUnprotectedHeader must be called before #sign()");
  if (!ci(r2, s2)) throw new Bo("JWS Protected and JWS Unprotected Header Parameter names must be disjoint");
  const u2 = f(f({}, r2), s2);
  !(function(e4, t3) {
    const n3 = (null != t3 ? t3 : {}).crit;
    if (Array.isArray(n3) && new Set(n3).size !== n3.length) throw new e4('"crit" (Critical) Header Parameter MUST NOT contain duplicate values');
  })(Bo, r2);
  const l2 = pi(r2, hi(Bo, li, a2, r2, u2));
  l2 || null == n2 || n2();
  const d2 = u2.alg;
  if ("string" != typeof d2 || !d2) throw new Bo('JWS "alg" (Algorithm) Header Parameter missing or invalid');
  const h2 = xr(d2);
  let p2, m2 = "", w2 = i2;
  if (l2) {
    var g2, v2;
    const t3 = e3[4];
    t3 ? (m2 = null !== (g2 = t3[0]) && void 0 !== g2 ? g2 : t3[0] = ri(i2), w2 = null !== (v2 = t3[1]) && void 0 !== v2 ? v2 : t3[1] = Zo(m2)) : (m2 = ri(i2), p2 = Ko.encode("".concat(c2, ".").concat(m2)));
  }
  null != p2 || (p2 = Do(Zo(c2), Zo("."), w2));
  const b2 = await Ci(await mi(h2, t2, "sign"), h2.subtle, "sign");
  h2.minRsaBits && ki(h2.alg, b2);
  const _2 = { signature: ri(new Uint8Array(await crypto.subtle.sign(h2.signing, b2, p2))), payload: m2 };
  return r2 && (_2.protected = c2), s2 && (_2.header = s2), [_2, l2];
}
var Br = class {
  constructor() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    if (!si(e3)) throw new TypeError("JWT Claims Set MUST be an object");
    (Xr || (Xr = /* @__PURE__ */ new WeakMap())).set(this, structuredClone(e3));
  }
  setIssuer(e3) {
    return Jr("iss", e3), Gr(this).iss = e3, this;
  }
  setSubject(e3) {
    return Jr("sub", e3), Gr(this).sub = e3, this;
  }
  setAudience(e3) {
    return (function(e4) {
      if ("string" != typeof e4 && (!Array.isArray(e4) || Array.from(e4).some((e5) => "string" != typeof e5))) throw new TypeError('"aud" claim must be a string or an array of strings');
    })(e3), Gr(this).aud = e3, this;
  }
  setJti(e3) {
    return Jr("jti", e3), Gr(this).jti = e3, this;
  }
  setNotBefore(e3) {
    return Gr(this).nbf = Dr(e3, "setNotBefore"), this;
  }
  setExpirationTime(e3) {
    return Gr(this).exp = Dr(e3, "setExpirationTime"), this;
  }
  setIssuedAt(e3) {
    const t2 = Gr(this);
    return t2.iat = void 0 === e3 ? Wr(/* @__PURE__ */ new Date()) : "string" == typeof e3 ? zr("setIssuedAt", Wr(/* @__PURE__ */ new Date()) + Kr(e3)) : Dr(e3, "setIssuedAt"), this;
  }
};
var Qr = /* @__PURE__ */ new WeakMap();
var $r = class extends Br {
  constructor() {
    super(...arguments), u(this, Qr, void 0);
  }
  setProtectedHeader(e3) {
    return (function(e4, t2) {
      if (void 0 !== e4) throw new TypeError("".concat(t2, " can only be called once"));
    })(c(Qr, this), "setProtectedHeader"), l(Qr, this, e3), this;
  }
  async sign(e3, t2) {
    return (async function(e4, t3, n2, o2, i2) {
      const r2 = y(await Yr([e4, t3, void 0, n2], o2, i2), 1)[0];
      return "".concat(r2.protected, ".").concat(r2.payload, ".").concat(r2.signature);
    })((function(e4) {
      const t3 = Gr(e4);
      for (const e5 of ["iat", "nbf", "exp"]) {
        const n2 = t3[e5];
        if ("number" == typeof n2 && !Number.isFinite(n2)) throw new TypeError('"'.concat(e5, '" claim must be a finite number'));
      }
      return Ko.encode(JSON.stringify(t3));
    })(this), c(Qr, this), null == t2 ? void 0 : t2.crit, e3, () => {
      throw new Qo("JWTs MUST NOT use unencoded payload");
    });
  }
};
var es = '"alg" (Algorithm)';
function ts() {
  throw new Yo("Invalid or unsupported ".concat(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 'JWK "alg" (Algorithm) Parameter', " value"));
}
var ns = (e3, t2) => {
  if (e3.byteLength !== t2.length) return false;
  for (let n2 = 0; n2 < e3.byteLength; n2++) if (e3[n2] !== t2[n2]) return false;
  return true;
};
var os = (e3) => {
  const t2 = e3.data[e3.pos++];
  if (void 0 === t2) throw new Error("Unexpected end of ASN.1 input");
  return t2;
};
var is = (e3) => {
  const t2 = os(e3);
  if (128 & t2) {
    const n2 = 127 & t2;
    let o2 = 0;
    for (let t3 = 0; t3 < n2; t3++) o2 = o2 << 8 | os(e3);
    return o2;
  }
  return t2;
};
var rs = (e3, t2, n2) => {
  if (os(e3) !== t2) throw new Error(n2);
};
var ss = (e3, t2) => {
  if (t2 < 0 || e3.pos + t2 > e3.data.length) throw new Error("Unexpected end of ASN.1 input");
  const n2 = e3.data.subarray(e3.pos, e3.pos + t2);
  return e3.pos += t2, n2;
};
var as = (e3) => {
  const t2 = ((e4) => {
    rs(e4, 6, "Expected algorithm OID");
    const t3 = is(e4);
    return ss(e4, t3);
  })(e3);
  if (ns(t2, [43, 101, 110])) return "X25519";
  if (!ns(t2, [42, 134, 72, 206, 61, 2, 1])) throw new Error("Unsupported key algorithm");
  rs(e3, 6, "Expected curve OID");
  const n2 = is(e3), o2 = ss(e3, n2);
  if (ns(o2, [42, 134, 72, 206, 61, 3, 1, 7])) return "P-256";
  if (ns(o2, [43, 129, 4, 0, 34])) return "P-384";
  if (ns(o2, [43, 129, 4, 0, 35])) return "P-521";
  throw new Error("Unsupported named curve");
};
var cs = async (e3, t2, n2, o2) => {
  const i2 = (function(e4) {
    if (void 0 !== e4 && "boolean" != typeof e4) throw new TypeError('"extractable" option must be a boolean');
    return e4;
  })(null == o2 ? void 0 : o2.extractable), r2 = (function(e4, t3) {
    var n3, o3;
    return null !== (n3 = "string" == typeof e4 ? null !== (o3 = Ar[e4]) && void 0 !== o3 ? o3 : Ni[e4] : void 0) && void 0 !== n3 ? n3 : ts(t3);
  })(n2, es);
  r2.secret && ts(es);
  const s2 = "spki" === e3;
  let a2;
  if (r2.resolve) try {
    const n3 = { data: t2, pos: 0 };
    (function(e4, t3) {
      if (rs(e4, 48, "Invalid ".concat("spki" === t3 ? "SPKI" : "PKCS#8", " structure")), is(e4), "pkcs8" === t3) {
        rs(e4, 2, "Expected version field");
        const t4 = is(e4);
        e4.pos += t4;
      }
      rs(e4, 48, "Expected algorithm identifier"), is(e4);
    })(n3, e3), a2 = r2.resolve({ crv: as(n3) });
  } catch (e4) {
    throw new Yo("Invalid or unsupported key format", { cause: e4 });
  }
  else a2 = r2.subtle;
  return crypto.subtle.importKey(e3, t2, a2, null != i2 ? i2 : s2, r2.usages[s2 ? 0 : 1]);
};
var us = (e3, t2, n2) => {
  const o2 = ((e4, t3) => Fo(e4.replace(t3, "")))(e3, /(?:-----(?:BEGIN|END) PRIVATE KEY-----|\s)/g);
  return cs("pkcs8", o2, t2, n2);
};
async function ls(e3, t2, n2) {
  const o2 = e3.get(t2) || e3.set(t2, {}).get(t2), i2 = n2.alg;
  if (void 0 === o2[i2]) {
    const e4 = Pi(n2, t2, true).then((e5) => {
      if ("public" !== e5.type) throw new $o("JSON Web Key Set members must be public keys");
      return o2[i2] = e5, e5;
    }).catch((t3) => {
      throw o2[i2] === e4 && delete o2[i2], t3;
    });
    o2[i2] = e4;
  }
  return o2[i2];
}
function ds(e3) {
  let t2;
  try {
    t2 = structuredClone(e3);
  } catch (e4) {
    throw new $o("JSON Web Key Set malformed", { cause: e4 });
  }
  if (!ai(t2)) throw new $o("JSON Web Key Set malformed");
  const n2 = t2.keys.map((e4) => {
    const t3 = Ti(e4);
    return Array.isArray(t3.key_ops) && (t3.key_ops = [...t3.key_ops]), t3;
  }), o2 = /* @__PURE__ */ new WeakMap();
  return Object.defineProperty(async (e4, i2) => {
    const r2 = f(f({}, e4), null == i2 ? void 0 : i2.header), a2 = r2.alg, c2 = r2.kid, u2 = "string" == typeof a2 ? Ar[a2] : void 0;
    if (!u2 || u2.secret) throw new Yo('Unsupported "alg" value for a JSON Web Key Set');
    const l2 = t2.keys.filter((e5, t3) => (function(e6, t4, n3, o3) {
      const i3 = e6.kty, r3 = e6.key_ops, s2 = e6.ext, a3 = e6.kid, c3 = e6.alg, u3 = e6.use, l3 = e6.crv;
      return (void 0 === s2 || "boolean" == typeof s2) && (void 0 === r3 || Array.isArray(r3) && r3.every((e7, t5) => "string" == typeof e7 && r3.indexOf(e7) === t5) && r3.includes("verify")) && t4.kty.includes(i3) && (void 0 === o3 || "string" == typeof o3 && o3 === a3) && (void 0 === c3 ? "AKP" !== i3 : n3 === c3) && (void 0 === u3 || "sig" === u3) && (!t4.crv || l3 === t4.crv);
    })(n2[t3], u2, a2, c2)), d2 = l2[0], h2 = l2.length;
    if (!h2) throw new ei();
    if (1 !== h2) {
      const e5 = new ti();
      throw e5[Symbol.asyncIterator] = w(function* () {
        for (const e6 of l2) try {
          yield yield s(ls(o2, e6, u2));
        } catch (e7) {
        }
      }), e5;
    }
    return ls(o2, d2, u2);
  }, "jwks", { value: () => structuredClone(t2) });
}
var hs;
var ps;
var fs;
(typeof navigator > "u" || null === (hs = navigator.userAgent) || void 0 === hs || null === (ps = hs.startsWith) || void 0 === ps || !ps.call(hs, "Mozilla/5.0 ")) && (fs = "jose/v6.2.13");
var ms = Symbol();
var ys = Symbol();
function ws(e3, t2) {
  return Number.isFinite(e3) && Date.now() < e3 + t2;
}
function gs(e3, t2, n2) {
  if (Number.isNaN(e3)) throw new TypeError('"'.concat(n2, '" option must not be NaN'));
  return "number" == typeof e3 ? e3 : t2;
}
function vs(e3, t2) {
  if (!(e3 instanceof URL)) throw new TypeError("url must be an instance of URL");
  const n2 = new URL(e3.href).href, o2 = null != t2 ? t2 : {}, i2 = o2.timeoutDuration;
  if ("number" == typeof i2 && (!Number.isInteger(i2) || i2 < 0)) throw new TypeError('"timeoutDuration" option must be a non-negative integer');
  const r2 = "number" == typeof i2 ? i2 : 5e3, s2 = gs(o2.cooldownDuration, 3e4, "cooldownDuration"), a2 = gs(o2.cacheMaxAge, 6e5, "cacheMaxAge"), c2 = new Headers(o2.headers);
  fs && !c2.has("User-Agent") && c2.set("User-Agent", fs), c2.has("accept") || c2.set("accept", "application/json, application/jwk-set+json");
  const u2 = o2[ms], l2 = o2[ys];
  let d2, h2, p2, f2 = 0, m2 = 0;
  if (l2 && "object" == typeof l2) {
    const e4 = l2.uat, t3 = l2.jwks;
    ws(e4, a2) && ai(t3) && (d2 = e4, p2 = ds(t3));
  }
  const y2 = async () => {
    if (h2 && (typeof WebSocketPair < "u" || typeof navigator < "u" && "Cloudflare-Workers" === navigator.userAgent || typeof EdgeRuntime < "u" && "vercel" === EdgeRuntime) && (h2 = void 0), !h2) {
      const e4 = ++f2, t3 = h2 = (async function(e5, t4, n3) {
        let o3 = arguments.length > 3 && void 0 !== arguments[3] ? arguments[3] : fetch;
        const i3 = await o3(e5, { method: "GET", signal: n3, redirect: "manual", headers: t4 }).catch((e6) => {
          throw "TimeoutError" === e6.name ? new ni(void 0, { cause: e6 }) : e6;
        });
        if (200 !== i3.status) throw new Vo("Expected 200 OK from the JSON Web Key Set HTTP response");
        try {
          return await i3.json();
        } catch (e6) {
          throw new Vo("Failed to parse the JSON Web Key Set HTTP response as JSON", { cause: e6 });
        }
      })(n2, c2, AbortSignal.timeout(r2), u2).then((t4) => {
        const n3 = ds(t4);
        if (e4 <= m2) return;
        p2 = n3;
        const o3 = Date.now();
        l2 && (l2.uat = o3, l2.jwks = t4), d2 = o3, m2 = e4;
      }).finally(() => {
        h2 === t3 && (h2 = void 0);
      });
    }
    await h2;
  };
  return Object.defineProperties(async (e4, t3) => {
    (!p2 || !ws(d2, a2)) && await y2();
    try {
      return await p2(e4, t3);
    } catch (n3) {
      if (n3 instanceof ei && !ws(d2, s2)) return await y2(), p2(e4, t3);
      throw n3;
    }
  }, { coolingDown: { get: () => ws(d2, s2), enumerable: true }, fresh: { get: () => ws(d2, a2), enumerable: true }, reload: { value: y2, enumerable: true }, reloading: { get: () => !!h2, enumerable: true }, jwks: { value: () => {
    var e4;
    return null === (e4 = p2) || void 0 === e4 ? void 0 : e4.jwks();
  }, enumerable: true } });
}
async function bs(e3, t2, n2) {
  if ("string" != typeof e3 || 0 !== e3.indexOf("-----BEGIN PRIVATE KEY-----")) throw new TypeError('"pkcs8" must be PKCS#8 formatted string');
  return us(e3, t2, n2);
}
var _s = ["mfaToken"];
var ks = ["mfaToken"];
var Ss;
var Ts;
var Ps;
var Cs;
var Es;
var Rs;
var As;
var xs;
var Is;
var Os;
var js;
var Ws;
var Ns;
var Ms;
var Us;
var Ls;
var Ks;
var zs;
var Js;
var Ds;
var Hs;
var Zs;
var Fs;
var Vs;
var Xs;
var Gs;
var qs;
var Ys;
var Bs;
var Qs;
var $s;
var ea;
var ta;
var na;
var oa;
var ia;
var ra;
var sa;
var aa;
var ca;
var ua;
var la;
var da;
var ha;
var pa;
var fa;
var ma;
var ya;
var wa;
var ga;
var va;
var ba;
function _a(e3) {
  if ("object" != typeof e3 || null === e3) return {};
  const t2 = e3;
  return { statusCode: "number" == typeof t2.statusCode ? t2.statusCode : void 0, headers: t2.headers instanceof Headers ? t2.headers : void 0, body: "string" == typeof t2.body ? t2.body : void 0 };
}
function ka(e3) {
  var t2, n2;
  if ("object" != typeof e3 || null === e3) return { error: "unknown_error", error_description: String(e3) };
  const o2 = e3;
  let i2;
  if (o2.response instanceof Response) try {
    i2 = new Headers(o2.response.headers), i2.delete("set-cookie");
  } catch (e4) {
    i2 = void 0;
  }
  const r2 = { error: null !== (t2 = o2.error) && void 0 !== t2 ? t2 : "", error_description: null !== (n2 = o2.error_description) && void 0 !== n2 ? n2 : "", message: o2.message, statusCode: "number" == typeof o2.status ? o2.status : void 0, headers: i2 };
  if ("mfa_required" === o2.error && o2.cause) {
    r2.mfa_token = "string" == typeof o2.cause.mfa_token ? o2.cause.mfa_token : void 0;
    const e4 = o2.cause.mfa_requirements;
    "object" == typeof e4 && null !== e4 && (r2.mfa_requirements = e4);
  }
  return r2;
}
var Sa = class extends Error {
  constructor(e3, t2) {
    super(t2), h(this, "code", void 0), this.name = "NotSupportedError", this.code = e3;
  }
};
var Ta = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "statusCode", void 0), h(this, "headers", void 0), h(this, "body", void 0), this.code = e3, this.cause = n2 && { error: n2.error, error_description: n2.error_description, message: n2.message, mfa_token: n2.mfa_token, mfa_requirements: n2.mfa_requirements };
    const o2 = _a(n2);
    this.statusCode = o2.statusCode, this.headers = o2.headers, this.body = o2.body;
  }
};
var Pa = class extends Ta {
  constructor(e3, t2) {
    super("token_by_code_error", e3, t2), this.name = "TokenByCodeError";
  }
};
var Ca = class extends Ta {
  constructor(e3, t2) {
    super("token_by_client_credentials_error", e3, t2), this.name = "TokenByClientCredentialsError";
  }
};
var Ea = class extends Ta {
  constructor(e3, t2) {
    super("token_by_refresh_token_error", e3, t2), this.name = "TokenByRefreshTokenError";
  }
};
var Ra = class extends Ta {
  constructor(e3, t2) {
    super("token_by_password_error", e3, t2), this.name = "TokenByPasswordError";
  }
};
var Aa = class extends Ta {
  constructor(e3, t2) {
    super("token_for_connection_error", e3, t2), this.name = "TokenForConnectionErrorCode";
  }
};
var xa = class extends Ta {
  constructor(e3, t2) {
    super("token_exchange_error", e3, t2), this.name = "TokenExchangeError";
  }
};
var Ia = class extends Ta {
  constructor(e3, t2) {
    super("token_revocation_error", e3, t2), this.name = "TokenRevocationError";
  }
};
var Oa = class extends Ta {
  constructor(e3, t2) {
    super("user_info_error", e3, t2), this.name = "UserInfoError";
  }
};
var ja = class extends Error {
  constructor(e3) {
    super(e3), h(this, "code", "verify_logout_token_error"), this.name = "VerifyLogoutTokenError";
  }
};
var Wa = class extends Ta {
  constructor(e3) {
    super("backchannel_authentication_error", "There was an error when trying to use Client-Initiated Backchannel Authentication.", e3), h(this, "code", "backchannel_authentication_error"), this.name = "BackchannelAuthenticationError";
  }
};
var Na = class extends Ta {
  constructor(e3) {
    super("build_authorization_url_error", "There was an error when trying to build the authorization URL.", e3), this.name = "BuildAuthorizationUrlError";
  }
};
var Ma = class extends Ta {
  constructor(e3) {
    super("build_link_user_url_error", "There was an error when trying to build the Link User URL.", e3), this.name = "BuildLinkUserUrlError";
  }
};
var Ua = class extends Ta {
  constructor(e3) {
    super("build_unlink_user_url_error", "There was an error when trying to build the Unlink User URL.", e3), this.name = "BuildUnlinkUserUrlError";
  }
};
var La = class extends Error {
  constructor() {
    super("The client secret or client assertion signing key must be provided."), h(this, "code", "missing_client_auth_error"), this.name = "MissingClientAuthError";
  }
};
var Ka = class extends Error {
  constructor(e3) {
    super(e3), h(this, "code", "organization_validation_error"), this.name = "OrganizationValidationError";
  }
};
var za = class extends Error {
  constructor(e3) {
    super(e3 || "fullResponse: true requested but no HTTP Response was captured. This is a bug in CapturingFetch."), h(this, "code", "missing_captured_response_error"), this.name = "MissingCapturedResponseError";
  }
};
var Ja = class extends Error {
  constructor(e3) {
    super(e3 || "The scope option must be a non-empty string of space-separated scopes. Omit it to request the default grant."), h(this, "code", "invalid_scope_error"), this.name = "InvalidScopeError";
  }
};
function Da(e3) {
  try {
    const t2 = new Headers(e3);
    return t2.delete("set-cookie"), t2;
  } catch (e4) {
    return new Headers();
  }
}
function Ha(e3, t2, n2) {
  var o2;
  const i2 = "object" == typeof t2 && null !== t2 ? t2 : void 0, r2 = null !== (o2 = null == i2 ? void 0 : i2.response) && void 0 !== o2 ? o2 : n2, s2 = "number" == typeof (null == i2 ? void 0 : i2.status) ? i2.status : null == r2 ? void 0 : r2.status;
  "number" == typeof s2 && (e3.statusCode = s2), null != r2 && r2.headers && (e3.headers = Da(r2.headers));
}
function Za(e3) {
  return Object.entries(e3).filter((e4) => void 0 !== y(e4, 2)[1]).reduce((e4, t2) => f(f({}, e4), {}, { [t2[0]]: t2[1] }), {});
}
function Fa(e3) {
  if (!e3.trim()) throw new Ka("organization must not be blank");
}
function Va(e3, t2) {
  if (!e3) return;
  const n2 = t2.trim();
  if (n2.startsWith("org_")) {
    const t3 = e3.org_id;
    if ("string" != typeof t3) throw new Ka("Organization Id (org_id) claim must be a string present in the ID token");
    if (t3 !== n2) throw new Ka('Organization Id (org_id) claim value mismatch in the ID token; expected "'.concat(n2, '", found "').concat(t3, '"'));
  } else {
    const t3 = e3.org_name;
    if ("string" != typeof t3) throw new Ka("Organization Name (org_name) claim must be a string present in the ID token");
    if (t3.toLowerCase() !== n2.toLowerCase()) throw new Ka('Organization Name (org_name) claim value mismatch in the ID token; expected "'.concat(n2, '", found "').concat(t3, '"'));
  }
}
var Xa = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "statusCode", void 0), h(this, "headers", void 0), h(this, "body", void 0), this.code = e3, this.cause = n2 && { error: n2.error, error_description: n2.error_description, message: n2.message };
    const o2 = _a(n2);
    this.statusCode = o2.statusCode, this.headers = o2.headers, this.body = o2.body;
  }
};
var Ga = class extends Xa {
  constructor(e3, t2) {
    super("mfa_list_authenticators_error", e3, t2), this.name = "MfaListAuthenticatorsError";
  }
};
var qa = class extends Xa {
  constructor(e3, t2) {
    super("mfa_enrollment_error", e3, t2), this.name = "MfaEnrollmentError";
  }
};
var Ya = class extends Xa {
  constructor(e3, t2) {
    super("mfa_delete_authenticator_error", e3, t2), this.name = "MfaDeleteAuthenticatorError";
  }
};
var Ba = class extends Xa {
  constructor(e3, t2) {
    super("mfa_challenge_error", e3, t2), this.name = "MfaChallengeError";
  }
};
var Qa = class extends Xa {
  constructor(e3, t2) {
    super("mfa_verify_error", e3, t2), this.name = "MfaVerifyError";
  }
};
function $a(e3) {
  return { id: e3.id, authenticatorType: e3.authenticator_type, active: e3.active, name: e3.name, oobChannels: e3.oob_channels, type: e3.type };
}
var ec = class e2 {
  constructor(e3, t2, n2, o2, i2, r2, s2) {
    h(this, "accessToken", void 0), h(this, "idToken", void 0), h(this, "refreshToken", void 0), h(this, "expiresAt", void 0), h(this, "scope", void 0), h(this, "claims", void 0), h(this, "authorizationDetails", void 0), h(this, "tokenType", void 0), h(this, "issuedTokenType", void 0), h(this, "recoveryCode", void 0), h(this, "act", void 0), this.accessToken = e3, this.idToken = n2, this.refreshToken = o2, this.expiresAt = t2, this.scope = i2, this.claims = r2, this.authorizationDetails = s2;
  }
  static fromTokenEndpointResponse(t2) {
    const n2 = t2.id_token ? t2.claims() : void 0, o2 = new e2(t2.access_token, Math.floor(Date.now() / 1e3) + Number(t2.expires_in), t2.id_token, t2.refresh_token, t2.scope, n2, t2.authorization_details);
    return o2.tokenType = t2.token_type, o2.issuedTokenType = t2.issued_token_type, o2;
  }
};
function tc(e3, t2) {
  if (false === t2.enabled) return e3;
  const n2 = { name: t2.name, version: t2.version }, o2 = btoa(JSON.stringify(n2));
  return async (t3, n3) => {
    const i2 = t3 instanceof Request ? new Headers(t3.headers) : new Headers();
    if (null != n3 && n3.headers) {
      new Headers(n3.headers).forEach((e4, t4) => {
        i2.set(t4, e4);
      });
    }
    return i2.set("Auth0-Client", o2), e3(t3, f(f({}, n3), {}, { headers: i2 }));
  };
}
function nc(e3) {
  var t2, n2;
  return false === (null == e3 ? void 0 : e3.enabled) ? e3 : { enabled: true, name: null !== (t2 = null == e3 ? void 0 : e3.name) && void 0 !== t2 ? t2 : "@auth0/auth0-auth-js", version: null !== (n2 = null == e3 ? void 0 : e3.version) && void 0 !== n2 ? n2 : "1.18.0" };
}
function oc(e3) {
  let t2;
  const n2 = async (n3, o2) => {
    const i2 = await e3(n3, o2);
    return t2 = i2.clone(), i2;
  };
  return n2.getCapturedResponse = () => t2, n2;
}
function ic(e3, t2, n2) {
  if (!t2) return e3;
  const o2 = t2.signal, i2 = t2.headers, r2 = t2.customFetch, s2 = r2 ? tc(r2, n2) : e3;
  return o2 || i2 ? async (e4, t3) => {
    const n3 = i2 ? new Headers(e4 instanceof Request ? e4.headers : void 0) : void 0;
    if (n3 && null != t3 && t3.headers && new Headers(t3.headers).forEach((e5, t4) => n3.set(t4, e5)), i2) for (const e5 of Object.entries(i2)) {
      var r3 = y(e5, 2);
      const t4 = r3[0], o3 = r3[1], i3 = t4.toLowerCase();
      "authorization" !== i3 && "auth0-client" !== i3 && n3.set(t4, o3);
    }
    const a2 = (function(e5, t4) {
      if (!e5) return { signal: null != t4 ? t4 : void 0 };
      if (!t4) return { signal: e5 };
      if ("undefined" != typeof AbortSignal && "function" == typeof AbortSignal.any) return { signal: AbortSignal.any([e5, t4]) };
      const n4 = new AbortController(), o3 = [e5, t4], i3 = o3.find((e6) => e6.aborted);
      if (i3) return n4.abort(i3.reason), { signal: n4.signal };
      const r4 = [], s3 = () => {
        o3.forEach((e6, t5) => {
          const n5 = r4[t5];
          n5 && e6.removeEventListener("abort", n5);
        });
      };
      return o3.forEach((e6, t5) => {
        const o4 = () => {
          s3(), n4.abort(e6.reason);
        };
        r4[t5] = o4, e6.addEventListener("abort", o4, { once: true });
      }), { signal: n4.signal, cleanup: s3 };
    })(o2, null == t3 ? void 0 : t3.signal);
    try {
      return await s2(e4, f(f(f({}, t3), n3 && { headers: n3 }), {}, { signal: a2.signal }));
    } finally {
      var c2;
      null === (c2 = a2.cleanup) || void 0 === c2 || c2.call(a2);
    }
  } : s2;
}
var rc = { otp: "http://auth0.com/oauth/grant-type/mfa-otp", oob: "http://auth0.com/oauth/grant-type/mfa-oob", "recovery-code": "http://auth0.com/oauth/grant-type/mfa-recovery-code" };
var sc = (Ss = /* @__PURE__ */ new WeakMap(), Ts = /* @__PURE__ */ new WeakMap(), Ps = /* @__PURE__ */ new WeakMap(), Cs = /* @__PURE__ */ new WeakMap(), Es = /* @__PURE__ */ new WeakMap(), Rs = /* @__PURE__ */ new WeakMap(), As = /* @__PURE__ */ new WeakMap(), xs = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2, n2;
    d(this, xs), u(this, Ss, void 0), u(this, Ts, void 0), u(this, Ps, void 0), u(this, Cs, void 0), u(this, Es, void 0), u(this, Rs, void 0), u(this, As, void 0), l(Ss, this, "https://".concat(e3.domain)), l(Ts, this, e3.clientId), l(Ps, this, e3.clientSecret), l(Cs, this, null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    }), l(Es, this, null !== (n2 = e3.telemetryConfig) && void 0 !== n2 ? n2 : nc()), l(Rs, this, e3.getConfiguration), l(As, this, e3.createCaptureConfiguration);
  }
  async listAuthenticators(e3, t2) {
    const n2 = "".concat(c(Ss, this), "/mfa/authenticators"), o2 = e3.mfaToken, i2 = await r(xs, this, ac).call(this, t2)(n2, { method: "GET", headers: { Authorization: "Bearer ".concat(o2), "Content-Type": "application/json" } });
    if (!i2.ok) {
      const e4 = await i2.clone().text(), t3 = i2.status, n3 = Da(i2.headers);
      let o3;
      try {
        o3 = JSON.parse(e4);
      } catch (o4) {
        throw new Ga("Failed to list authenticators", { error: "unknown_error", error_description: "Failed to list authenticators", statusCode: t3, headers: n3, body: e4 });
      }
      throw new Ga(o3.error_description || "Failed to list authenticators", f(f({}, o3), {}, { statusCode: t3, headers: n3, body: e4 }));
    }
    return (await i2.json()).map($a);
  }
  async enrollAuthenticator(e3, t2) {
    const n2 = "".concat(c(Ss, this), "/mfa/associate"), o2 = e3.mfaToken, i2 = m(e3, _s), s2 = { authenticator_types: i2.authenticatorTypes };
    "oobChannels" in i2 && (s2.oob_channels = i2.oobChannels), "phoneNumber" in i2 && i2.phoneNumber && (s2.phone_number = i2.phoneNumber), "email" in i2 && i2.email && (s2.email = i2.email);
    const a2 = await r(xs, this, ac).call(this, t2)(n2, { method: "POST", headers: { Authorization: "Bearer ".concat(o2), "Content-Type": "application/json" }, body: JSON.stringify(s2) });
    if (!a2.ok) {
      const e4 = await a2.clone().text(), t3 = a2.status, n3 = Da(a2.headers);
      let o3;
      try {
        o3 = JSON.parse(e4);
      } catch (o4) {
        throw new qa("Failed to enroll authenticator", { error: "unknown_error", error_description: "Failed to enroll authenticator", statusCode: t3, headers: n3, body: e4 });
      }
      throw new qa(o3.error_description || "Failed to enroll authenticator", f(f({}, o3), {}, { statusCode: t3, headers: n3, body: e4 }));
    }
    return (function(e4) {
      if ("otp" === e4.authenticator_type) return { authenticatorType: "otp", secret: e4.secret, barcodeUri: e4.barcode_uri, recoveryCodes: e4.recovery_codes, id: e4.id };
      if ("oob" === e4.authenticator_type) return { authenticatorType: "oob", oobChannel: e4.oob_channel, oobCode: e4.oob_code, bindingMethod: e4.binding_method, id: e4.id, barcodeUri: e4.barcode_uri, recoveryCodes: e4.recovery_codes };
      throw new Error("Unexpected authenticator type: ".concat(e4.authenticator_type));
    })(await a2.json());
  }
  async deleteAuthenticator(e3, t2) {
    const n2 = e3.authenticatorId, o2 = e3.mfaToken, i2 = "".concat(c(Ss, this), "/mfa/authenticators/").concat(encodeURIComponent(n2)), s2 = await r(xs, this, ac).call(this, t2)(i2, { method: "DELETE", headers: { Authorization: "Bearer ".concat(o2), "Content-Type": "application/json" } });
    if (!s2.ok) {
      const e4 = await s2.clone().text(), t3 = s2.status, n3 = Da(s2.headers);
      let o3;
      try {
        o3 = JSON.parse(e4);
      } catch (o4) {
        throw new Ya("Failed to delete authenticator", { error: "unknown_error", error_description: "Failed to delete authenticator", statusCode: t3, headers: n3, body: e4 });
      }
      throw new Ya(o3.error_description || "Failed to delete authenticator", f(f({}, o3), {}, { statusCode: t3, headers: n3, body: e4 }));
    }
  }
  async challengeAuthenticator(e3, t2) {
    const n2 = "".concat(c(Ss, this), "/mfa/challenge"), o2 = e3.mfaToken, i2 = m(e3, ks), s2 = { mfa_token: o2, client_id: c(Ts, this), challenge_type: i2.challengeType };
    c(Ps, this) && (s2.client_secret = c(Ps, this)), i2.authenticatorId && (s2.authenticator_id = i2.authenticatorId);
    const a2 = await r(xs, this, ac).call(this, t2)(n2, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(s2) });
    if (!a2.ok) {
      const e4 = await a2.clone().text(), t3 = a2.status, n3 = Da(a2.headers);
      let o3;
      try {
        o3 = JSON.parse(e4);
      } catch (o4) {
        throw new Ba("Failed to challenge authenticator", { error: "unknown_error", error_description: "Failed to challenge authenticator", statusCode: t3, headers: n3, body: e4 });
      }
      throw new Ba(o3.error_description || "Failed to challenge authenticator", f(f({}, o3), {}, { statusCode: t3, headers: n3, body: e4 }));
    }
    return (function(e4) {
      const t3 = { challengeType: e4.challenge_type };
      return void 0 !== e4.oob_code && (t3.oobCode = e4.oob_code), void 0 !== e4.binding_method && (t3.bindingMethod = e4.binding_method), t3;
    })(await a2.json());
  }
  async verify(e3, t2) {
    if (!c(Rs, this)) throw new Error("MFA verify requires a configuration provider (getConfiguration was not set)");
    const n2 = { mfa_token: e3.mfaToken };
    if (e3.audience && (n2.audience = e3.audience), "otp" === e3.factorType ? n2.otp = e3.otp : "oob" === e3.factorType ? (n2.oob_code = e3.oobCode, e3.bindingCode && (n2.binding_code = e3.bindingCode)) : "recovery-code" === e3.factorType && (n2.recovery_code = e3.recoveryCode), e3.fullResponse) {
      var o2;
      if (!c(As, this)) throw new Error("MFA verify fullResponse requires a capture-config factory (createCaptureConfiguration was not set)");
      const a3 = oc(null !== (o2 = (await c(Rs, this).call(this, t2))[Xi]) && void 0 !== o2 ? o2 : fetch), u3 = await c(As, this).call(this, a3);
      try {
        const t3 = await _r(u3, rc[e3.factorType], n2), o3 = ec.fromTokenEndpointResponse(t3);
        t3.recovery_code && (o3.recoveryCode = t3.recovery_code);
        const i3 = a3.getCapturedResponse();
        if (!i3) throw new za();
        return { data: o3, response: i3 };
      } catch (e4) {
        var i2, r2, s2;
        if (e4 instanceof za) throw e4;
        if (e4 instanceof Qa) throw e4;
        const t3 = e4, n3 = new Qa(t3.error_description || t3.message || "Failed to verify MFA challenge", { error: null !== (i2 = t3.error) && void 0 !== i2 ? i2 : "mfa_verify_error", error_description: null !== (r2 = null !== (s2 = t3.error_description) && void 0 !== s2 ? s2 : t3.message) && void 0 !== r2 ? r2 : "Failed to verify MFA challenge" });
        throw Ha(n3, e4, a3.getCapturedResponse()), n3;
      }
    }
    const a2 = await c(Rs, this).call(this, t2);
    try {
      const t3 = await _r(a2, rc[e3.factorType], n2), o3 = ec.fromTokenEndpointResponse(t3);
      return t3.recovery_code && (o3.recoveryCode = t3.recovery_code), o3;
    } catch (e4) {
      var u2, l2, d2;
      if (e4 instanceof Qa) throw e4;
      const t3 = e4, n3 = new Qa(t3.error_description || t3.message || "Failed to verify MFA challenge", { error: null !== (u2 = t3.error) && void 0 !== u2 ? u2 : "mfa_verify_error", error_description: null !== (l2 = null !== (d2 = t3.error_description) && void 0 !== d2 ? d2 : t3.message) && void 0 !== l2 ? l2 : "Failed to verify MFA challenge" });
      throw Ha(n3, e4), n3;
    }
  }
});
function ac(e3) {
  return ic(c(Cs, this), e3, c(Es, this));
}
var cc = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "statusCode", void 0), h(this, "headers", void 0), h(this, "body", void 0), this.code = e3, this.cause = n2 && { error: n2.error, error_description: n2.error_description, message: n2.message };
    const o2 = _a(n2);
    this.statusCode = o2.statusCode, this.headers = o2.headers, this.body = o2.body;
  }
};
var uc = class extends cc {
  constructor(e3, t2) {
    super("passkey_register_error", e3, t2), this.name = "PasskeyRegisterError";
  }
};
var lc = class extends cc {
  constructor(e3, t2) {
    super("passkey_challenge_error", e3, t2), this.name = "PasskeyChallengeError";
  }
};
var dc = class extends cc {
  constructor(e3, t2) {
    super("passkey_get_token_error", e3, t2), h(this, "isRetryable", void 0), h(this, "verificationRequired", void 0), h(this, "authSession", void 0), this.name = "PasskeyGetTokenError", this.cause = t2 && { error: t2.error, error_description: t2.error_description, message: t2.message, mfa_token: t2.mfa_token, mfa_requirements: t2.mfa_requirements, verification_required: t2.verification_required, auth_session: t2.auth_session }, this.isRetryable = "invalid_grant" === (null == t2 ? void 0 : t2.error) && null != (null == t2 ? void 0 : t2.auth_session), this.verificationRequired = null == t2 ? void 0 : t2.verification_required, this.authSession = null == t2 ? void 0 : t2.auth_session;
  }
};
function hc(e3) {
  return e3.useMtls ? {} : e3.clientSecret ? { client_secret: e3.clientSecret } : {};
}
var pc = "urn:okta:params:oauth:grant-type:webauthn";
var fc = (Is = /* @__PURE__ */ new WeakMap(), Os = /* @__PURE__ */ new WeakMap(), js = /* @__PURE__ */ new WeakMap(), Ws = /* @__PURE__ */ new WeakMap(), Ns = /* @__PURE__ */ new WeakMap(), Ms = /* @__PURE__ */ new WeakMap(), Us = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2, n2;
    d(this, Us), u(this, Is, void 0), u(this, Os, void 0), u(this, js, void 0), u(this, Ws, void 0), u(this, Ns, void 0), u(this, Ms, void 0), l(Is, this, "https://".concat(e3.domain)), l(Os, this, e3.clientId), l(js, this, { clientSecret: e3.clientSecret, useMtls: e3.useMtls }), l(Ws, this, null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    }), l(Ns, this, null !== (n2 = e3.telemetryConfig) && void 0 !== n2 ? n2 : nc()), l(Ms, this, e3.grantRequest);
  }
  async register(e3, t2) {
    const n2 = "".concat(c(Is, this), "/passkey/register"), o2 = f(f(f(f(f(f(f(f({}, e3.email && { email: e3.email }), e3.name && { name: e3.name }), e3.phoneNumber && { phone_number: e3.phoneNumber }), e3.username && { username: e3.username }), e3.givenName && { given_name: e3.givenName }), e3.familyName && { family_name: e3.familyName }), e3.nickname && { nickname: e3.nickname }), e3.picture && { picture: e3.picture }), i2 = f(f({ client_id: c(Os, this) }, hc(c(js, this))), {}, { user_profile: o2 });
    e3.realm && (i2.realm = e3.realm), e3.organization && (i2.organization = e3.organization), e3.userMetadata && (i2.user_metadata = e3.userMetadata), e3.deliveryMethod && (i2.delivery_method = e3.deliveryMethod);
    const s2 = await r(Us, this, mc).call(this, t2)(n2, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(i2) });
    if (!s2.ok) {
      const e4 = await r(Us, this, yc).call(this, s2), t3 = new uc(e4.error_description || "Failed to request signup challenge", e4);
      throw t3.statusCode = s2.status, t3.headers = Da(s2.headers), t3;
    }
    const a2 = await s2.json();
    return f({ authSession: (u2 = a2).auth_session, authnParamsPublicKey: f({}, u2.authn_params_public_key) }, u2.verification_required && { verificationRequired: u2.verification_required });
    var u2;
  }
  async challenge(e3, t2) {
    const n2 = "".concat(c(Is, this), "/passkey/challenge"), o2 = f({ client_id: c(Os, this) }, hc(c(js, this)));
    null != e3 && e3.realm && (o2.realm = e3.realm), null != e3 && e3.organization && (o2.organization = e3.organization);
    const i2 = await r(Us, this, mc).call(this, t2)(n2, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(o2) });
    if (!i2.ok) {
      const e4 = await r(Us, this, yc).call(this, i2), t3 = new lc(e4.error_description || "Failed to request login challenge", e4);
      throw t3.statusCode = i2.status, t3.headers = Da(i2.headers), t3;
    }
    const s2 = await i2.json();
    return { authSession: (a2 = s2).auth_session, authnParamsPublicKey: f({}, a2.authn_params_public_key) };
    var a2;
  }
  async getTokenByPasskey(e3, t2) {
    void 0 !== e3.organization && Fa(e3.organization);
    const n2 = new URLSearchParams({ auth_session: e3.authSession, authn_response: JSON.stringify(e3.credential) });
    if (e3.realm && n2.append("realm", e3.realm), e3.scope && n2.append("scope", e3.scope), e3.audience && n2.append("audience", e3.audience), e3.organization && n2.append("organization", e3.organization), e3.verification) {
      const t3 = Object.fromEntries(Object.entries(e3.verification).filter((e4) => y(e4, 2)[1]));
      Object.keys(t3).length > 0 && n2.append("verification", JSON.stringify(t3));
    }
    let o2;
    try {
      o2 = await c(Ms, this).call(this, pc, n2, t2, e3.fullResponse);
    } catch (e4) {
      if (e4 instanceof za) throw e4;
      const t3 = null == e4 ? void 0 : e4.cause, n3 = ka(e4), o3 = new dc(n3.error_description || "Failed to exchange passkey credential for tokens.", f(f({}, n3), {}, { verification_required: null == t3 ? void 0 : t3.verification_required, auth_session: null == t3 ? void 0 : t3.auth_session }));
      throw Ha(o3, e4), o3;
    }
    if (e3.fullResponse) {
      const t3 = o2;
      return e3.organization && Va(t3.data.claims, e3.organization), t3;
    }
    const i2 = o2;
    return e3.organization && Va(i2.claims, e3.organization), i2;
  }
});
function mc(e3) {
  return ic(c(Ws, this), e3, c(Ns, this));
}
async function yc(e3) {
  const t2 = await e3.clone().text();
  try {
    return f(f({}, JSON.parse(t2)), {}, { statusCode: e3.status, headers: e3.headers, body: t2 });
  } catch (n2) {
    return { error: "unknown_error", error_description: 429 === e3.status ? "Too many requests. Please try again later." : "HTTP ".concat(e3.status, " ").concat(e3.statusText), statusCode: e3.status, headers: e3.headers, body: t2 };
  }
}
var wc = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "statusCode", void 0), h(this, "headers", void 0), h(this, "body", void 0), Object.setPrototypeOf(this, new.target.prototype), this.code = e3, this.cause = n2 && (n2.error || n2.error_description) ? { error: n2.error, error_description: n2.error_description, message: n2.message, mfa_token: n2.mfa_token, mfa_requirements: n2.mfa_requirements } : void 0;
    const o2 = _a(n2);
    this.statusCode = o2.statusCode, this.headers = o2.headers, this.body = o2.body;
  }
};
var gc = class extends wc {
  constructor(e3, t2) {
    super("passwordless_start_error", e3, t2), this.name = "PasswordlessStartError";
  }
};
var vc = class extends wc {
  constructor(e3, t2) {
    super("passwordless_verify_error", e3, t2), this.name = "PasswordlessVerifyError";
  }
};
var bc = class extends wc {
  constructor(e3, t2) {
    super("passwordless_db_get_token_error", e3, t2), this.name = "PasswordlessDbGetTokenError";
  }
};
var _c = class extends wc {
  constructor(e3, t2, n2, o2, i2) {
    super("passwordless_challenge_error", e3, n2), h(this, "statusCode", void 0), h(this, "validationErrors", void 0), this.name = "PasswordlessChallengeError", this.statusCode = t2, this.validationErrors = o2, this.headers = null != i2 ? i2 : this.headers;
  }
};
function kc(e3) {
  return /^\+[1-9]\d{1,14}$/.test(e3);
}
async function Sc(e3, t2, n2) {
  if (e3.useMtls) return {};
  if (e3.clientAssertionSigningKey) {
    var o2;
    const i2 = null !== (o2 = e3.clientAssertionSigningAlg) && void 0 !== o2 ? o2 : "RS256", r2 = e3.clientAssertionSigningKey instanceof CryptoKey ? e3.clientAssertionSigningKey : await bs(e3.clientAssertionSigningKey, i2);
    return { client_assertion: await new $r({}).setProtectedHeader({ alg: i2 }).setIssuer(t2).setSubject(t2).setAudience("https://".concat(n2, "/")).setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime("".concat(120, "s")).sign(r2), client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" };
  }
  if (e3.clientSecret) return { client_secret: e3.clientSecret };
  throw new La();
}
var Tc = (Ls = /* @__PURE__ */ new WeakMap(), Ks = /* @__PURE__ */ new WeakMap(), zs = /* @__PURE__ */ new WeakMap(), Js = /* @__PURE__ */ new WeakMap(), Ds = /* @__PURE__ */ new WeakMap(), Hs = /* @__PURE__ */ new WeakMap(), Zs = /* @__PURE__ */ new WeakMap(), Fs = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2, n2;
    d(this, Fs), u(this, Ls, void 0), u(this, Ks, void 0), u(this, zs, void 0), u(this, Js, void 0), u(this, Ds, void 0), u(this, Hs, void 0), u(this, Zs, void 0), l(Ks, this, e3.domain), l(Ls, this, "https://".concat(e3.domain)), l(zs, this, e3.clientId), l(Js, this, null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    }), l(Ds, this, null !== (n2 = e3.telemetryConfig) && void 0 !== n2 ? n2 : nc()), l(Hs, this, { clientSecret: e3.clientSecret, clientAssertionSigningKey: e3.clientAssertionSigningKey, clientAssertionSigningAlg: e3.clientAssertionSigningAlg, useMtls: e3.useMtls }), l(Zs, this, e3.grantRequest);
  }
  async sendEmail(e3, t2) {
    const n2 = await r(Fs, this, Cc).call(this, (function(e4) {
      var t3;
      const n3 = null !== (t3 = e4.send) && void 0 !== t3 ? t3 : "code", o2 = { email: e4.email, connection: "email", send: n3 };
      return "link" === n3 && e4.authParams && (o2.authParams = e4.authParams), o2;
    })(e3), "Failed to send passwordless email", e3.language, t2);
    if (e3.fullResponse) return { data: void 0, response: n2 };
  }
  async sendSms(e3, t2) {
    if (!kc(e3.phoneNumber)) throw new gc("Phone number must be in E.164 format (e.g. +14155550100).");
    const n2 = await r(Fs, this, Cc).call(this, (function(e4) {
      return { phone_number: e4.phoneNumber, connection: "sms" };
    })(e3), "Failed to send passwordless SMS", e3.language, t2);
    if (e3.fullResponse) return { data: void 0, response: n2 };
  }
  async challengeWithEmail(e3, t2) {
    const n2 = (function(e4) {
      var t3;
      return { email: e4.email, connection: e4.connection, allow_signup: null !== (t3 = e4.allowSignup) && void 0 !== t3 && t3 };
    })(e3);
    return r(Fs, this, Ec).call(this, n2, "Failed to request email OTP challenge", t2);
  }
  async challengeWithPhoneNumber(e3, t2) {
    if (!kc(e3.phoneNumber)) throw new _c("Phone number must be in E.164 format (e.g. +14155550100).", 0, void 0, void 0);
    const n2 = (function(e4) {
      var t3;
      const n3 = { phone_number: e4.phoneNumber, connection: e4.connection, allow_signup: null !== (t3 = e4.allowSignup) && void 0 !== t3 && t3 };
      return e4.deliveryMethod && (n3.delivery_method = e4.deliveryMethod), n3;
    })(e3);
    return r(Fs, this, Ec).call(this, n2, "Failed to request phone OTP challenge", t2);
  }
  async getTokenByPasswordlessDbConnection(e3, t2) {
    const n2 = new URLSearchParams({ auth_session: e3.authSession, otp: e3.otp });
    if (e3.scope && n2.append("scope", e3.scope), e3.audience && n2.append("audience", e3.audience), !c(Zs, this)) throw new bc("Missing grant request delegate.", ka(new Error("missing grantRequest")));
    try {
      return await c(Zs, this).call(this, "http://auth0.com/oauth/grant-type/passwordless/otp", n2, t2, e3.fullResponse);
    } catch (e4) {
      if (e4 instanceof za) throw e4;
      const t3 = new bc("There was an error while trying to request a token.", ka(e4)), n3 = e4;
      throw t3.statusCode = n3._statusCode, t3.headers = n3._headers, t3;
    }
  }
});
function Pc(e3) {
  return ic(c(Js, this), e3, c(Ds, this));
}
async function Cc(e3, t2, n2, o2) {
  var i2;
  const s2 = await Sc(c(Hs, this), c(zs, this), c(Ks, this)), a2 = f(f({ client_id: c(zs, this) }, e3), s2);
  let u2;
  try {
    u2 = await r(Fs, this, Pc).call(this, o2)("".concat(c(Ls, this), "/passwordless/start"), { method: "POST", headers: f({ "Content-Type": "application/json" }, n2 ? { "x-request-language": n2 } : {}), body: JSON.stringify(a2) });
  } catch (e4) {
    throw new gc("".concat(t2, ": a network error occurred."));
  }
  if (u2.ok) return u2;
  const l2 = await u2.clone().text();
  let d2;
  if (204 !== u2.status) try {
    d2 = JSON.parse(l2);
  } catch (e4) {
    d2 = void 0;
  }
  const h2 = new gc((null === (i2 = d2) || void 0 === i2 ? void 0 : i2.error_description) || t2, d2);
  throw h2.statusCode = u2.status, h2.headers = Da(u2.headers), h2.body = l2, h2;
}
async function Ec(e3, t2, n2) {
  var o2, i2;
  const s2 = await Sc(c(Hs, this), c(zs, this), c(Ks, this)), a2 = f(f({ client_id: c(zs, this) }, e3), s2);
  let u2;
  try {
    u2 = await r(Fs, this, Pc).call(this, n2)("".concat(c(Ls, this), "/otp/challenge"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a2) });
  } catch (e4) {
    throw new _c("challenge error: a network error occurred.", 0, void 0, void 0);
  }
  if (u2.ok) {
    let e4;
    try {
      e4 = await u2.json();
    } catch (e5) {
      throw new _c("".concat(t2, ": could not parse the response body."), u2.status, void 0, void 0, Da(u2.headers));
    }
    return { authSession: e4.auth_session };
  }
  const l2 = await u2.clone().text();
  let d2;
  try {
    d2 = JSON.parse(l2);
  } catch (e4) {
    d2 = void 0;
  }
  const h2 = d2 ? f(f({}, d2), {}, { statusCode: u2.status, headers: u2.headers, body: l2 }) : { error: "", error_description: "", statusCode: u2.status, headers: u2.headers, body: l2 };
  throw new _c((null === (o2 = d2) || void 0 === o2 ? void 0 : o2.error_description) || t2, u2.status, h2, null === (i2 = d2) || void 0 === i2 ? void 0 : i2.validation_errors, Da(u2.headers));
}
var Rc = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "cause", void 0), h(this, "code", void 0), h(this, "statusCode", void 0), h(this, "headers", void 0), h(this, "body", void 0), Object.setPrototypeOf(this, new.target.prototype), this.code = e3, this.cause = n2 && { error: n2.error, error_description: n2.error_description, message: n2.message };
    const o2 = _a(n2);
    this.statusCode = o2.statusCode, this.headers = o2.headers, this.body = o2.body;
  }
};
var Ac = class extends Rc {
  constructor(e3, t2) {
    super("signup_error", e3, t2), this.name = "SignUpError";
  }
};
var xc = class extends Rc {
  constructor(e3, t2) {
    super("change_password_error", e3, t2), this.name = "ChangePasswordError";
  }
};
function Ic(e3, t2, n2) {
  for (const o2 of t2) if (null === e3[o2] || void 0 === e3[o2] || "" === e3[o2]) throw new n2('Required parameter "'.concat(String(o2), '" was null, undefined, or empty.'));
}
function Oc(e3) {
  var t2, n2;
  return { id: null !== (t2 = null !== (n2 = e3._id) && void 0 !== n2 ? n2 : e3.user_id) && void 0 !== t2 ? t2 : e3.id, email: "string" == typeof e3.email ? e3.email : "", emailVerified: Boolean(e3.email_verified), username: e3.username, givenName: e3.given_name, familyName: e3.family_name, name: e3.name, nickname: e3.nickname, picture: e3.picture, userMetadata: e3.user_metadata };
}
var jc = (Vs = /* @__PURE__ */ new WeakMap(), Xs = /* @__PURE__ */ new WeakMap(), Gs = /* @__PURE__ */ new WeakMap(), qs = /* @__PURE__ */ new WeakMap(), Ys = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2, n2;
    d(this, Ys), u(this, Vs, void 0), u(this, Xs, void 0), u(this, Gs, void 0), u(this, qs, void 0), l(Vs, this, "https://".concat(e3.domain)), l(Xs, this, e3.clientId), l(Gs, this, null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    }), l(qs, this, null !== (n2 = e3.telemetryConfig) && void 0 !== n2 ? n2 : nc());
  }
  async signUp(e3, t2) {
    var n2;
    Ic(e3, ["email", "password", "connection"], Ac);
    const o2 = f({ client_id: null !== (n2 = e3.clientId) && void 0 !== n2 ? n2 : c(Xs, this) }, (function(e4) {
      const t3 = { email: e4.email, password: e4.password, connection: e4.connection };
      return void 0 !== e4.username && (t3.username = e4.username), void 0 !== e4.givenName && (t3.given_name = e4.givenName), void 0 !== e4.familyName && (t3.family_name = e4.familyName), void 0 !== e4.name && (t3.name = e4.name), void 0 !== e4.nickname && (t3.nickname = e4.nickname), void 0 !== e4.picture && (t3.picture = e4.picture), void 0 !== e4.userMetadata && (t3.user_metadata = e4.userMetadata), t3;
    })(e3)), i2 = await r(Ys, this, Wc).call(this, "/dbconnections/signup", o2, Ac, "Failed to sign up", t2);
    if (e3.fullResponse) {
      const e4 = i2.clone();
      return { data: Oc(await i2.json()), response: e4 };
    }
    return Oc(await i2.json());
  }
  async changePassword(e3, t2) {
    var n2;
    if (Ic(e3, ["connection"], xc), !e3.email && !e3.username) throw new xc('Either "email" or "username" is required.');
    const o2 = f({ client_id: null !== (n2 = e3.clientId) && void 0 !== n2 ? n2 : c(Xs, this) }, (function(e4) {
      const t3 = { connection: e4.connection };
      return void 0 !== e4.email && (t3.email = e4.email), void 0 !== e4.username && (t3.username = e4.username), void 0 !== e4.organization && (t3.organization = e4.organization), t3;
    })(e3)), i2 = await r(Ys, this, Wc).call(this, "/dbconnections/change_password", o2, xc, "Failed to request a password change", t2);
    if (e3.fullResponse) {
      const e4 = i2.clone();
      return { data: await i2.text(), response: e4 };
    }
    return i2.text();
  }
});
async function Wc(e3, t2, n2, o2, i2) {
  const r2 = ic(c(Gs, this), i2, c(qs, this));
  let s2;
  try {
    s2 = await r2("".concat(c(Vs, this)).concat(e3), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t2) });
  } catch (e4) {
    throw new n2("".concat(o2, ": a network error occurred."));
  }
  if (s2.ok) return s2;
  const a2 = await s2.clone().text(), u2 = await (async function(e4) {
    let t3;
    try {
      t3 = await e4.json();
    } catch (e5) {
      return;
    }
    return "string" == typeof t3.error ? t3 : "string" == typeof t3.code ? { error: t3.code, error_description: "string" == typeof t3.description ? t3.description : "" } : void 0;
  })(s2.clone()), l2 = new n2((null == u2 ? void 0 : u2.error_description) || o2, null != u2 ? u2 : { error: "unknown_error", error_description: o2 });
  throw l2.statusCode = s2.status, l2.headers = Da(s2.headers), l2.body = a2, l2;
}
var Nc = class extends Error {
  constructor(e3, t2, n2) {
    super(t2), h(this, "code", void 0), h(this, "cause", void 0), this.name = "AnonymousSessionError", this.code = e3, this.cause = n2 && { error: n2.error, error_description: n2.error_description, message: n2.message };
  }
};
async function Mc(e3, t2, n2) {
  if (e3.useMtls) return {};
  if (e3.clientAssertionSigningKey) {
    var o2;
    const i2 = null !== (o2 = e3.clientAssertionSigningAlg) && void 0 !== o2 ? o2 : "RS256", r2 = e3.clientAssertionSigningKey instanceof CryptoKey ? e3.clientAssertionSigningKey : await bs(e3.clientAssertionSigningKey, i2);
    return { client_assertion: await new $r({}).setProtectedHeader({ alg: i2 }).setIssuer(t2).setSubject(t2).setAudience("https://".concat(n2, "/")).setJti(crypto.randomUUID()).setIssuedAt().setExpirationTime("".concat(120, "s")).sign(r2), client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer" };
  }
  return e3.clientSecret ? { client_secret: e3.clientSecret } : {};
}
async function Uc(e3) {
  const t2 = "Request failed with status ".concat(e3.status);
  let n2 = {};
  try {
    n2 = await e3.json();
  } catch (e4) {
  }
  return { error: "string" == typeof n2.error ? n2.error : "server_error", error_description: "string" == typeof n2.error_description ? n2.error_description : t2 };
}
var Lc = (Bs = /* @__PURE__ */ new WeakMap(), Qs = /* @__PURE__ */ new WeakMap(), $s = /* @__PURE__ */ new WeakMap(), ea = /* @__PURE__ */ new WeakMap(), ta = /* @__PURE__ */ new WeakMap(), na = /* @__PURE__ */ new WeakMap(), oa = /* @__PURE__ */ new WeakMap(), ia = /* @__PURE__ */ new WeakMap(), ra = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2;
    d(this, ra), u(this, Bs, void 0), u(this, Qs, void 0), u(this, $s, void 0), u(this, ea, void 0), u(this, ta, void 0), u(this, na, void 0), u(this, oa, void 0), u(this, ia, void 0), l(Bs, this, e3.domain), l(Qs, this, "https://".concat(e3.domain)), l($s, this, e3.clientId), l(ea, this, e3.clientSecret), l(ta, this, e3.clientAssertionSigningKey), l(na, this, e3.clientAssertionSigningAlg), l(oa, this, e3.useMtls), l(ia, this, null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    });
  }
  async createSession(e3) {
    const t2 = { client_id: c($s, this) };
    null != e3 && e3.audience && (t2.audience = e3.audience), null != e3 && e3.scope && (t2.scope = e3.scope), null != e3 && e3.metadata && (t2.metadata = e3.metadata);
    const n2 = await r(ra, this, zc).call(this, t2);
    if (!n2.sessionToken) throw new Nc("server_error", "session_token missing from create session response");
    return { sessionToken: n2.sessionToken, accessToken: n2.accessToken, expiresAt: n2.expiresAt, sessionTokenExpiresAt: n2.sessionTokenExpiresAt, scope: n2.scope };
  }
  async getAccessToken(e3) {
    return null != e3 && e3.sessionToken ? r(ra, this, Kc).call(this, e3.sessionToken, e3) : this.createSession({ audience: null == e3 ? void 0 : e3.audience, scope: null == e3 ? void 0 : e3.scope });
  }
  async logout() {
    const e3 = "".concat(c(Qs, this), "/anonymous/logout"), t2 = { client_id: c($s, this) }, n2 = await c(ia, this).call(this, e3, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", redirect: "error", body: JSON.stringify(t2) });
    if (!n2.ok) {
      const e4 = await Uc(n2);
      throw new Nc(e4.error, e4.error_description || "Failed to end anonymous session", e4);
    }
  }
  async mintTransferToken(e3) {
    const t2 = "".concat(c(Qs, this), "/anonymous/token"), n2 = { client_id: c($s, this), session_token: e3, audience: "urn:auth0:anon_transfer" };
    try {
      const e4 = await Mc({ clientSecret: c(ea, this), clientAssertionSigningKey: c(ta, this), clientAssertionSigningAlg: c(na, this), useMtls: c(oa, this) }, c($s, this), c(Bs, this));
      Object.assign(n2, e4);
      const o2 = await c(ia, this).call(this, t2, { method: "POST", headers: { "Content-Type": "application/json" }, redirect: "error", body: JSON.stringify(n2) });
      if (!o2.ok) return null;
      const i2 = await o2.json();
      return "string" == typeof i2.anon_transfer_token ? i2.anon_transfer_token : null;
    } catch (e4) {
      return null;
    }
  }
});
async function Kc(e3, t2) {
  const n2 = { client_id: c($s, this), session_token: e3 };
  null != t2 && t2.audience && (n2.audience = t2.audience), null != t2 && t2.scope && (n2.scope = t2.scope);
  const o2 = await r(ra, this, zc).call(this, n2);
  return { sessionToken: e3, accessToken: o2.accessToken, expiresAt: o2.expiresAt, sessionTokenExpiresAt: o2.sessionTokenExpiresAt, scope: o2.scope };
}
async function zc(e3) {
  const t2 = "".concat(c(Qs, this), "/anonymous/token"), n2 = await Mc({ clientSecret: c(ea, this), clientAssertionSigningKey: c(ta, this), clientAssertionSigningAlg: c(na, this), useMtls: c(oa, this) }, c($s, this), c(Bs, this));
  Object.assign(e3, n2);
  const o2 = await c(ia, this).call(this, t2, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", redirect: "error", body: JSON.stringify(e3) });
  if (!o2.ok) {
    const e4 = await Uc(o2);
    throw new Nc(e4.error, e4.error_description || "Anonymous token request failed", e4);
  }
  let i2;
  try {
    i2 = await o2.json();
  } catch (e4) {
    throw new Nc("server_error", "Invalid response from anonymous token endpoint");
  }
  return (function(e4) {
    const t3 = Math.floor(Date.now() / 1e3);
    if ("string" != typeof e4.access_token || !e4.access_token) throw new Nc("server_error", "access_token missing or invalid in anonymous token response");
    const n3 = e4.expires_in;
    if ("number" != typeof n3 || !Number.isFinite(n3)) throw new Nc("server_error", "expires_in missing or invalid in anonymous token response");
    return { accessToken: e4.access_token, expiresAt: t3 + n3, scope: e4.scope, sessionToken: e4.session_token, sessionTokenExpiresAt: "number" == typeof e4.session_expires_in && Number.isFinite(e4.session_expires_in) ? t3 + e4.session_expires_in : void 0 };
  })(i2);
}
var Jc = (sa = /* @__PURE__ */ new WeakMap(), aa = /* @__PURE__ */ new WeakMap(), ca = /* @__PURE__ */ new WeakMap(), class {
  constructor(e3, t2) {
    u(this, sa, /* @__PURE__ */ new Map()), u(this, aa, void 0), u(this, ca, void 0), l(ca, this, Math.max(1, Math.floor(e3))), l(aa, this, Math.max(0, Math.floor(t2)));
  }
  get(e3) {
    const t2 = c(sa, this).get(e3);
    if (t2) {
      if (!(Date.now() >= t2.expiresAt)) return c(sa, this).delete(e3), c(sa, this).set(e3, t2), t2.value;
      c(sa, this).delete(e3);
    }
  }
  set(e3, t2, n2) {
    c(sa, this).has(e3) && c(sa, this).delete(e3);
    const o2 = null != n2 && Number.isFinite(n2) && n2 > 0 ? n2 : c(aa, this);
    for (c(sa, this).set(e3, { value: t2, expiresAt: Date.now() + o2 }); c(sa, this).size > c(ca, this); ) {
      const e4 = c(sa, this).keys().next().value;
      if (void 0 === e4) break;
      c(sa, this).delete(e4);
    }
  }
});
var Dc = /* @__PURE__ */ new Map();
function Hc(e3) {
  return { ttlMs: 1e3 * ("number" == typeof (null == e3 ? void 0 : e3.ttl) ? e3.ttl : 600), maxEntries: "number" == typeof (null == e3 ? void 0 : e3.maxEntries) && e3.maxEntries > 0 ? e3.maxEntries : 100 };
}
var Zc = class {
  static createDiscoveryCache(e3) {
    const t2 = (n2 = e3.maxEntries, o2 = e3.ttlMs, "".concat(n2, ":").concat(o2));
    var n2, o2;
    let i2 = (r2 = t2, Dc.get(r2));
    var r2;
    return i2 || (i2 = new Jc(e3.maxEntries, e3.ttlMs), Dc.set(t2, i2)), i2;
  }
  static createJwksCache() {
    return {};
  }
};
var Fc = "openid profile email offline_access";
var Vc = Object.freeze(/* @__PURE__ */ new Set(["grant_type", "client_id", "client_secret", "client_assertion", "client_assertion_type", "subject_token", "subject_token_type", "requested_token_type", "actor_token", "actor_token_type", "audience", "aud", "resource", "resources", "resource_indicator", "scope", "connection", "login_hint", "organization", "assertion"]));
function Xc(e3) {
  if (null == e3) throw new xa("subject_token is required");
  if ("string" != typeof e3) throw new xa("subject_token must be a string");
  if (0 === e3.trim().length) throw new xa("subject_token cannot be blank or whitespace");
  if (e3 !== e3.trim()) throw new xa("subject_token must not include leading or trailing whitespace");
  if (/^bearer\s+/i.test(e3)) throw new xa("subject_token must not include the 'Bearer ' prefix");
}
function Gc(e3, t2) {
  if (t2) for (const o2 of Object.entries(t2)) {
    var n2 = y(o2, 2);
    const t3 = n2[0], i2 = n2[1];
    if (!Vc.has(t3)) if (Array.isArray(i2)) {
      if (i2.length > 20) throw new xa("Parameter '".concat(t3, "' exceeds maximum array size of ").concat(20));
      i2.forEach((n3) => {
        e3.append(t3, n3);
      });
    } else e3.append(t3, i2);
  }
}
var qc = "urn:auth0:params:oauth:grant-type:token-exchange:federated-connection-access-token";
var Yc = "urn:ietf:params:oauth:grant-type:token-exchange";
var Bc = "urn:ietf:params:oauth:token-type:access_token";
function Qc(e3, t2) {
  return (n2, o2) => {
    const i2 = null == o2 ? void 0 : o2.body;
    if (t2 !== pc || !(i2 instanceof URLSearchParams)) return e3(n2, o2);
    const r2 = {};
    for (const e4 of i2) {
      var s2 = y(e4, 2);
      const t3 = s2[0], n3 = s2[1];
      r2[t3] = "authn_response" === t3 || "verification" === t3 ? JSON.parse(n3) : n3;
    }
    const a2 = new Headers(null == o2 ? void 0 : o2.headers);
    return a2.set("Content-Type", "application/json"), e3(n2, f(f({}, o2), {}, { headers: a2, body: JSON.stringify(r2) }));
  };
}
var $c = (ua = /* @__PURE__ */ new WeakMap(), la = /* @__PURE__ */ new WeakMap(), da = /* @__PURE__ */ new WeakMap(), ha = /* @__PURE__ */ new WeakMap(), pa = /* @__PURE__ */ new WeakMap(), fa = /* @__PURE__ */ new WeakMap(), ma = /* @__PURE__ */ new WeakMap(), ya = /* @__PURE__ */ new WeakMap(), wa = /* @__PURE__ */ new WeakMap(), ga = /* @__PURE__ */ new WeakMap(), va = /* @__PURE__ */ new WeakMap(), ba = /* @__PURE__ */ new WeakSet(), class {
  constructor(e3) {
    var t2;
    if (d(this, ba), u(this, ua, void 0), u(this, la, void 0), u(this, da, void 0), u(this, ha, void 0), u(this, pa, void 0), u(this, fa, void 0), u(this, ma, void 0), u(this, ya, void 0), u(this, wa, void 0), u(this, ga, void 0), u(this, va, void 0), h(this, "mfa", void 0), h(this, "passkey", void 0), h(this, "passwordless", void 0), h(this, "database", void 0), h(this, "anonymous", void 0), l(pa, this, e3), e3.useMtls && !e3.customFetch) throw new Sa("mtls_without_custom_fetch_not_supported", "Using mTLS without a custom fetch implementation is not supported");
    l(ma, this, nc(e3.telemetry)), l(fa, this, tc(null !== (t2 = e3.customFetch) && void 0 !== t2 ? t2 : function() {
      return fetch(...arguments);
    }, c(ma, this)));
    const n2 = Hc(e3.discoveryCache);
    l(wa, this, Zc.createDiscoveryCache(n2)), l(ga, this, /* @__PURE__ */ new Map()), l(va, this, Zc.createJwksCache()), this.mfa = new sc({ domain: c(pa, this).domain, clientId: c(pa, this).clientId, clientSecret: c(pa, this).clientSecret, customFetch: c(fa, this), telemetryConfig: c(ma, this), getConfiguration: async (e4) => (await r(ba, this, ou).call(this, e4)).configuration, createCaptureConfiguration: async (e4) => {
      const t3 = (await r(ba, this, iu).call(this)).serverMetadata;
      return r(ba, this, tu).call(this, t3, e4);
    } }), this.passkey = new fc({ domain: c(pa, this).domain, clientId: c(pa, this).clientId, clientSecret: c(pa, this).clientSecret, useMtls: c(pa, this).useMtls, customFetch: c(fa, this), telemetryConfig: c(ma, this), grantRequest: async (e4, t3, n3, o2) => {
      const i2 = (await r(ba, this, iu).call(this)).serverMetadata, s2 = r(ba, this, nu).call(this, n3);
      if (o2) {
        const n4 = oc(s2), o3 = await r(ba, this, tu).call(this, i2, n4);
        o3[Xi] = Qc(n4, e4);
        const a3 = await _r(o3, e4, t3), c3 = ec.fromTokenEndpointResponse(a3), u2 = n4.getCapturedResponse();
        if (!u2) throw new za();
        return { data: c3, response: u2 };
      }
      const a2 = await r(ba, this, tu).call(this, i2);
      a2[Xi] = Qc(s2, e4);
      const c2 = await _r(a2, e4, t3);
      return ec.fromTokenEndpointResponse(c2);
    } }), this.passwordless = new Tc({ domain: c(pa, this).domain, clientId: c(pa, this).clientId, customFetch: c(fa, this), telemetryConfig: c(ma, this), clientSecret: c(pa, this).clientSecret, clientAssertionSigningKey: c(pa, this).clientAssertionSigningKey, clientAssertionSigningAlg: c(pa, this).clientAssertionSigningAlg, useMtls: c(pa, this).useMtls, grantRequest: async (e4, t3, n3, o2) => {
      const i2 = (await r(ba, this, ou).call(this, n3)).configuration;
      if (o2) {
        var s2;
        const n4 = oc(null !== (s2 = i2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), o3 = await r(ba, this, tu).call(this, i2.serverMetadata(), n4), a2 = await _r(o3, e4, t3), u2 = ec.fromTokenEndpointResponse(a2), l2 = n4.getCapturedResponse();
        if (!l2) throw new za();
        return { data: u2, response: l2 };
      }
      try {
        const n4 = await _r(i2, e4, t3);
        return ec.fromTokenEndpointResponse(n4);
      } catch (e5) {
        const t4 = e5, n4 = {};
        throw Ha(n4, e5), t4._statusCode = n4.statusCode, t4._headers = n4.headers, e5;
      }
    } }), this.database = new jc({ domain: c(pa, this).domain, clientId: c(pa, this).clientId, customFetch: c(fa, this), telemetryConfig: c(ma, this) }), this.anonymous = new Lc({ domain: c(pa, this).domain, clientId: c(pa, this).clientId, clientSecret: c(pa, this).clientSecret, clientAssertionSigningKey: c(pa, this).clientAssertionSigningKey, clientAssertionSigningAlg: c(pa, this).clientAssertionSigningAlg, useMtls: c(pa, this).useMtls, customFetch: c(fa, this) });
  }
  async getServerMetadata() {
    return (await r(ba, this, iu).call(this)).serverMetadata;
  }
  async buildAuthorizationUrl(e3) {
    const t2 = (await r(ba, this, iu).call(this)).serverMetadata;
    if (null != e3 && e3.pushedAuthorizationRequests && !t2.pushed_authorization_request_endpoint) throw new Sa("par_not_supported_error", "The Auth0 tenant does not have pushed authorization requests enabled. Learn how to enable it here: https://auth0.com/docs/get-started/applications/configure-par");
    try {
      return await r(ba, this, du).call(this, e3);
    } catch (e4) {
      throw new Na(e4);
    }
  }
  async buildLinkUserUrl(e3) {
    try {
      const t2 = await r(ba, this, du).call(this, { authorizationParams: f(f({}, e3.authorizationParams), {}, { requested_connection: e3.connection, requested_connection_scope: e3.connectionScope, scope: "openid link_account offline_access", id_token_hint: e3.idToken }) });
      return { linkUserUrl: t2.authorizationUrl, codeVerifier: t2.codeVerifier };
    } catch (e4) {
      throw new Ma(e4);
    }
  }
  async buildUnlinkUserUrl(e3) {
    try {
      const t2 = await r(ba, this, du).call(this, { authorizationParams: f(f({}, e3.authorizationParams), {}, { requested_connection: e3.connection, scope: "openid unlink_account", id_token_hint: e3.idToken }) });
      return { unlinkUserUrl: t2.authorizationUrl, codeVerifier: t2.codeVerifier };
    } catch (e4) {
      throw new Ua(e4);
    }
  }
  async backchannelAuthentication(e3, t2) {
    var n2;
    const o2 = await r(ba, this, ou).call(this, t2), i2 = o2.configuration, s2 = o2.serverMetadata, a2 = Za(f(f({}, c(pa, this).authorizationParams), null == e3 ? void 0 : e3.authorizationParams)), u2 = new URLSearchParams(f(f({ scope: Fc }, a2), {}, { client_id: c(pa, this).clientId, binding_message: e3.bindingMessage, login_hint: JSON.stringify({ format: "iss_sub", iss: s2.issuer, sub: e3.loginHint.sub }) }));
    if (e3.requestedExpiry && u2.append("requested_expiry", e3.requestedExpiry.toString()), e3.authorizationDetails && u2.append("authorization_details", JSON.stringify(e3.authorizationDetails)), e3.fullResponse) {
      var l2;
      const e4 = oc(null !== (l2 = i2[Xi]) && void 0 !== l2 ? l2 : c(fa, this)), t3 = await r(ba, this, tu).call(this, i2.serverMetadata(), e4);
      try {
        const n3 = await cr(i2, u2), o3 = await ur(t3, n3), r2 = e4.getCapturedResponse();
        if (!r2) throw new za();
        return { data: ec.fromTokenEndpointResponse(o3), response: r2 };
      } catch (t4) {
        if (t4 instanceof za) throw t4;
        const n3 = new Wa(t4);
        throw Ha(n3, t4, e4.getCapturedResponse()), n3;
      }
    }
    const d2 = oc(null !== (n2 = i2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), h2 = await r(ba, this, tu).call(this, i2.serverMetadata(), d2);
    try {
      const e4 = await cr(i2, u2), t3 = await ur(h2, e4);
      return ec.fromTokenEndpointResponse(t3);
    } catch (e4) {
      const t3 = new Wa(e4);
      throw Ha(t3, e4, d2.getCapturedResponse()), t3;
    }
  }
  async initiateBackchannelAuthentication(e3, t2) {
    var n2;
    const o2 = await r(ba, this, ou).call(this, t2), i2 = o2.configuration, s2 = o2.serverMetadata, a2 = Za(f(f({}, c(pa, this).authorizationParams), null == e3 ? void 0 : e3.authorizationParams)), u2 = new URLSearchParams(f(f({ scope: Fc }, a2), {}, { client_id: c(pa, this).clientId, binding_message: e3.bindingMessage, login_hint: JSON.stringify({ format: "iss_sub", iss: s2.issuer, sub: e3.loginHint.sub }) }));
    e3.requestedExpiry && u2.append("requested_expiry", e3.requestedExpiry.toString()), e3.authorizationDetails && u2.append("authorization_details", JSON.stringify(e3.authorizationDetails));
    const l2 = oc(null !== (n2 = i2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), d2 = await r(ba, this, tu).call(this, i2.serverMetadata(), l2);
    try {
      const e4 = await cr(d2, u2);
      return { authReqId: e4.auth_req_id, expiresIn: e4.expires_in, interval: e4.interval };
    } catch (e4) {
      const t3 = new Wa(e4), n3 = l2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async backchannelAuthenticationGrant(e3, t2) {
    var n2;
    let o2 = e3.authReqId;
    const i2 = (await r(ba, this, ou).call(this, t2)).configuration, s2 = new URLSearchParams({ auth_req_id: o2 }), a2 = oc(null !== (n2 = i2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, i2.serverMetadata(), a2);
    try {
      const e4 = await _r(u2, "urn:openid:params:grant-type:ciba", s2);
      return ec.fromTokenEndpointResponse(e4);
    } catch (e4) {
      const t3 = new Wa(e4), n3 = a2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async getTokenForConnection(e3, t2) {
    var n2;
    if (e3.refreshToken && e3.accessToken) throw new Aa("Either a refresh or access token should be specified, but not both.");
    const o2 = null !== (n2 = e3.accessToken) && void 0 !== n2 ? n2 : e3.refreshToken;
    if (!o2) throw new Aa("Either a refresh or access token must be specified.");
    try {
      return await this.exchangeToken(f({ connection: e3.connection, subjectToken: o2, subjectTokenType: e3.accessToken ? Bc : "urn:ietf:params:oauth:token-type:refresh_token", loginHint: e3.loginHint }, e3.fullResponse ? { fullResponse: true } : {}), t2);
    } catch (e4) {
      if (e4 instanceof xa) {
        const t3 = new Aa(e4.message, e4.cause);
        throw t3.statusCode = e4.statusCode, t3.headers = e4.headers, t3;
      }
      throw e4;
    }
  }
  async exchangeToken(e3, t2) {
    return e3.fullResponse ? "connection" in e3 ? r(ba, this, su).call(this, e3, t2, true) : r(ba, this, cu).call(this, e3, t2, true) : "connection" in e3 ? r(ba, this, su).call(this, e3, t2) : r(ba, this, cu).call(this, e3, t2);
  }
  async getTokenByCode(e3, t2, n2) {
    var o2;
    const i2 = (await r(ba, this, ou).call(this, n2)).configuration;
    if (void 0 !== t2.organization && Fa(t2.organization), t2.fullResponse) {
      var s2;
      const n3 = oc(null !== (s2 = i2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), o3 = await r(ba, this, tu).call(this, i2.serverMetadata(), n3);
      let a3, u3;
      try {
        const i3 = await dr(o3, e3, { pkceCodeVerifier: t2.codeVerifier });
        if (a3 = ec.fromTokenEndpointResponse(i3), u3 = n3.getCapturedResponse(), !u3) throw new za();
      } catch (e4) {
        if (e4 instanceof za) throw e4;
        const t3 = new Pa("There was an error while trying to request a token.", ka(e4)), o4 = n3.getCapturedResponse();
        throw t3.statusCode = null == o4 ? void 0 : o4.status, t3.headers = o4 ? Da(o4.headers) : void 0, t3;
      }
      return t2.organization && Va(a3.claims, t2.organization), { data: a3, response: u3 };
    }
    const a2 = oc(null !== (o2 = i2[Xi]) && void 0 !== o2 ? o2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, i2.serverMetadata(), a2);
    let l2;
    try {
      const n3 = await dr(u2, e3, { pkceCodeVerifier: t2.codeVerifier });
      l2 = ec.fromTokenEndpointResponse(n3);
    } catch (e4) {
      const t3 = new Pa("There was an error while trying to request a token.", ka(e4)), n3 = a2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
    return t2.organization && Va(l2.claims, t2.organization), l2;
  }
  async getTokenByMagicLinkCode(e3, t2, n2) {
    var o2;
    const i2 = (await r(ba, this, ou).call(this, n2)).configuration;
    if (null != t2 && t2.fullResponse) {
      var s2;
      const n3 = oc(null !== (s2 = i2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), o3 = await r(ba, this, tu).call(this, i2.serverMetadata(), n3);
      try {
        const i3 = await dr(o3, e3, { expectedState: null == t2 ? void 0 : t2.expectedState }), r2 = ec.fromTokenEndpointResponse(i3), s3 = n3.getCapturedResponse();
        if (!s3) throw new za();
        return { data: r2, response: s3 };
      } catch (e4) {
        if (e4 instanceof za) throw e4;
        const t3 = e4 instanceof Error && e4.message ? e4.message : "There was an error while trying to request a token.", o4 = new Pa(t3, e4), i3 = n3.getCapturedResponse();
        throw o4.statusCode = null == i3 ? void 0 : i3.status, o4.headers = i3 ? Da(i3.headers) : void 0, o4;
      }
    }
    const a2 = oc(null !== (o2 = i2[Xi]) && void 0 !== o2 ? o2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, i2.serverMetadata(), a2);
    try {
      const n3 = await dr(u2, e3, { expectedState: null == t2 ? void 0 : t2.expectedState });
      return ec.fromTokenEndpointResponse(n3);
    } catch (e4) {
      const t3 = e4 instanceof Error && e4.message ? e4.message : "There was an error while trying to request a token.", n3 = new Pa(t3, e4), o3 = a2.getCapturedResponse();
      throw n3.statusCode = null == o3 ? void 0 : o3.status, n3.headers = o3 ? Da(o3.headers) : void 0, n3;
    }
  }
  async getTokenByRefreshToken(e3, t2) {
    var n2;
    const o2 = (await r(ba, this, ou).call(this, t2)).configuration, i2 = new URLSearchParams();
    if (e3.audience && i2.append("audience", e3.audience), e3.scope && i2.append("scope", e3.scope), e3.fullResponse) {
      var s2;
      const t3 = oc(null !== (s2 = o2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), n3 = await r(ba, this, tu).call(this, o2.serverMetadata(), t3);
      try {
        const o3 = await hr(n3, e3.refreshToken, i2), r2 = ec.fromTokenEndpointResponse(o3), s3 = t3.getCapturedResponse();
        if (!s3) throw new za();
        return { data: r2, response: s3 };
      } catch (e4) {
        if (e4 instanceof za) throw e4;
        const n4 = new Ea("The access token has expired and there was an error while trying to refresh it.", ka(e4)), o3 = t3.getCapturedResponse();
        throw n4.statusCode = null == o3 ? void 0 : o3.status, n4.headers = o3 ? Da(o3.headers) : void 0, n4;
      }
    }
    const a2 = oc(null !== (n2 = o2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, o2.serverMetadata(), a2);
    try {
      const t3 = await hr(u2, e3.refreshToken, i2);
      return ec.fromTokenEndpointResponse(t3);
    } catch (e4) {
      const t3 = new Ea("The access token has expired and there was an error while trying to refresh it.", ka(e4)), n3 = a2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async revokeToken(e3, t2) {
    var n2;
    const o2 = (await r(ba, this, ou).call(this, t2)).configuration, i2 = {};
    e3.tokenTypeHint && (i2.token_type_hint = e3.tokenTypeHint);
    const s2 = oc(null !== (n2 = o2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), a2 = await r(ba, this, tu).call(this, o2.serverMetadata(), s2);
    try {
      await kr(a2, e3.token, i2);
    } catch (e4) {
      const t3 = new Ia("An error occurred while trying to revoke the token.", ka(e4)), n3 = s2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async getUserInfo(e3, t2) {
    const n2 = (await r(ba, this, ou).call(this, t2, true)).configuration;
    try {
      var o2;
      return await gr(n2, e3.accessToken, null !== (o2 = e3.expectedSubject) && void 0 !== o2 ? o2 : Vi);
    } catch (e4) {
      throw new Oa("There was an error while trying to retrieve the user info.", ka(e4));
    }
  }
  async getTokenByPassword(e3, t2) {
    var n2;
    const o2 = (await r(ba, this, ou).call(this, t2)).configuration, i2 = new URLSearchParams({ username: e3.username, password: e3.password });
    e3.audience && i2.append("audience", e3.audience), e3.scope && i2.append("scope", e3.scope), e3.realm && i2.append("realm", e3.realm);
    let s2 = o2;
    if (e3.auth0ForwardedFor) {
      const t3 = await r(ba, this, lu).call(this);
      s2 = new ir(o2.serverMetadata(), c(pa, this).clientId, { client_secret: c(pa, this).clientSecret, use_mtls_endpoint_aliases: c(pa, this).useMtls }, t3);
      const n3 = o2[Xi];
      s2[Xi] = (t4, o3) => n3(t4, f(f({}, o3), {}, { headers: f(f({}, o3.headers), {}, { "auth0-forwarded-for": e3.auth0ForwardedFor }) }));
    }
    if (e3.fullResponse) {
      var a2;
      const e4 = oc(null !== (a2 = s2[Xi]) && void 0 !== a2 ? a2 : c(fa, this)), t3 = await r(ba, this, tu).call(this, s2.serverMetadata(), e4);
      try {
        const n3 = await _r(t3, "password", i2), o3 = ec.fromTokenEndpointResponse(n3), r2 = e4.getCapturedResponse();
        if (!r2) throw new za();
        return { data: o3, response: r2 };
      } catch (t4) {
        if (t4 instanceof za) throw t4;
        const n3 = new Ra("There was an error while trying to request a token.", ka(t4)), o3 = e4.getCapturedResponse();
        throw n3.statusCode = null == o3 ? void 0 : o3.status, n3.headers = o3 ? Da(o3.headers) : void 0, n3;
      }
    }
    const u2 = oc(null !== (n2 = s2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), l2 = await r(ba, this, tu).call(this, s2.serverMetadata(), u2);
    try {
      const e4 = await _r(l2, "password", i2);
      return ec.fromTokenEndpointResponse(e4);
    } catch (e4) {
      const t3 = new Ra("There was an error while trying to request a token.", ka(e4)), n3 = u2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async getTokenByPasswordlessEmail(e3, t2) {
    const n2 = new URLSearchParams({ username: e3.email, otp: e3.code, realm: "email" });
    return e3.audience && n2.append("audience", e3.audience), e3.scope && n2.append("scope", e3.scope), r(ba, this, uu).call(this, n2, t2, e3.fullResponse);
  }
  async getTokenByPasswordlessSms(e3, t2) {
    if (!kc(e3.phoneNumber)) throw new vc("Phone number must be in E.164 format (e.g. +14155550100).");
    const n2 = new URLSearchParams({ username: e3.phoneNumber, otp: e3.code, realm: "sms" });
    return e3.audience && n2.append("audience", e3.audience), e3.scope && n2.append("scope", e3.scope), r(ba, this, uu).call(this, n2, t2, e3.fullResponse);
  }
  async getTokenByClientCredentials(e3, t2) {
    var n2;
    const o2 = (function(e4) {
      if (null == e4) return;
      const t3 = "string" == typeof e4 ? e4.split(/\s+/).filter(Boolean) : [];
      if (0 === t3.length) throw new Ja();
      return t3.join(" ");
    })(e3.scope), i2 = (await r(ba, this, ou).call(this, t2)).configuration;
    if (e3.fullResponse) {
      var s2;
      const t3 = oc(null !== (s2 = i2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), n3 = await r(ba, this, tu).call(this, i2.serverMetadata(), t3), a3 = new URLSearchParams({ audience: e3.audience });
      e3.organization && a3.append("organization", e3.organization), void 0 !== o2 && a3.append("scope", o2);
      try {
        const e4 = await pr(n3, a3), o3 = ec.fromTokenEndpointResponse(e4), i3 = t3.getCapturedResponse();
        if (!i3) throw new za();
        return { data: o3, response: i3 };
      } catch (e4) {
        if (e4 instanceof za) throw e4;
        const n4 = new Ca("There was an error while trying to request a token.", ka(e4)), o3 = t3.getCapturedResponse();
        throw n4.statusCode = null == o3 ? void 0 : o3.status, n4.headers = o3 ? Da(o3.headers) : void 0, n4;
      }
    }
    const a2 = oc(null !== (n2 = i2[Xi]) && void 0 !== n2 ? n2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, i2.serverMetadata(), a2);
    try {
      const t3 = new URLSearchParams({ audience: e3.audience });
      e3.organization && t3.append("organization", e3.organization), void 0 !== o2 && t3.append("scope", o2);
      const n3 = await pr(u2, t3);
      return ec.fromTokenEndpointResponse(n3);
    } catch (e4) {
      const t3 = new Ca("There was an error while trying to request a token.", ka(e4)), n3 = a2.getCapturedResponse();
      throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
    }
  }
  async buildLogoutUrl(e3) {
    const t2 = await r(ba, this, iu).call(this), n2 = t2.configuration;
    if (!t2.serverMetadata.end_session_endpoint) {
      const t3 = new URL("https://".concat(c(pa, this).domain, "/v2/logout"));
      return t3.searchParams.set("returnTo", e3.returnTo), t3.searchParams.set("client_id", c(pa, this).clientId), e3.federated && t3.searchParams.set("federated", ""), t3;
    }
    const o2 = { post_logout_redirect_uri: e3.returnTo };
    return e3.federated && (o2.federated = ""), (function(e4, t3) {
      yr(e4);
      const n3 = Di(e4), o3 = n3.as, i2 = n3.c, r2 = En(o3, "end_session_endpoint", false, n3.tlsOnly);
      (t3 = new URLSearchParams(t3)).has("client_id") || t3.set("client_id", i2.client_id);
      for (const e5 of t3.entries()) {
        var s2 = y(e5, 2);
        const t4 = s2[0], n4 = s2[1];
        r2.searchParams.append(t4, n4);
      }
      return r2;
    })(n2, o2);
  }
  async verifyLogoutToken(e3) {
    const t2 = (await r(ba, this, iu).call(this)).serverMetadata, n2 = Hc(c(pa, this).discoveryCache), o2 = t2.jwks_uri;
    c(ya, this) || l(ya, this, vs(new URL(o2), { cacheMaxAge: n2.ttlMs, [ms]: c(fa, this), [ys]: c(va, this) }));
    const i2 = (await qr(e3.logoutToken, c(ya, this), { issuer: t2.issuer, audience: c(pa, this).clientId, algorithms: ["RS256"], requiredClaims: ["iat"] })).payload;
    if (!("sid" in i2) && !("sub" in i2)) throw new ja('either "sid" or "sub" (or both) claims must be present');
    if ("sid" in i2 && "string" != typeof i2.sid) throw new ja('"sid" claim must be a string');
    if ("sub" in i2 && "string" != typeof i2.sub) throw new ja('"sub" claim must be a string');
    if ("nonce" in i2) throw new ja('"nonce" claim is prohibited');
    if (!("events" in i2)) throw new ja('"events" claim is missing');
    if ("object" != typeof i2.events || null === i2.events) throw new ja('"events" claim must be an object');
    if (!("http://schemas.openid.net/event/backchannel-logout" in i2.events)) throw new ja('"http://schemas.openid.net/event/backchannel-logout" member is missing in the "events" claim');
    if ("object" != typeof i2.events["http://schemas.openid.net/event/backchannel-logout"]) throw new ja('"http://schemas.openid.net/event/backchannel-logout" member in the "events" claim must be an object');
    return { sid: i2.sid, sub: i2.sub };
  }
});
function eu() {
  const e3 = c(pa, this).domain.toLowerCase();
  return "".concat(e3, "|mtls:").concat(c(pa, this).useMtls ? "1" : "0");
}
async function tu(e3, t2) {
  let n2 = arguments.length > 2 && void 0 !== arguments[2] && arguments[2];
  const o2 = await r(ba, this, lu).call(this, n2), i2 = new ir(e3, c(pa, this).clientId, { client_secret: c(pa, this).clientSecret, use_mtls_endpoint_aliases: c(pa, this).useMtls }, o2);
  return i2[Xi] = null != t2 ? t2 : c(fa, this), i2;
}
function nu(e3) {
  return ic(c(fa, this), e3, c(ma, this));
}
async function ou(e3) {
  let t2 = arguments.length > 1 && void 0 !== arguments[1] && arguments[1];
  const n2 = await r(ba, this, iu).call(this, t2), o2 = n2.configuration, i2 = n2.serverMetadata;
  if (!e3) return { configuration: o2, serverMetadata: i2 };
  const s2 = r(ba, this, nu).call(this, e3);
  return { configuration: await r(ba, this, tu).call(this, i2, s2, t2), serverMetadata: i2 };
}
async function iu() {
  let e3 = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
  const t2 = c(e3 ? la : ua, this);
  if (t2 && c(da, this)) return { configuration: t2, serverMetadata: c(da, this) };
  const n2 = r(ba, this, eu).call(this);
  e3 || await r(ba, this, lu).call(this, false);
  const o2 = c(wa, this).get(n2);
  if (o2) return r(ba, this, ru).call(this, o2.serverMetadata, e3);
  const i2 = c(ga, this).get(n2);
  if (i2) {
    const t3 = await i2;
    return r(ba, this, ru).call(this, t3.serverMetadata, e3);
  }
  const s2 = (async () => {
    const e4 = (await nr(new URL("https://".concat(c(pa, this).domain)), c(pa, this).clientId, { use_mtls_endpoint_aliases: c(pa, this).useMtls }, (e5, t3, n3, o3) => {
      n3.set("client_id", t3.client_id);
    }, { [Xi]: c(fa, this) })).serverMetadata();
    return c(wa, this).set(n2, { serverMetadata: e4 }), { serverMetadata: e4 };
  })();
  s2.catch(() => {
  }), c(ga, this).set(n2, s2);
  try {
    const t3 = (await s2).serverMetadata;
    return r(ba, this, ru).call(this, t3, e3);
  } finally {
    c(ga, this).delete(n2);
  }
}
async function ru(e3, t2) {
  const n2 = await r(ba, this, tu).call(this, e3, void 0, t2);
  return l(da, this, e3), l(t2 ? la : ua, this, n2), { configuration: n2, serverMetadata: e3 };
}
async function su(e3, t2, n2) {
  var o2, i2, s2;
  const a2 = (await r(ba, this, ou).call(this, t2)).configuration;
  if ("audience" in e3 || "resource" in e3) throw new xa("audience and resource parameters are not supported for Token Vault exchanges");
  Xc(e3.subjectToken);
  const u2 = new URLSearchParams({ connection: e3.connection, subject_token: e3.subjectToken, subject_token_type: null !== (o2 = e3.subjectTokenType) && void 0 !== o2 ? o2 : Bc, requested_token_type: null !== (i2 = e3.requestedTokenType) && void 0 !== i2 ? i2 : "http://auth0.com/oauth/token-type/federated-connection-access-token" });
  if (e3.loginHint && u2.append("login_hint", e3.loginHint), e3.scope && u2.append("scope", e3.scope), Gc(u2, e3.extra), n2) {
    var l2;
    const t3 = oc(null !== (l2 = a2[Xi]) && void 0 !== l2 ? l2 : c(fa, this)), n3 = await r(ba, this, tu).call(this, a2.serverMetadata(), t3);
    try {
      const e4 = await _r(n3, qc, u2), o3 = ec.fromTokenEndpointResponse(e4), i3 = t3.getCapturedResponse();
      if (!i3) throw new za();
      return { data: o3, response: i3 };
    } catch (n4) {
      if (n4 instanceof za) throw n4;
      const o3 = new xa("Failed to exchange token for connection '".concat(e3.connection, "'."), ka(n4)), i3 = t3.getCapturedResponse();
      throw o3.statusCode = null == i3 ? void 0 : i3.status, o3.headers = i3 ? Da(i3.headers) : void 0, o3;
    }
  }
  const d2 = oc(null !== (s2 = a2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), h2 = await r(ba, this, tu).call(this, a2.serverMetadata(), d2);
  try {
    const e4 = await _r(h2, qc, u2);
    return ec.fromTokenEndpointResponse(e4);
  } catch (t3) {
    const n3 = new xa("Failed to exchange token for connection '".concat(e3.connection, "'."), ka(t3)), o3 = d2.getCapturedResponse();
    throw n3.statusCode = null == o3 ? void 0 : o3.status, n3.headers = o3 ? Da(o3.headers) : void 0, n3;
  }
}
function au(e3, t2, n2) {
  var o2;
  if (n2.organization && Va(e3.claims, n2.organization), n2.actorToken) if (null !== (o2 = e3.claims) && void 0 !== o2 && o2.act) e3.act = e3.claims.act;
  else try {
    e3.act = (function(e4) {
      if ("string" != typeof e4) throw new Qo("JWTs must use Compact JWS serialization, JWT must be a string");
      const t3 = e4.split("."), n3 = t3[1], o3 = t3.length;
      if (5 === o3) throw new Qo("Only JWTs using Compact JWS serialization can be decoded");
      if (3 !== o3) throw new Qo("Invalid JWT");
      if (!n3) throw new Qo("JWTs must contain a payload");
      let i2, r2;
      try {
        i2 = ii(n3);
      } catch (e5) {
        throw new Qo("Failed to base64url decode the payload", { cause: e5 });
      }
      try {
        r2 = JSON.parse(Jo.decode(i2));
      } catch (e5) {
        throw new Qo("Failed to parse the decoded payload as JSON", { cause: e5 });
      }
      if (!si(r2)) throw new Qo("Invalid JWT Claims Set");
      return r2;
    })(t2.access_token).act;
  } catch (e4) {
  }
  return e3;
}
async function cu(e3, t2, n2) {
  var o2;
  const i2 = (await r(ba, this, ou).call(this, t2)).configuration;
  if (Xc(e3.subjectToken), void 0 !== e3.organization && Fa(e3.organization), void 0 !== e3.actorToken && void 0 === e3.actorTokenType) throw new xa("actorTokenType is required when actorToken is provided");
  const s2 = new URLSearchParams({ subject_token_type: e3.subjectTokenType, subject_token: e3.subjectToken });
  if (e3.audience && s2.append("audience", e3.audience), e3.scope && s2.append("scope", e3.scope), e3.requestedTokenType && s2.append("requested_token_type", e3.requestedTokenType), e3.organization && s2.append("organization", e3.organization), e3.actorToken && s2.append("actor_token", e3.actorToken), e3.actorTokenType && s2.append("actor_token_type", e3.actorTokenType), Gc(s2, e3.extra), n2) {
    var a2;
    const t3 = oc(null !== (a2 = i2[Xi]) && void 0 !== a2 ? a2 : c(fa, this)), n3 = await r(ba, this, tu).call(this, i2.serverMetadata(), t3);
    let o3, u3, l3;
    try {
      if (u3 = await _r(n3, Yc, s2), o3 = ec.fromTokenEndpointResponse(u3), l3 = t3.getCapturedResponse(), !l3) throw new za();
    } catch (n4) {
      if (n4 instanceof za) throw n4;
      const o4 = new xa("Failed to exchange token of type '".concat(e3.subjectTokenType, "'").concat(e3.audience ? " for audience '".concat(e3.audience, "'") : "", "."), ka(n4)), i3 = t3.getCapturedResponse();
      throw o4.statusCode = null == i3 ? void 0 : i3.status, o4.headers = i3 ? Da(i3.headers) : void 0, o4;
    }
    return r(ba, this, au).call(this, o3, u3, e3), { data: o3, response: l3 };
  }
  const u2 = oc(null !== (o2 = i2[Xi]) && void 0 !== o2 ? o2 : c(fa, this)), l2 = await r(ba, this, tu).call(this, i2.serverMetadata(), u2);
  let d2, h2;
  try {
    h2 = await _r(l2, Yc, s2), d2 = ec.fromTokenEndpointResponse(h2);
  } catch (t3) {
    const n3 = new xa("Failed to exchange token of type '".concat(e3.subjectTokenType, "'").concat(e3.audience ? " for audience '".concat(e3.audience, "'") : "", "."), ka(t3)), o3 = u2.getCapturedResponse();
    throw n3.statusCode = null == o3 ? void 0 : o3.status, n3.headers = o3 ? Da(o3.headers) : void 0, n3;
  }
  return r(ba, this, au).call(this, d2, h2, e3), d2;
}
async function uu(e3, t2, n2) {
  var o2;
  const i2 = (await r(ba, this, ou).call(this, t2)).configuration;
  if (n2) {
    var s2;
    const t3 = oc(null !== (s2 = i2[Xi]) && void 0 !== s2 ? s2 : c(fa, this)), n3 = await r(ba, this, tu).call(this, i2.serverMetadata(), t3);
    try {
      const o3 = await _r(n3, "http://auth0.com/oauth/grant-type/passwordless/otp", e3), i3 = ec.fromTokenEndpointResponse(o3), r2 = t3.getCapturedResponse();
      if (!r2) throw new za();
      return { data: i3, response: r2 };
    } catch (e4) {
      if (e4 instanceof za) throw e4;
      const n4 = new vc("There was an error while trying to request a token.", ka(e4)), o3 = t3.getCapturedResponse();
      throw n4.statusCode = null == o3 ? void 0 : o3.status, n4.headers = o3 ? Da(o3.headers) : void 0, n4;
    }
  }
  const a2 = oc(null !== (o2 = i2[Xi]) && void 0 !== o2 ? o2 : c(fa, this)), u2 = await r(ba, this, tu).call(this, i2.serverMetadata(), a2);
  try {
    const t3 = await _r(u2, "http://auth0.com/oauth/grant-type/passwordless/otp", e3);
    return ec.fromTokenEndpointResponse(t3);
  } catch (e4) {
    const t3 = new vc("There was an error while trying to request a token.", ka(e4)), n3 = a2.getCapturedResponse();
    throw t3.statusCode = null == n3 ? void 0 : n3.status, t3.headers = n3 ? Da(n3.headers) : void 0, t3;
  }
}
async function lu() {
  let e3 = arguments.length > 0 && void 0 !== arguments[0] && arguments[0];
  const t2 = !!c(pa, this).clientSecret || !!c(pa, this).clientAssertionSigningKey || !!c(pa, this).useMtls;
  return e3 && !t2 ? (e4, t3, n2, o2) => {
    n2.set("client_id", t3.client_id);
  } : (c(ha, this) || l(ha, this, (async () => {
    if (!c(pa, this).clientSecret && !c(pa, this).clientAssertionSigningKey && !c(pa, this).useMtls) throw new La();
    if (c(pa, this).useMtls) return (e5, t3, n2, o2) => {
      n2.set("client_id", t3.client_id);
    };
    let e4 = c(pa, this).clientAssertionSigningKey;
    return !e4 || e4 instanceof CryptoKey || (e4 = await bs(e4, c(pa, this).clientAssertionSigningAlg || "RS256")), e4 ? (function(e5, t3) {
      return Sn(e5, t3);
    })(e4) : Fi(c(pa, this).clientSecret);
  })().catch((e4) => {
    throw l(ha, this, void 0), e4;
  })), c(ha, this));
}
async function du(e3) {
  const t2 = (await r(ba, this, iu).call(this)).configuration, n2 = Qi(), o2 = await Bi(n2), i2 = Za(f(f({}, c(pa, this).authorizationParams), null == e3 ? void 0 : e3.authorizationParams)), s2 = new URLSearchParams(f(f({ scope: Fc }, i2), {}, { client_id: c(pa, this).clientId, code_challenge: o2, code_challenge_method: "S256" }));
  return { authorizationUrl: null != e3 && e3.pushedAuthorizationRequests ? await mr(t2, s2) : await fr(t2, s2), codeVerifier: n2 };
}
var hu = new Jc(1e3, 6e4);
var pu = class _pu extends E {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _pu.prototype);
  }
  static fromPayload(e3) {
    let t2 = e3.error, n2 = e3.error_description;
    return new _pu(t2, n2);
  }
};
var fu = class _fu extends pu {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _fu.prototype);
  }
};
var mu = class _mu extends pu {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _mu.prototype);
  }
};
var yu = class _yu extends pu {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _yu.prototype);
  }
};
var wu = class _wu extends pu {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _wu.prototype);
  }
};
var gu = class _gu extends pu {
  constructor(e3, t2) {
    super(e3, t2), Object.setPrototypeOf(this, _gu.prototype);
  }
};
var vu = class {
  constructor() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 6e5;
    this.contexts = /* @__PURE__ */ new Map(), this.ttlMs = e3;
  }
  set(e3, t2) {
    this.cleanup(), this.contexts.set(e3, Object.assign(Object.assign({}, t2), { createdAt: Date.now() }));
  }
  get(e3) {
    const t2 = this.contexts.get(e3);
    if (t2) {
      if (!(Date.now() - t2.createdAt > this.ttlMs)) return t2;
      this.contexts.delete(e3);
    }
  }
  remove(e3) {
    this.contexts.delete(e3);
  }
  cleanup() {
    const e3 = Date.now();
    for (const n2 of this.contexts) {
      var t2 = y(n2, 2);
      const o2 = t2[0];
      e3 - t2[1].createdAt > this.ttlMs && this.contexts.delete(o2);
    }
  }
  get size() {
    return this.contexts.size;
  }
};
var bu = class {
  constructor(e3, t2) {
    this.authJsMfaClient = e3, this.auth0Client = t2, this.contextManager = new vu();
  }
  setMFAAuthDetails(e3, t2, n2, o2) {
    this.contextManager.set(e3, { scope: t2, audience: n2, mfaRequirements: o2 });
  }
  async getAuthenticators(e3) {
    var t2, n2, o2;
    const i2 = this.contextManager.get(e3);
    if (!i2) throw new fu("invalid_request", "MFA context not found for this MFA token");
    const r2 = null === (n2 = null === (t2 = i2.mfaRequirements) || void 0 === t2 ? void 0 : t2.challenge) || void 0 === n2 ? void 0 : n2.map((e4) => e4.type);
    try {
      const t3 = await this.authJsMfaClient.listAuthenticators({ mfaToken: e3 });
      return r2 && 0 !== r2.length ? t3.filter((e4) => !!e4.type && r2.includes(e4.type)) : t3;
    } catch (e4) {
      if (e4 instanceof Ga) throw new fu(null === (o2 = e4.cause) || void 0 === o2 ? void 0 : o2.error, e4.message);
      throw e4;
    }
  }
  async enroll(e3) {
    var t2;
    const n2 = (function(e4) {
      const t3 = jt[e4.factorType];
      return Object.assign(Object.assign(Object.assign({ mfaToken: e4.mfaToken, authenticatorTypes: t3.authenticatorTypes }, t3.oobChannels && { oobChannels: t3.oobChannels }), "phoneNumber" in e4 && { phoneNumber: e4.phoneNumber }), "email" in e4 && { email: e4.email });
    })(e3);
    try {
      return await this.authJsMfaClient.enrollAuthenticator(n2);
    } catch (e4) {
      if (e4 instanceof qa) throw new mu(null === (t2 = e4.cause) || void 0 === t2 ? void 0 : t2.error, e4.message);
      throw e4;
    }
  }
  async challenge(e3) {
    var t2;
    try {
      const t3 = { challengeType: e3.challengeType, mfaToken: e3.mfaToken };
      return e3.authenticatorId && (t3.authenticatorId = e3.authenticatorId), await this.authJsMfaClient.challengeAuthenticator(t3);
    } catch (e4) {
      if (e4 instanceof Ba) throw new yu(null === (t2 = e4.cause) || void 0 === t2 ? void 0 : t2.error, e4.message);
      throw e4;
    }
  }
  async getEnrollmentFactors(e3) {
    const t2 = this.contextManager.get(e3);
    if (!t2 || !t2.mfaRequirements) throw new gu("mfa_context_not_found", "MFA context not found for this MFA token. Please retry the original request to get a new MFA token.");
    return t2.mfaRequirements.enroll && 0 !== t2.mfaRequirements.enroll.length ? t2.mfaRequirements.enroll : [];
  }
  async verify(e3) {
    const t2 = this.contextManager.get(e3.mfaToken);
    if (!t2) throw new wu("mfa_context_not_found", "MFA context not found for this MFA token. Please retry the original request to get a new MFA token.");
    const n2 = (function(e4) {
      return "otp" in e4 && e4.otp ? Wt : "oobCode" in e4 && e4.oobCode ? Nt : "recoveryCode" in e4 && e4.recoveryCode ? Mt : void 0;
    })(e3);
    if (!n2) throw new wu("invalid_request", "Unable to determine grant type. Provide one of: otp, oobCode, or recoveryCode.");
    const o2 = t2.scope, i2 = t2.audience;
    try {
      const t3 = await this.auth0Client._requestTokenForMfa({ grant_type: n2, mfaToken: e3.mfaToken, scope: o2, audience: i2, otp: e3.otp, oob_code: e3.oobCode, binding_code: e3.bindingCode, recovery_code: e3.recoveryCode });
      return this.contextManager.remove(e3.mfaToken), t3;
    } catch (e4) {
      if (e4 instanceof wu) throw new wu(e4.error, e4.error_description);
      throw e4;
    }
  }
};
var _u = class __u extends Error {
  constructor(e3, t2, n2) {
    super(t2), this.name = "PasskeyError", this.code = e3, this.cause = n2, Object.setPrototypeOf(this, __u.prototype);
  }
};
var ku;
var Su;
var Tu;
var Pu = class {
  constructor(e3, t2) {
    ku.set(this, void 0), Su.set(this, void 0), Tu.set(this, null), n(this, ku, e3, "f"), n(this, Su, t2, "f");
  }
  async signup(o2) {
    if (!window.PublicKeyCredential) throw new _u("passkey_not_supported", "WebAuthn is not supported in this browser.");
    n(this, Tu, null, "f");
    const i2 = o2.scope, r2 = o2.audience, s2 = e(o2, ["scope", "audience"]), a2 = await t(this, ku, "f").register(s2);
    if (a2.verificationRequired && a2.verificationRequired.length > 0) throw n(this, Tu, { authSession: a2.authSession, publicKey: Ru(a2.authnParamsPublicKey), verificationRequired: a2.verificationRequired, realm: s2.realm, organization: s2.organization, scope: i2, audience: r2 }, "f"), new M(a2.verificationRequired);
    const c2 = Ru(a2.authnParamsPublicKey), u2 = await navigator.credentials.create({ publicKey: c2 });
    if (!u2) throw new _u("passkey_cancelled", "Passkey creation was cancelled or no credential was returned.");
    const l2 = xu(u2);
    return t(this, Su, "f")._requestTokenForPasskey({ authSession: a2.authSession, credential: l2, realm: s2.realm, organization: s2.organization, scope: i2, audience: r2 });
  }
  async login(n2) {
    if (!window.PublicKeyCredential) throw new _u("passkey_not_supported", "WebAuthn is not supported in this browser.");
    const o2 = n2 || {}, i2 = o2.scope, r2 = o2.audience, s2 = e(o2, ["scope", "audience"]), a2 = await t(this, ku, "f").challenge(Object.keys(s2).length > 0 ? s2 : void 0), c2 = Au(a2.authnParamsPublicKey), u2 = await navigator.credentials.get({ publicKey: c2 });
    if (!u2) throw new _u("passkey_cancelled", "Passkey authentication was cancelled or no credential was returned.");
    const l2 = Iu(u2);
    return t(this, Su, "f")._requestTokenForPasskey({ authSession: a2.authSession, credential: l2, realm: s2.realm, organization: s2.organization, scope: i2, audience: r2 });
  }
  async getSignupChallenge(e3) {
    if (!window.PublicKeyCredential) throw new _u("passkey_not_supported", "WebAuthn is not supported in this browser.");
    const n2 = await t(this, ku, "f").register(e3);
    return Object.assign({ authSession: n2.authSession, publicKey: Ru(n2.authnParamsPublicKey) }, n2.verificationRequired && { verificationRequired: n2.verificationRequired });
  }
  async getLoginChallenge(e3) {
    if (!window.PublicKeyCredential) throw new _u("passkey_not_supported", "WebAuthn is not supported in this browser.");
    const n2 = await t(this, ku, "f").challenge(e3);
    return { authSession: n2.authSession, publicKey: Au(n2.authnParamsPublicKey) };
  }
  async getTokenWithPasskey(e3) {
    if (!window.PublicKeyCredential) throw new _u("passkey_not_supported", "WebAuthn is not supported in this browser.");
    const n2 = e3.authSession, o2 = e3.credential, i2 = e3.realm, r2 = e3.organization, s2 = e3.scope, a2 = e3.audience, c2 = e3.verification, u2 = null != c2 ? c2 : {};
    if (Object.keys(u2).some((e4) => "" === u2[e4])) throw new _u("missing_verification_code", "OTP codes in verification must not be empty.");
    const l2 = o2.response;
    let d2;
    if (l2 instanceof AuthenticatorAttestationResponse) d2 = xu(o2);
    else {
      if (!(l2 instanceof AuthenticatorAssertionResponse)) throw new _u("passkey_invalid_credential", "The provided credential is not a valid attestation or assertion response.");
      d2 = Iu(o2);
    }
    return t(this, Su, "f")._requestTokenForPasskey({ authSession: n2, credential: d2, realm: i2, organization: r2, scope: s2, audience: a2, verification: c2 });
  }
  async continueSignup(e3) {
    if (!t(this, Tu, "f")) throw new _u("no_pending_signup", "No pending signup found. Call signup() first and catch PasskeyVerificationRequiredError.");
    const o2 = t(this, Tu, "f").verificationRequired.filter((t2) => !(null == e3 ? void 0 : e3[t2]));
    if (o2.length > 0) throw new _u("missing_verification_code", "Missing OTP code for: ".concat(o2.join(", "), ". Pass a code for each identifier in verificationRequired."));
    const i2 = t(this, Tu, "f");
    n(this, Tu, null, "f");
    const r2 = i2.authSession, s2 = i2.publicKey, a2 = i2.realm, c2 = i2.organization, u2 = i2.scope, l2 = i2.audience;
    let d2 = i2.credential;
    if (!d2) {
      let e4;
      try {
        e4 = await navigator.credentials.create({ publicKey: s2 });
      } catch (e5) {
        throw n(this, Tu, i2, "f"), e5;
      }
      if (!e4) throw n(this, Tu, i2, "f"), new _u("passkey_cancelled", "Passkey creation was cancelled or no credential was returned.");
      d2 = xu(e4);
    }
    try {
      return await t(this, Su, "f")._requestTokenForPasskey({ authSession: r2, credential: d2, realm: a2, organization: c2, scope: u2, audience: l2, verification: e3 });
    } catch (e4) {
      throw e4 instanceof dc && e4.isRetryable && n(this, Tu, Object.assign(Object.assign({}, i2), { authSession: e4.authSession, verificationRequired: e4.verificationRequired, credential: d2 }), "f"), e4;
    }
  }
};
function Cu(e3) {
  const t2 = new Uint8Array(e3), n2 = Array.from(t2, (e4) => String.fromCharCode(e4)).join("");
  return btoa(n2).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function Eu(e3) {
  const t2 = e3.replace(/-/g, "+").replace(/_/g, "/"), n2 = t2 + "=".repeat((4 - t2.length % 4) % 4), o2 = atob(n2), i2 = new Uint8Array(o2.length);
  for (let e4 = 0; e4 < o2.length; e4++) i2[e4] = o2.charCodeAt(e4);
  return i2.buffer;
}
function Ru(e3) {
  return Object.assign(Object.assign({}, e3), { challenge: Eu(e3.challenge), user: Object.assign(Object.assign({}, e3.user), { id: Eu(e3.user.id) }), pubKeyCredParams: e3.pubKeyCredParams, authenticatorSelection: e3.authenticatorSelection });
}
function Au(e3) {
  return Object.assign(Object.assign({}, e3), { challenge: Eu(e3.challenge) });
}
function xu(e3) {
  var t2;
  const n2 = e3.response;
  return { id: e3.id, rawId: Cu(e3.rawId), type: e3.type, authenticatorAttachment: null !== (t2 = e3.authenticatorAttachment) && void 0 !== t2 ? t2 : void 0, response: { clientDataJSON: Cu(n2.clientDataJSON), attestationObject: Cu(n2.attestationObject) }, clientExtensionResults: e3.getClientExtensionResults() };
}
function Iu(e3) {
  var t2;
  const n2 = e3.response;
  return { id: e3.id, rawId: Cu(e3.rawId), type: e3.type, authenticatorAttachment: null !== (t2 = e3.authenticatorAttachment) && void 0 !== t2 ? t2 : void 0, response: { clientDataJSON: Cu(n2.clientDataJSON), authenticatorData: Cu(n2.authenticatorData), signature: Cu(n2.signature), userHandle: n2.userHandle ? Cu(n2.userHandle) : void 0 }, clientExtensionResults: e3.getClientExtensionResults() };
}
ku = /* @__PURE__ */ new WeakMap(), Su = /* @__PURE__ */ new WeakMap(), Tu = /* @__PURE__ */ new WeakMap();
function Ou(e3) {
  return { get() {
    try {
      const t2 = window.localStorage.getItem(e3);
      return t2 ? JSON.parse(t2) : null;
    } catch (e4) {
      return null;
    }
  }, set(t2) {
    try {
      window.localStorage.setItem(e3, JSON.stringify(t2));
    } catch (e4) {
    }
  }, remove() {
    try {
      window.localStorage.removeItem(e3);
    } catch (e4) {
    }
  } };
}
function ju() {
  let e3 = null;
  return { get: () => e3, set: (t2) => {
    e3 = t2;
  }, remove: () => {
    e3 = null;
  } };
}
var Wu = class {
  constructor(e3, t2) {
    this.slots = /* @__PURE__ */ new Map(), this.baseKey = "".concat("@@auth0spajs@@", "::").concat(e3, "::anonymous");
    try {
      this.useLocalStorage = "localStorage" === t2 && "undefined" != typeof window && !!window.localStorage;
    } catch (e4) {
      this.useLocalStorage = false;
    }
    this.sessionKey = "".concat(this.baseKey, "::").concat("session"), this.sessionStore = this.useLocalStorage ? Ou(this.sessionKey) : ju();
    const n2 = "".concat(this.baseKey, "::").concat("session_expired");
    this.expiredStore = this.useLocalStorage ? Ou(n2) : ju();
  }
  getStore(e3, t2) {
    const n2 = "".concat(this.baseKey, "::").concat(JSON.stringify([null != e3 ? e3 : "", null != t2 ? t2 : ""]));
    return this.slots.has(n2) || this.slots.set(n2, this.useLocalStorage ? Ou(n2) : ju()), this.slots.get(n2);
  }
  getSessionToken() {
    return this.sessionStore.get();
  }
  setSessionToken(e3) {
    this.sessionStore.set(e3), this.expiredStore.remove();
  }
  isSessionExpired() {
    return !!this.expiredStore.get();
  }
  markSessionExpired() {
    this.expiredStore.set(true);
  }
  removeAll() {
    if (this.sessionStore.remove(), this.expiredStore.remove(), this.slots.forEach((e3) => e3.remove()), this.slots.clear(), this.useLocalStorage) try {
      const e3 = this.baseKey + "::", t2 = [];
      for (let n2 = 0; n2 < window.localStorage.length; n2++) {
        const o2 = window.localStorage.key(n2);
        (null == o2 ? void 0 : o2.startsWith(e3)) && t2.push(o2);
      }
      t2.forEach((e4) => window.localStorage.removeItem(e4));
    } catch (e3) {
    }
  }
};
var Nu = class {
  constructor(e3, t2) {
    let n2 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : "localStorage", o2 = arguments.length > 3 ? arguments[3] : void 0;
    this.authJsClient = e3, this.clientId = t2, this.cache = new Wu(t2, n2), this.lockManager = null != o2 ? o2 : me();
  }
  async createSession(e3) {
    const t2 = await this.authJsClient.createSession(e3);
    return this.cache.setSessionToken(Object.assign({ sessionToken: t2.sessionToken }, void 0 !== t2.sessionTokenExpiresAt && { sessionTokenExpiresAt: t2.sessionTokenExpiresAt })), this.cache.getStore(null == e3 ? void 0 : e3.audience, null == e3 ? void 0 : e3.scope).set(Object.assign({ accessToken: t2.accessToken, expiresAt: t2.expiresAt }, void 0 !== t2.scope && { scope: t2.scope })), t2;
  }
  async getTokenSilently(e3) {
    const t2 = this.cache.getStore(null == e3 ? void 0 : e3.audience, null == e3 ? void 0 : e3.scope), n2 = t2.get();
    return n2 && n2.expiresAt - 60 > Date.now() / 1e3 ? n2 : this.lockManager.runWithLock("anonymous::".concat(this.clientId), 5e3, async () => {
      var n3;
      if (this.cache.isSessionExpired()) throw new Nc("session_expired", "The anonymous session has expired. Call createSession() to start a new one.");
      const o2 = t2.get();
      if (o2 && o2.expiresAt - 60 > Date.now() / 1e3) return o2;
      const i2 = null === (n3 = this.cache.getSessionToken()) || void 0 === n3 ? void 0 : n3.sessionToken;
      let r2;
      try {
        r2 = await this.authJsClient.getAccessToken(Object.assign(Object.assign({}, e3), { sessionToken: i2 }));
      } catch (e4) {
        throw e4 instanceof Nc && ("session_expired" === e4.code || "invalid_session_token" === e4.code) && (this.cache.removeAll(), this.cache.markSessionExpired()), e4;
      }
      return this.cache.getStore(null == e3 ? void 0 : e3.audience, null == e3 ? void 0 : e3.scope).set(Object.assign({ accessToken: r2.accessToken, expiresAt: r2.expiresAt }, void 0 !== r2.scope && { scope: r2.scope })), this.cache.getSessionToken() || this.cache.setSessionToken(Object.assign({ sessionToken: r2.sessionToken }, void 0 !== r2.sessionTokenExpiresAt && { sessionTokenExpiresAt: r2.sessionTokenExpiresAt })), Object.assign({ accessToken: r2.accessToken, expiresAt: r2.expiresAt }, void 0 !== r2.scope && { scope: r2.scope });
    });
  }
  async mintTransferToken() {
    const e3 = this.cache.getSessionToken();
    return (null == e3 ? void 0 : e3.sessionToken) ? this.authJsClient.mintTransferToken(e3.sessionToken) : null;
  }
  async logout() {
    await this.authJsClient.logout(), this.cache.removeAll();
  }
  hasSession() {
    var e3;
    return !!(null === (e3 = this.cache.getSessionToken()) || void 0 === e3 ? void 0 : e3.sessionToken);
  }
  getClaims() {
    return null;
  }
};
var Mu = class {
  resolveOnlineAccess(e3) {
    if ("online" !== e3.refreshTokenMode) return false;
    if (true !== e3.useRefreshTokens) throw new R('`refreshTokenMode: "online"` requires the refresh-token grant.', "Set `useRefreshTokens: true`.");
    if (true !== e3.useDpop) throw new R('`refreshTokenMode: "online"` requires DPoP, which is missing or disabled.', "Set `useDpop: true` (DPoP is mandatory for online access).");
    return true;
  }
  warnEnterpriseConnectConfig(e3) {
    var t2, n2;
    if (true !== e3.enterpriseConnect) return;
    const o2 = null === (t2 = e3.authorizationParams) || void 0 === t2 ? void 0 : t2.scope;
    (true === e3.useRefreshTokens || "string" == typeof o2 && o2.includes("offline_access")) && console.warn("Enterprise Connect issues no refresh token; `useRefreshTokens` and `offline_access` in `scope` have no effect."), (null === (n2 = e3.authorizationParams) || void 0 === n2 ? void 0 : n2.organization) && console.warn("Enterprise Connect resolves the organization from the email domain (Home Realm Discovery); a static `organization` breaks multi-customer setups.");
  }
  constructor(e3) {
    let t2, n2;
    if (this.userCache = new Xe().enclosedCache, this.defaultOptions = { authorizationParams: { scope: "openid profile email" }, useRefreshTokensFallback: false, useFormData: true, refreshTokenMode: "offline", anonymousSessionsCacheMode: "localStorage" }, this.onlineAccess = this.resolveOnlineAccess(e3), this.warnEnterpriseConnectConfig(e3), this.options = Object.assign(Object.assign(Object.assign({}, this.defaultOptions), e3), { authorizationParams: Object.assign(Object.assign({}, this.defaultOptions.authorizationParams), e3.authorizationParams) }), "undefined" != typeof window && (() => {
      if (!J()) throw new Error("For security reasons, `window.crypto` is required to run `auth0-spa-js`.");
      if (void 0 === J().subtle) throw new Error("\n      auth0-spa-js must run on a secure origin. See https://github.com/auth0/auth0-spa-js/blob/main/FAQ.md#why-do-i-get-auth0-spa-js-must-run-on-a-secure-origin for more information.\n    ");
    })(), this.lockManager = me(), e3.cache && e3.cacheLocation && console.warn("Both `cache` and `cacheLocation` options have been specified in the Auth0Client configuration; ignoring `cacheLocation` and using `cache`."), e3.cache) n2 = e3.cache;
    else {
      if (t2 = e3.cacheLocation || _, !St(t2)) throw new Error('Invalid cache location "'.concat(t2, '"'));
      n2 = St(t2)();
    }
    var o2;
    this.httpTimeoutMs = e3.httpTimeoutInSeconds ? 1e3 * e3.httpTimeoutInSeconds : b, this.cookieStorage = false === e3.legacySameSiteCookie ? at : ut, this.orgHintCookieName = (o2 = this.options.clientId, "auth0.".concat(o2, ".organization_hint")), this.isAuthenticatedCookieName = ((e4) => "auth0.".concat(e4, ".is.authenticated"))(this.options.clientId), this.sessionCheckExpiryDays = e3.sessionCheckExpiryDays || 1;
    const i2 = e3.useCookiesForTransactions ? this.cookieStorage : lt;
    let r2 = "";
    var s2;
    this.onlineAccess ? r2 = S : this.options.useRefreshTokens && (r2 = "offline_access"), this.scope = (function(e4, t3) {
      for (var n3 = arguments.length, o3 = new Array(n3 > 2 ? n3 - 2 : 0), i3 = 2; i3 < n3; i3++) o3[i3 - 2] = arguments[i3];
      if ("object" != typeof e4) return { [C]: Je(t3, e4, ...o3) };
      let r3 = { [C]: Je(t3, ...o3) };
      return Object.keys(e4).forEach((n4) => {
        const i4 = e4[n4];
        r3[n4] = Je(t3, i4, ...o3);
      }), r3;
    })(this.options.authorizationParams.scope, "openid", r2), this.transactionManager = new qe(i2, this.options.clientId, this.options.cookieDomain), this.nowProvider = this.options.nowProvider || P, this.cacheManager = new Ge(n2, n2.allKeys ? void 0 : new bt(n2, this.options.clientId), this.nowProvider), this.dpop = this.options.useDpop ? new Rt(this.options.clientId) : void 0, this.domainUrl = (s2 = this.options.domain, /^https?:\/\//.test(s2) ? s2 : "https://".concat(s2)), this.tokenIssuer = ((e4, t3) => e4 ? e4.startsWith("https://") ? e4 : "https://".concat(e4, "/") : "".concat(t3, "/"))(this.options.issuer, this.domainUrl);
    const a2 = "".concat(this.domainUrl, "/me/"), c2 = this.createFetcher(Object.assign(Object.assign({}, this.options.useDpop && { dpopNonceId: "__auth0_my_account_api__" }), { getAccessToken: (e4) => {
      var t3;
      return this.getTokenSilently({ authorizationParams: { scope: null === (t3 = null == e4 ? void 0 : e4.scope) || void 0 === t3 ? void 0 : t3.join(" "), audience: a2 }, detailedResponse: true });
    } }));
    this.myAccount = new It(c2, a2), this.authJsClient = new $c({ domain: this.options.domain, clientId: this.options.clientId }), this.mfa = new bu(this.authJsClient.mfa, this), this.anonymous = new Nu(this.authJsClient.anonymous, this.options.clientId, this.options.anonymousSessionsCacheMode, this.lockManager), this.passkey = new Pu(this.authJsClient.passkey, this), "undefined" != typeof window && window.Worker && this.options.useRefreshTokens && t2 === _ && (this.options.workerUrl ? this.worker = new Worker(this.options.workerUrl) : this.worker = new vt(), this.worker.postMessage({ type: "init", allowedBaseUrl: this.domainUrl }));
  }
  getConfiguration() {
    return Object.freeze({ domain: this.options.domain, clientId: this.options.clientId });
  }
  _url(e3) {
    const t2 = this.options.auth0Client || T, n2 = F(t2, true), o2 = encodeURIComponent(btoa(JSON.stringify(n2)));
    return "".concat(this.domainUrl).concat(e3, "&auth0Client=").concat(o2);
  }
  _authorizeUrl(e3) {
    return this._url("/authorize?".concat(V(e3)));
  }
  async _verifyIdToken(e3, t2, n2, o2) {
    const i2 = await this.nowProvider();
    return Qe({ iss: this.tokenIssuer, aud: this.options.clientId, id_token: e3, nonce: t2, organization: n2, leeway: this.options.leeway, max_age: Y(null != o2 ? o2 : this.options.authorizationParams.max_age), now: i2 });
  }
  _processOrgHint(e3) {
    e3 ? this.cookieStorage.save(this.orgHintCookieName, e3, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }) : this.cookieStorage.remove(this.orgHintCookieName, { cookieDomain: this.options.cookieDomain });
  }
  _extractSessionTransferToken(e3) {
    return new URLSearchParams(window.location.search).get(e3) || void 0;
  }
  _clearSessionTransferTokenFromUrl(e3) {
    try {
      const t2 = new URL(window.location.href);
      t2.searchParams.has(e3) && (t2.searchParams.delete(e3), window.history.replaceState({}, "", t2.toString()));
    } catch (e4) {
    }
  }
  _applySessionTransferToken(e3) {
    const t2 = this.options.sessionTransferTokenQueryParamName;
    if (!t2 || e3.session_transfer_token) return e3;
    const n2 = this._extractSessionTransferToken(t2);
    return n2 ? (this._clearSessionTransferTokenFromUrl(t2), Object.assign(Object.assign({}, e3), { session_transfer_token: n2 })) : e3;
  }
  async _applyAnonTransferToken(e3) {
    const t2 = await this.anonymous.mintTransferToken();
    return t2 ? Object.assign(Object.assign({}, e3), { anon_transfer_token: t2 }) : e3;
  }
  async _prepareAuthorizeUrl(e3, t2, n2) {
    var o2;
    const i2 = H(D()), r2 = H(D()), s2 = D(), a2 = await X(s2), c2 = q(a2), u2 = await (null === (o2 = this.dpop) || void 0 === o2 ? void 0 : o2.calculateThumbprint()), l2 = ((e4, t3, n3, o3, i3, r3, s3, a3, c3) => Object.assign(Object.assign(Object.assign({ client_id: e4.clientId }, e4.authorizationParams), n3), { scope: De(t3, n3.scope, n3.audience), response_type: "code", response_mode: a3 || "query", state: o3, nonce: i3, redirect_uri: s3 || e4.authorizationParams.redirect_uri, code_challenge: r3, code_challenge_method: "S256", dpop_jkt: c3 }))(this.options, this.scope, e3, i2, r2, c2, e3.redirect_uri || this.options.authorizationParams.redirect_uri || n2, null == t2 ? void 0 : t2.response_mode, u2), d2 = this._authorizeUrl(l2);
    return { nonce: r2, code_verifier: s2, scope: l2.scope, audience: l2.audience || C, redirect_uri: l2.redirect_uri, state: i2, url: d2, max_age: l2.max_age };
  }
  async loginWithPopup(e3, t2) {
    var n2;
    if (e3 = e3 || {}, !(t2 = t2 || {}).popup && (t2.popup = ((e4) => {
      const t3 = window.screenX + (window.innerWidth - 400) / 2, n3 = window.screenY + (window.innerHeight - 600) / 2;
      return window.open(e4, "auth0:authorize:popup", "left=".concat(t3, ",top=").concat(n3, ",width=").concat(400, ",height=").concat(600, ",resizable,scrollbars=yes,status=1"));
    })(""), !t2.popup)) throw new W();
    const o2 = await this._applyAnonTransferToken(this._applySessionTransferToken(e3.authorizationParams || {})), i2 = await this._prepareAuthorizeUrl(o2, { response_mode: "web_message" }, window.location.origin);
    t2.popup.location.href = i2.url;
    const r2 = await ((e4, t3) => new Promise((n3, o3) => {
      let i3;
      const r3 = setInterval(() => {
        e4.popup && e4.popup.closed && (clearInterval(r3), clearTimeout(s3), window.removeEventListener("message", i3, false), o3(new j(e4.popup)));
      }, 1e3), s3 = setTimeout(() => {
        clearInterval(r3), o3(new O(e4.popup)), window.removeEventListener("message", i3, false);
      }, 1e3 * (e4.timeoutInSeconds || 60));
      i3 = function(a2) {
        if (a2.origin === t3 && a2.data && "authorization_response" === a2.data.type) {
          if (clearTimeout(s3), clearInterval(r3), window.removeEventListener("message", i3, false), false !== e4.closePopup && e4.popup.close(), a2.data.response.error) return o3(E.fromPayload(a2.data.response));
          n3(a2.data.response);
        }
      }, window.addEventListener("message", i3);
    }))(Object.assign(Object.assign({}, t2), { timeoutInSeconds: t2.timeoutInSeconds || this.options.authorizeTimeoutInSeconds || 60 }), new URL(i2.url).origin);
    if (i2.state !== r2.state) throw new E("state_mismatch", "Invalid state");
    const s2 = (null === (n2 = e3.authorizationParams) || void 0 === n2 ? void 0 : n2.organization) || this.options.authorizationParams.organization;
    await this._requestToken({ audience: i2.audience, scope: i2.scope, code_verifier: i2.code_verifier, grant_type: "authorization_code", code: r2.code, redirect_uri: i2.redirect_uri }, { nonceIn: i2.nonce, organization: s2, max_age: i2.max_age });
  }
  async getUser() {
    var e3;
    if (await this._isSessionCeilingReached()) return;
    const t2 = await this._getIdTokenFromCache();
    return null === (e3 = null == t2 ? void 0 : t2.decodedToken) || void 0 === e3 ? void 0 : e3.user;
  }
  async getIdTokenClaims() {
    var e3;
    if (await this._isSessionCeilingReached()) return;
    const t2 = await this._getIdTokenFromCache();
    return null === (e3 = null == t2 ? void 0 : t2.decodedToken) || void 0 === e3 ? void 0 : e3.claims;
  }
  async loginWithRedirect() {
    var t2;
    const n2 = Tt(arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}), o2 = n2.openUrl, i2 = n2.fragment, r2 = n2.appState, s2 = e(n2, ["openUrl", "fragment", "appState"]), a2 = (null === (t2 = s2.authorizationParams) || void 0 === t2 ? void 0 : t2.organization) || this.options.authorizationParams.organization, c2 = await this._applyAnonTransferToken(this._applySessionTransferToken(s2.authorizationParams || {})), u2 = await this._prepareAuthorizeUrl(c2), l2 = u2.url, d2 = e(u2, ["url"]);
    this.transactionManager.create(Object.assign(Object.assign(Object.assign({}, d2), { appState: r2, response_type: ht.Code }), a2 && { organization: a2 }));
    const h2 = i2 ? "".concat(l2, "#").concat(i2) : l2;
    o2 ? await o2(h2) : window.location.assign(h2);
  }
  async handleRedirectCallback() {
    const e3 = (arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : window.location.href).split("?").slice(1);
    if (0 === e3.length) throw new Error("There are no query params available for parsing.");
    const t2 = this.transactionManager.get();
    if (!t2) throw new E("missing_transaction", "Invalid state");
    this.transactionManager.remove();
    const n2 = ((e4) => {
      e4.indexOf("#") > -1 && (e4 = e4.substring(0, e4.indexOf("#")));
      const t3 = new URLSearchParams(e4);
      return { state: t3.get("state"), code: t3.get("code") || void 0, connect_code: t3.get("connect_code") || void 0, error: t3.get("error") || void 0, error_description: t3.get("error_description") || void 0 };
    })(e3.join(""));
    return t2.response_type === ht.ConnectCode ? this._handleConnectAccountRedirectCallback(n2, t2) : this._handleLoginRedirectCallback(n2, t2);
  }
  async _handleLoginRedirectCallback(e3, t2) {
    const n2 = e3.code, o2 = e3.state, i2 = e3.error, r2 = e3.error_description;
    if (i2) throw new A(i2, r2 || i2, o2, t2.appState);
    if (!t2.code_verifier || t2.state && t2.state !== o2) throw new E("state_mismatch", "Invalid state");
    const s2 = t2.organization, a2 = t2.nonce, c2 = t2.redirect_uri;
    return await this._requestToken(Object.assign({ audience: t2.audience, scope: t2.scope, code_verifier: t2.code_verifier, grant_type: "authorization_code", code: n2 }, c2 ? { redirect_uri: c2 } : {}), { nonceIn: a2, organization: s2, max_age: t2.max_age }), { appState: t2.appState, response_type: ht.Code };
  }
  async _handleConnectAccountRedirectCallback(e3, t2) {
    const n2 = e3.connect_code, o2 = e3.state, i2 = e3.error, r2 = e3.error_description;
    if (i2) throw new x(i2, r2 || i2, t2.connection, o2, t2.appState);
    if (!n2) throw new E("missing_connect_code", "Missing connect code");
    if (!(t2.code_verifier && t2.state && t2.auth_session && t2.redirect_uri && t2.state === o2)) throw new E("state_mismatch", "Invalid state");
    const s2 = await this.myAccount.completeAccount({ auth_session: t2.auth_session, connect_code: n2, redirect_uri: t2.redirect_uri, code_verifier: t2.code_verifier });
    return Object.assign(Object.assign({}, s2), { appState: t2.appState, response_type: ht.ConnectCode });
  }
  async _maybeCreateAnonymousSession() {
    if (this.options.createAnonymousSessionOnFailedSilentAuth) {
      if (this.anonymous.hasSession()) return;
      try {
        await this.anonymous.getTokenSilently();
      } catch (e3) {
        console.debug("[auth0-spa-js] Anonymous session creation failed", e3);
      }
    }
  }
  async checkSession(e3) {
    if (!this.cookieStorage.get(this.isAuthenticatedCookieName)) {
      if (!this.cookieStorage.get(_t)) return void await this._maybeCreateAnonymousSession();
      this.cookieStorage.save(this.isAuthenticatedCookieName, true, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }), this.cookieStorage.remove(_t);
    }
    try {
      await this.getTokenSilently(e3);
    } catch (e4) {
      e4 instanceof E && "login_required" === e4.error && e4.error_description !== k && await this._maybeCreateAnonymousSession();
    }
  }
  async getTokenSilently() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    var t2, n2;
    const o2 = Object.assign(Object.assign({ cacheMode: "on" }, e3), { authorizationParams: Object.assign(Object.assign(Object.assign({}, this.options.authorizationParams), e3.authorizationParams), { scope: De(this.scope, null === (t2 = e3.authorizationParams) || void 0 === t2 ? void 0 : t2.scope, (null === (n2 = e3.authorizationParams) || void 0 === n2 ? void 0 : n2.audience) || this.options.authorizationParams.audience) }) }), i2 = await ((e4, t3) => {
      let n3 = ye[t3];
      return n3 || (n3 = e4().finally(() => {
        delete ye[t3], n3 = null;
      }), ye[t3] = n3), n3;
    })(() => this._getTokenSilently(o2), "".concat(this.options.clientId, "::").concat(o2.authorizationParams.audience, "::").concat(o2.authorizationParams.scope, "::").concat(o2.cacheMode));
    return e3.detailedResponse ? i2 : null == i2 ? void 0 : i2.access_token;
  }
  async _getTokenSilently(t2) {
    const n2 = t2.cacheMode, o2 = e(t2, ["cacheMode"]);
    if (await this._isSessionCeilingReached()) return;
    if ("off" !== n2) {
      const e3 = await this._getEntryFromCache({ scope: o2.authorizationParams.scope, audience: o2.authorizationParams.audience || C, clientId: this.options.clientId, cacheMode: n2 });
      if (e3) return e3;
    }
    if ("cache-only" === n2) return;
    const i2 = (r2 = this.options.clientId, s2 = o2.authorizationParams.audience || "default", "".concat("auth0.lock.getTokenSilently", ".").concat(r2, ".").concat(s2));
    var r2, s2;
    try {
      return await this.lockManager.runWithLock(i2, 5e3, async () => {
        if ("off" !== n2) {
          const e4 = await this._getEntryFromCache({ scope: o2.authorizationParams.scope, audience: o2.authorizationParams.audience || C, clientId: this.options.clientId });
          if (e4) return e4;
        }
        const e3 = this.options.useRefreshTokens ? await this._getTokenUsingRefreshToken(o2) : await this._getTokenFromIFrame(o2), t3 = e3.id_token, i3 = e3.token_type, r3 = e3.access_token, s3 = e3.oauthTokenScope, a2 = e3.expires_in;
        return Object.assign(Object.assign({ id_token: t3, token_type: i3, access_token: r3 }, s3 ? { scope: s3 } : null), { expires_in: a2 });
      });
    } catch (e3) {
      if (this._isInteractiveError(e3) && "popup" === this.options.interactiveErrorHandler) return await this._handleInteractiveErrorWithPopup(o2);
      throw e3;
    }
  }
  _isInteractiveError(e3) {
    return e3 instanceof N || e3 instanceof E && this._isIframeMfaError(e3);
  }
  _isIframeMfaError(e3) {
    return "login_required" === e3.error && e3.error_description === k;
  }
  async _handleInteractiveErrorWithPopup(e3) {
    try {
      await this.loginWithPopup({ authorizationParams: e3.authorizationParams });
      const t2 = await this._getEntryFromCache({ scope: e3.authorizationParams.scope, audience: e3.authorizationParams.audience || C, clientId: this.options.clientId });
      if (!t2) throw new E("interactive_handler_cache_miss", "Token not found in cache after interactive authentication");
      return t2;
    } catch (e4) {
      throw e4;
    }
  }
  async getTokenWithPopup() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {}, t2 = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
    var n2, o2;
    const i2 = Object.assign(Object.assign({}, e3), { authorizationParams: Object.assign(Object.assign(Object.assign({}, this.options.authorizationParams), e3.authorizationParams), { scope: De(this.scope, null === (n2 = e3.authorizationParams) || void 0 === n2 ? void 0 : n2.scope, (null === (o2 = e3.authorizationParams) || void 0 === o2 ? void 0 : o2.audience) || this.options.authorizationParams.audience) }) });
    t2 = Object.assign(Object.assign({}, v), t2), await this.loginWithPopup(i2, t2);
    return (await this.cacheManager.get(new Fe({ scope: i2.authorizationParams.scope, audience: i2.authorizationParams.audience || C, clientId: this.options.clientId }), void 0, this.options.useMrrt)).access_token;
  }
  async isAuthenticated() {
    return !!await this.getUser();
  }
  _buildLogoutUrl(t2) {
    null !== t2.clientId ? t2.clientId = t2.clientId || this.options.clientId : delete t2.clientId;
    const n2 = t2.logoutParams || {}, o2 = n2.federated, i2 = e(n2, ["federated"]), r2 = o2 ? "&federated" : "";
    return this._url("/v2/logout?".concat(V(Object.assign({ clientId: t2.clientId }, i2)))) + r2;
  }
  async revokeRefreshToken() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    if (!this.options.useRefreshTokens) return;
    const t2 = e3.audience || this.options.authorizationParams.audience || C, n2 = await this.cacheManager.getRefreshTokensByAudience(t2, this.options.clientId);
    await (async function(e4, t3) {
      let n3 = e4.baseUrl, o2 = e4.timeout, i2 = e4.auth0Client, r2 = e4.useFormData, s2 = e4.refreshTokens, a2 = e4.audience, c2 = e4.client_id, u2 = e4.onRefreshTokenRevoked;
      const l2 = o2 || b, d2 = "refresh_token", h2 = "".concat(n3, "/oauth/revoke"), p2 = { "Content-Type": r2 ? "application/x-www-form-urlencoded" : "application/json", "Auth0-Client": btoa(JSON.stringify(F(i2 || T))) };
      if (t3) {
        const e5 = { client_id: c2, token_type_hint: d2 }, n4 = r2 ? V(e5) : JSON.stringify(e5);
        try {
          return await Me({ type: "revoke", timeout: l2, fetchUrl: h2, fetchOptions: { method: "POST", body: n4, headers: p2 }, useFormData: r2, auth: { audience: null != a2 ? a2 : C } }, t3);
        } catch (e6) {
          throw new E("revoke_error", e6.message);
        }
      }
      for (const e5 of s2) {
        const t4 = { client_id: c2, token_type_hint: d2, token: e5 }, n4 = r2 ? V(t4) : JSON.stringify(t4), o3 = await Ue(h2, { method: "POST", body: n4, headers: p2 }, l2);
        if (!o3.ok) {
          let e6, t5;
          try {
            var f2 = JSON.parse(await o3.text());
            e6 = f2.error, t5 = f2.error_description;
          } catch (e7) {
          }
          throw new E(e6 || "revoke_error", t5 || "HTTP error ".concat(o3.status));
        }
        await (null == u2 ? void 0 : u2(e5));
      }
    })({ baseUrl: this.domainUrl, timeout: this.httpTimeoutMs, auth0Client: this.options.auth0Client, useFormData: this.options.useFormData, client_id: this.options.clientId, refreshTokens: n2, audience: t2, onRefreshTokenRevoked: (e4) => this.cacheManager.stripRefreshToken(e4) }, this.worker), this.onlineAccess && await this._clearLocalSession();
  }
  async logout() {
    let t2 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    var n2;
    this.options.enterpriseConnect && true !== (null === (n2 = t2.logoutParams) || void 0 === n2 ? void 0 : n2.federated) && console.warn("Enterprise Connect logout without `federated: true` leaves the enterprise IdP session alive; the next login may silently reuse the previous user.");
    const o2 = Tt(t2), i2 = o2.openUrl, r2 = e(o2, ["openUrl"]);
    await this._clearLocalSession(t2.clientId);
    const s2 = this._buildLogoutUrl(r2);
    i2 ? await i2(s2) : false !== i2 && window.location.assign(s2);
  }
  async _getTokenFromIFrame(e3) {
    const t2 = (n2 = this.options.clientId, "".concat("auth0.lock.getTokenFromIFrame", ".").concat(n2));
    var n2;
    try {
      return await this.lockManager.runWithLock(t2, 5e3, async () => {
        const t3 = Object.assign(Object.assign({}, e3.authorizationParams), { prompt: "none" }), n3 = this.cookieStorage.get(this.orgHintCookieName);
        n3 && !t3.organization && (t3.organization = n3);
        const o2 = await this._prepareAuthorizeUrl(t3, { response_mode: "web_message" }, window.location.origin), i2 = o2.url, r2 = o2.state, s2 = o2.nonce, a2 = o2.code_verifier, c2 = o2.redirect_uri, u2 = o2.scope, l2 = o2.audience, d2 = o2.max_age;
        if (window.crossOriginIsolated) throw new E("login_required", "The application is running in a Cross-Origin Isolated context, silently retrieving a token without refresh token is not possible.");
        const h2 = e3.timeoutInSeconds || this.options.authorizeTimeoutInSeconds;
        let p2;
        try {
          p2 = new URL(this.domainUrl).origin;
        } catch (e4) {
          p2 = this.domainUrl;
        }
        const f2 = await (function(e4, t4) {
          let n4 = arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : 60;
          return new Promise((o3, i3) => {
            const r3 = window.document.createElement("iframe");
            r3.setAttribute("width", "0"), r3.setAttribute("height", "0"), r3.style.display = "none";
            const s3 = () => {
              window.document.body.contains(r3) && (window.document.body.removeChild(r3), window.removeEventListener("message", a3, false));
            };
            let a3;
            const c3 = setTimeout(() => {
              i3(new I()), s3();
            }, 1e3 * n4);
            a3 = function(e5) {
              if (e5.origin != t4) return;
              if (!e5.data || "authorization_response" !== e5.data.type) return;
              const n5 = e5.source;
              n5 && n5.close(), e5.data.response.error ? i3(E.fromPayload(e5.data.response)) : o3(e5.data.response), clearTimeout(c3), window.removeEventListener("message", a3, false), setTimeout(s3, 2e3);
            }, window.addEventListener("message", a3, false), window.document.body.appendChild(r3), r3.setAttribute("src", e4);
          });
        })(i2, p2, h2);
        if (r2 !== f2.state) throw new E("state_mismatch", "Invalid state");
        const m2 = await this._requestToken(Object.assign(Object.assign({}, e3.authorizationParams), { code_verifier: a2, code: f2.code, grant_type: "authorization_code", redirect_uri: c2, timeout: e3.authorizationParams.timeout || this.httpTimeoutMs }), { nonceIn: s2, organization: t3.organization, max_age: d2 });
        return Object.assign(Object.assign({}, m2), { scope: u2, oauthTokenScope: m2.scope, audience: l2 });
      });
    } catch (e4) {
      if ("login_required" === e4.error) {
        e4 instanceof E && this._isIframeMfaError(e4) && "popup" === this.options.interactiveErrorHandler || this.logout({ openUrl: false });
      }
      throw e4;
    }
  }
  async _getTokenUsingRefreshToken(e3) {
    const t2 = await this.cacheManager.get(new Fe({ scope: e3.authorizationParams.scope, audience: e3.authorizationParams.audience || C, clientId: this.options.clientId }), void 0, this.options.useMrrt);
    if (!(t2 && t2.refresh_token || this.worker)) {
      if (this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e3);
      throw new U(e3.authorizationParams.audience || C, e3.authorizationParams.scope);
    }
    const n2 = e3.authorizationParams.redirect_uri || this.options.authorizationParams.redirect_uri || window.location.origin, o2 = "number" == typeof e3.timeoutInSeconds ? 1e3 * e3.timeoutInSeconds : null, i2 = ((e4, t3, n3, o3) => {
      var i3;
      if (e4 && n3 && o3) {
        if (t3.audience !== n3) return t3.scope;
        const e5 = o3.split(" "), r3 = (null === (i3 = t3.scope) || void 0 === i3 ? void 0 : i3.split(" ")) || [], s3 = r3.every((t4) => e5.includes(t4));
        return e5.length >= r3.length && s3 ? o3 : t3.scope;
      }
      return t3.scope;
    })(this.options.useMrrt, e3.authorizationParams, null == t2 ? void 0 : t2.audience, null == t2 ? void 0 : t2.scope);
    try {
      const u2 = await this._requestToken(Object.assign(Object.assign(Object.assign({}, e3.authorizationParams), { grant_type: "refresh_token", refresh_token: t2 && t2.refresh_token, redirect_uri: n2 }), o2 && { timeout: o2 }), { scopesToRequest: i2 });
      if (await this._propagateRotatedRefreshToken(null == t2 ? void 0 : t2.refresh_token, u2.refresh_token), this.options.useMrrt) {
        if (r2 = null == t2 ? void 0 : t2.audience, s2 = null == t2 ? void 0 : t2.scope, a2 = e3.authorizationParams.audience, c2 = e3.authorizationParams.scope, r2 !== a2 || !((e4, t3) => {
          const n3 = (null == t3 ? void 0 : t3.split(" ")) || [];
          return ((null == e4 ? void 0 : e4.split(" ")) || []).every((e5) => n3.includes(e5));
        })(c2, s2)) {
          const t3 = Pt(i2, u2.scope, this.onlineAccess);
          if (t3) {
            if (this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e3);
            throw await this.cacheManager.remove(this.options.clientId, e3.authorizationParams.audience || C, e3.authorizationParams.scope), new L(e3.authorizationParams.audience || "default", t3);
          }
        }
      }
      return Object.assign(Object.assign({}, u2), { scope: e3.authorizationParams.scope, oauthTokenScope: u2.scope, audience: e3.authorizationParams.audience || C });
    } catch (t3) {
      if (t3.message) {
        if (t3.message.includes("user is blocked")) throw await this.logout({ openUrl: false }), t3;
        if ((t3.message.includes("Missing Refresh Token") || t3.message.includes("invalid refresh token")) && this.options.useRefreshTokensFallback) return await this._getTokenFromIFrame(e3);
      }
      throw t3;
    }
    var r2, s2, a2, c2;
  }
  async _propagateRotatedRefreshToken(e3, t2) {
    !this.onlineAccess && t2 && e3 && await this.cacheManager.updateEntry(e3, t2, this.options.clientId, this.options.useMrrt);
  }
  async _saveEntryInCache(t2) {
    const n2 = t2.decodedToken.claims, o2 = n2.session_expiry, i2 = n2.iat;
    if (void 0 !== o2) {
      if ("number" != typeof o2) throw new E("invalid_token", "Invalid session_expiry: value must be a number.");
      if (o2 >= 1e10) throw new E("invalid_token", "Invalid session_expiry: value appears to be in milliseconds; expected a Unix timestamp in seconds.");
      if (void 0 === i2 || o2 <= i2) throw new E("invalid_token", "Invalid session_expiry: session ceiling is before or at the token issue time.");
    }
    const r2 = t2.id_token, s2 = t2.decodedToken, a2 = e(t2, ["id_token", "decodedToken"]);
    this.userCache.set(Ze, { id_token: r2, decodedToken: s2 }), await this.cacheManager.setIdToken(this.options.clientId, t2.id_token, t2.decodedToken), await this.cacheManager.set(a2);
  }
  async _clearLocalSession() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : this.options.clientId;
    var t2;
    null === e3 ? await this.cacheManager.clear() : await this.cacheManager.clear(e3), this.cookieStorage.remove(this.orgHintCookieName, { cookieDomain: this.options.cookieDomain }), this.cookieStorage.remove(this.isAuthenticatedCookieName, { cookieDomain: this.options.cookieDomain }), this.userCache.remove(Ze);
    try {
      await (null === (t2 = this.dpop) || void 0 === t2 ? void 0 : t2.clear());
    } catch (e4) {
    }
    if (this.worker) try {
      await Me({ type: "clear" }, this.worker);
    } catch (e4) {
    }
  }
  async _isSessionCeilingReached() {
    var e3, t2;
    const n2 = this.userCache.get(Ze), o2 = null != n2 ? n2 : await this.cacheManager.getIdToken(new Fe({ clientId: this.options.clientId })), i2 = null === (t2 = null === (e3 = null == o2 ? void 0 : o2.decodedToken) || void 0 === e3 ? void 0 : e3.claims) || void 0 === t2 ? void 0 : t2.session_expiry;
    if (void 0 === i2) return false;
    const r2 = await this.nowProvider();
    return Math.floor(r2 / 1e3) >= i2 - 30 && (await this._clearLocalSession(), true);
  }
  async _getIdTokenFromCache() {
    const e3 = this.options.authorizationParams.audience || C, t2 = this.scope[e3], n2 = await this.cacheManager.getIdToken(new Fe({ clientId: this.options.clientId, audience: e3, scope: t2 })), o2 = this.userCache.get(Ze);
    return n2 && n2.id_token === (null == o2 ? void 0 : o2.id_token) ? o2 : (this.userCache.set(Ze, n2), n2);
  }
  async _getEntryFromCache(e3) {
    let t2 = e3.scope, n2 = e3.audience, o2 = e3.clientId, i2 = e3.cacheMode;
    const r2 = await this.cacheManager.get(new Fe({ scope: t2, audience: n2, clientId: o2 }), 60, this.options.useMrrt, i2);
    if (r2 && r2.access_token) {
      const e4 = r2.token_type, t3 = r2.access_token, n3 = r2.oauthTokenScope, o3 = r2.expires_in, i3 = await this._getIdTokenFromCache();
      return i3 && Object.assign(Object.assign({ id_token: i3.id_token, token_type: e4 || "Bearer", access_token: t3 }, n3 ? { scope: n3 } : null), { expires_in: o3 });
    }
  }
  _storeMfaContext(e3, t2, n2) {
    e3 instanceof N && this.mfa.setMFAAuthDetails(e3.mfa_token, t2, n2, e3.mfa_requirements);
  }
  async _requestToken(e3, t2) {
    var n2, o2, i2, r2, s2, a2;
    const c2 = t2 || {}, u2 = c2.nonceIn, l2 = c2.organization, d2 = c2.scopesToRequest, h2 = c2.max_age;
    try {
      const t3 = await ze(Object.assign(Object.assign({ baseUrl: this.domainUrl, client_id: this.options.clientId, auth0Client: this.options.auth0Client, useFormData: this.options.useFormData, timeout: this.httpTimeoutMs, useMrrt: this.options.useMrrt, dpop: this.dpop, preserveRefreshToken: this.onlineAccess }, e3), { scope: d2 || e3.scope }), this.worker);
      let c3 = await this._verifyIdToken(t3.id_token, u2, l2, h2);
      if ("authorization_code" === e3.grant_type) {
        const e4 = await this._getIdTokenFromCache();
        (null === (o2 = null === (n2 = null == e4 ? void 0 : e4.decodedToken) || void 0 === n2 ? void 0 : n2.claims) || void 0 === o2 ? void 0 : o2.sub) && e4.decodedToken.claims.sub !== c3.claims.sub && (await this.cacheManager.clear(this.options.clientId), this.userCache.remove(Ze));
      }
      if ("authorization_code" !== e3.grant_type) {
        const e4 = await this._getIdTokenFromCache(), t4 = null === (r2 = null === (i2 = null == e4 ? void 0 : e4.decodedToken) || void 0 === i2 ? void 0 : i2.claims) || void 0 === r2 ? void 0 : r2.session_expiry;
        void 0 !== t4 && (c3 = Object.assign(Object.assign({}, c3), { claims: Object.assign(Object.assign({}, c3.claims), { session_expiry: t4 }) }));
      }
      return !t3.refresh_token && this.onlineAccess && (t3.refresh_token = null !== (s2 = e3.refresh_token) && void 0 !== s2 ? s2 : null === (a2 = await this.cacheManager.get(new Fe({ scope: d2 || e3.scope, audience: e3.audience || C, clientId: this.options.clientId }), void 0, this.options.useMrrt)) || void 0 === a2 ? void 0 : a2.refresh_token), await this._saveEntryInCache(Object.assign(Object.assign(Object.assign(Object.assign({}, t3), { decodedToken: c3, scope: e3.scope, audience: e3.audience || C }), t3.scope ? { oauthTokenScope: t3.scope } : null), { client_id: this.options.clientId })), this.cookieStorage.save(this.isAuthenticatedCookieName, true, { daysUntilExpire: this.sessionCheckExpiryDays, cookieDomain: this.options.cookieDomain }), this._processOrgHint(l2 || c3.claims.org_id), Object.assign(Object.assign({}, t3), { decodedToken: c3 });
    } catch (t3) {
      throw "authorization_code" !== e3.grant_type && this._storeMfaContext(t3, d2 || e3.scope, e3.audience), t3;
    }
  }
  _buildTokenExchangeParams(e3) {
    return Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, e3), { grant_type: "urn:ietf:params:oauth:grant-type:token-exchange", subject_token: e3.subject_token, subject_token_type: e3.subject_token_type }), e3.actor_token && { actor_token: e3.actor_token }), e3.actor_token_type && { actor_token_type: e3.actor_token_type }), { scope: De(this.scope, e3.scope, e3.audience || this.options.authorizationParams.audience), audience: e3.audience || this.options.authorizationParams.audience, organization: e3.organization || this.options.authorizationParams.organization });
  }
  async loginWithCustomTokenExchange(e3) {
    const t2 = this._buildTokenExchangeParams(e3);
    return this._requestToken(t2, { organization: t2.organization });
  }
  async customTokenExchange(e3) {
    const t2 = this._buildTokenExchangeParams(e3);
    try {
      const n2 = await ze(Object.assign(Object.assign({}, t2), { baseUrl: this.domainUrl, client_id: this.options.clientId, auth0Client: this.options.auth0Client, useFormData: this.options.useFormData, timeout: this.httpTimeoutMs, dpop: this.dpop }), this.worker, true);
      return n2.id_token && await this._verifyIdToken(n2.id_token, void 0, e3.organization), n2;
    } catch (e4) {
      throw this._storeMfaContext(e4, t2.scope, t2.audience), e4;
    }
  }
  async exchangeToken(e3) {
    return this.loginWithCustomTokenExchange(e3);
  }
  _assertDpop(e3) {
    if (!e3) throw new Error("`useDpop` option must be enabled before using DPoP.");
  }
  getDpopNonce(e3) {
    return this._assertDpop(this.dpop), this.dpop.getNonce(e3);
  }
  setDpopNonce(e3, t2) {
    return this._assertDpop(this.dpop), this.dpop.setNonce(e3, t2);
  }
  generateDpopProof(e3) {
    return this._assertDpop(this.dpop), this.dpop.generateProof(e3);
  }
  createFetcher() {
    let e3 = arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {};
    return new xt(e3, { isDpopEnabled: () => !!this.options.useDpop, getAccessToken: (e4) => {
      var t2;
      return this.getTokenSilently({ authorizationParams: { scope: null === (t2 = null == e4 ? void 0 : e4.scope) || void 0 === t2 ? void 0 : t2.join(" "), audience: null == e4 ? void 0 : e4.audience }, detailedResponse: true });
    }, getDpopNonce: () => this.getDpopNonce(e3.dpopNonceId), setDpopNonce: (t2) => this.setDpopNonce(t2, e3.dpopNonceId), generateDpopProof: (e4) => this.generateDpopProof(e4) });
  }
  async connectAccountWithRedirect(e3) {
    const t2 = e3.openUrl, n2 = e3.appState, o2 = e3.connection, i2 = e3.scopes, r2 = e3.authorization_params, s2 = e3.redirectUri, a2 = void 0 === s2 ? this.options.authorizationParams.redirect_uri || window.location.origin : s2;
    if (!o2) throw new Error("connection is required");
    const c2 = H(D()), u2 = D(), l2 = await X(u2), d2 = q(l2), h2 = await this.myAccount.connectAccount({ connection: o2, scopes: i2, redirect_uri: a2, state: c2, code_challenge: d2, code_challenge_method: "S256", authorization_params: r2 }), p2 = h2.connect_uri, f2 = h2.connect_params, m2 = h2.auth_session;
    this.transactionManager.create({ state: c2, code_verifier: u2, auth_session: m2, redirect_uri: a2, appState: n2, connection: o2, response_type: ht.ConnectCode });
    const y2 = new URL(p2);
    y2.searchParams.set("ticket", f2.ticket), t2 ? await t2(y2.toString()) : window.location.assign(y2);
  }
  async _requestTokenForPasskey(e3) {
    var t2;
    const n2 = e3.audience || this.options.authorizationParams.audience, o2 = e3.organization || this.options.authorizationParams.organization, i2 = !!e3.verification && Object.keys(e3.verification).length > 0;
    try {
      return await this._requestToken(Object.assign(Object.assign(Object.assign(Object.assign({ grant_type: "urn:okta:params:oauth:grant-type:webauthn", auth_session: e3.authSession, authn_response: e3.credential }, e3.realm && { realm: e3.realm }), o2 && { organization: o2 }), i2 && { verification: e3.verification }), { scope: De(this.scope, e3.scope, n2), audience: n2 }));
    } catch (e4) {
      if (e4 instanceof E && (null === (t2 = e4.data) || void 0 === t2 ? void 0 : t2.auth_session) && e4.data.verification_required) throw new dc(e4.error_description, { error: e4.error, error_description: e4.error_description, auth_session: e4.data.auth_session, verification_required: e4.data.verification_required });
      throw e4;
    }
  }
  async _requestTokenForMfa(t2, n2) {
    const o2 = t2.mfaToken, i2 = e(t2, ["mfaToken"]), r2 = await this.cacheManager.get(new Fe({ scope: i2.scope, audience: i2.audience || C, clientId: this.options.clientId }), void 0, this.options.useMrrt), s2 = await this._requestToken(Object.assign(Object.assign({}, i2), { mfa_token: o2 }), n2);
    return await this._propagateRotatedRefreshToken(null == r2 ? void 0 : r2.refresh_token, s2.refresh_token), s2;
  }
};

// integrations/training-companion/ui/auth.js
var config;
var client;
async function initializeAuth() {
  config = await fetch("/api/training/config").then((r2) => {
    if (!r2.ok) throw Error("Sign-in is temporarily unavailable.");
    return r2.json();
  });
  if (config.preview) return config;
  if (!config.clientId) throw Error("This preview is awaiting sign-in setup.");
  client ??= new Mu({
    domain: config.domain,
    clientId: config.clientId,
    cacheLocation: "memory",
    useRefreshTokens: true,
    useRefreshTokensFallback: true,
    workerUrl: "/training/auth0-worker.js",
    authorizationParams: { audience: config.audience, scope: config.scopes, redirect_uri: location.origin + "/training/" }
  });
  try {
    const session2 = await restoreSession(client, { search: location.search, hash: location.hash, storage: sessionStorage, replace: (url) => history.replaceState(null, "", url) });
    return { ...config, ...session2 };
  } catch (error2) {
    error2.authConfig = config;
    throw error2;
  }
}
async function getToken() {
  if (config.preview) {
    const response = await fetch("/__preview/session", { cache: "no-store" });
    if (!response.ok) throw Object.assign(Error("Choose a sample account to open the preview."), { status: 401 });
    return (await response.json()).token;
  }
  return client.getTokenSilently();
}
async function signIn(account) {
  if (config.preview) {
    const response = await fetch("/__preview/sign-in", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ account }) });
    if (!response.ok) throw Error("Could not open the sample account.");
    location.replace("/training/");
  } else await client.loginWithRedirect({ authorizationParams: { prompt: "login" } });
}
async function signOut() {
  clearSessionHint(sessionStorage);
  if (config.preview) {
    const response = await fetch("/__preview/sign-out", { method: "POST" });
    if (!response.ok) throw Error("Could not sign out. Try again.");
    location.replace("/training/");
  } else await client.logout({ logoutParams: { returnTo: location.origin + "/training/" } });
}
async function activateAccount() {
  const token = await getToken();
  const response = await fetch("/api/training/activate", { method: "POST", headers: { Authorization: "Bearer " + token } });
  const result = await response.json();
  if (!response.ok) throw Error(result.error ?? "Could not create your space.");
  return result;
}

// integrations/training-companion/ui/client.js
var $2 = (s2) => document.querySelector(s2);
var app = $2("#app");
var escape = (v2) => String(v2 ?? "").replace(/[&<>"']/g, (c2) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c2]);
var today = () => {
  const d2 = /* @__PURE__ */ new Date();
  return `${d2.getFullYear()}-${String(d2.getMonth() + 1).padStart(2, "0")}-${String(d2.getDate()).padStart(2, "0")}`;
};
var prettyDate = (d2) => (/* @__PURE__ */ new Date(d2 + "T12:00:00")).toLocaleDateString(void 0, { month: "short", day: "numeric" });
var countSets = (w2) => w2.exercises.reduce((n2, e3) => n2 + e3.sets.length, 0);
var totals = (w2) => `${w2.exercises.length} ${w2.exercises.length === 1 ? "exercise" : "exercises"} \xB7 ${countSets(w2)} ${countSets(w2) === 1 ? "set" : "sets"}`;
var blankSet = () => ({ reps: null, seconds: null, load: null, unit: null, loadMeaning: "unspecified", side: "unspecified" });
var profile;
var workouts = [];
var session = null;
var builder = null;
var builderIntent = null;
var builderConflict = false;
var storageKey = "";
var storageOK = true;
var busy = false;
var errorText = "";
var audio = null;
var wakeLock = null;
var wakePending = false;
var wakeText = "Screen awake is off";
var lastBeep = -1;
var restored = false;
var toastHandle;
var toast = (text) => {
  clearTimeout(toastHandle);
  $2("#toast").textContent = text;
  $2("#toast").classList.add("visible");
  toastHandle = setTimeout(() => $2("#toast").classList.remove("visible"), 4500);
};
var library = createLibrary({ app, rpc, escape, toast, navigate, render, persist, addToWorkout: (exercise) => {
  if (builderIntent) throw Error("Retry your pending workout save first.");
  builder ??= { title: "", date: today(), status: "planned", notes: "", exercises: [] };
  if (builder.exercises.length >= 50) throw Error("A workout can contain up to 50 exercises.");
  const entry = { name: exercise.name, exerciseId: exercise.id, exerciseRevision: exercise.revision, guidance: clone(exercise), notes: "", sets: [blankSet()] };
  const empty = builder.exercises.findIndex((e3) => !e3.name && !e3.exerciseId);
  if (empty >= 0) builder.exercises[empty] = entry;
  else builder.exercises.push(entry);
  persist();
  navigate("build");
} });
async function rpc(name, args = {}) {
  const token = await getToken();
  const response = await fetch("/api/training/operation", { method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, ...profile ? { "X-Training-Athlete": profile.athleteId } : {} }, body: JSON.stringify({ name, arguments: args }) });
  let result;
  try {
    result = await response.json();
  } catch {
    throw Error("Could not reach your training space. Your draft is still here.");
  }
  if (!response.ok) {
    const e3 = Error(result.error ?? "Unable to save. Try again.");
    e3.status = response.status;
    e3.code = result.code;
    throw e3;
  }
  return result;
}
function persist() {
  if (!storageKey) return;
  try {
    localStorage.setItem(storageKey, JSON.stringify({ session, builder, builderIntent, library: library.serialize() }));
    storageOK = true;
  } catch {
    storageOK = false;
  }
}
function loadDraft() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (saved) {
      library.restore(saved.library);
      session = saved.session;
      builder = saved.builder;
      builderIntent = saved.builderIntent;
      if (session?.timer) {
        session.timer.running = false;
        session.timer.remaining = Math.max(0, session.timer.remaining);
        restored = true;
      }
    }
  } catch {
    toast("The previous draft could not be restored.");
  }
}
async function refresh() {
  const result = await rpc("list_workouts");
  workouts = result.workouts;
  if (result.truncated) toast("Showing the 100 most recently updated workouts. Older records are still saved.");
}
function navigate(route) {
  if (location.hash === "#" + route) render();
  else location.hash = route;
}
var setText = (s2) => [s2.reps !== null && s2.reps !== void 0 ? `${s2.reps} reps` : null, s2.seconds !== null && s2.seconds !== void 0 ? `${s2.seconds}s` : null, s2.load !== null && s2.load !== void 0 ? `${s2.load} ${s2.unit} ${s2.loadMeaning === "per_hand" ? "per hand" : s2.loadMeaning === "total" ? "total" : s2.loadMeaning === "assistance" ? "assistance" : ""}` : null, s2.loadMeaning === "bodyweight" ? "bodyweight" : null, s2.side && s2.side !== "unspecified" ? s2.side.replace("_", " ") : null].filter(Boolean).join(" \xB7 ") || "Log as you go";
var heading = (eyebrow, title, subtitle = "", extra = "") => `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${escape(title)}</h1>${subtitle ? `<p>${escape(subtitle)}</p>` : ""}</div>${extra}</div>`;
var error = () => errorText ? `<p class="inline-error" role="alert">${escape(errorText)}</p>` : "";
var planCard = (w2) => `<article class="workout-card"><div class="eyebrow">${w2.exercises.some((e3) => e3.sets.some((s2) => s2.seconds > 0)) ? "Timed + movement" : "Strength session"}</div><h3>${escape(w2.title)}</h3><p>${escape(w2.exercises.map((e3) => e3.name).join(" \xB7 "))}</p><div class="card-bottom"><span>${totals(w2)}</span><button class="small secondary" data-action="detail" data-id="${w2.id}" aria-label="View ${escape(w2.title)}">View \u2197</button></div></article>`;
function historyRows(rows) {
  return rows.map((w2) => {
    const d2 = /* @__PURE__ */ new Date(w2.date + "T12:00:00");
    return `<article class="history-row"><div class="history-date">${d2.toLocaleDateString(void 0, { month: "short" })}<strong>${d2.getDate()}</strong></div><div class="history-info"><h3>${escape(w2.title)}</h3><p>${totals(w2)} logged</p></div><button data-action="detail" data-id="${w2.id}" aria-label="Review ${escape(w2.title)}">\u2197</button></article>`;
  }).join("");
}
function home() {
  const plans = workouts.filter((w2) => w2.status === "planned"), recent = workouts.filter((w2) => w2.status === "completed").sort((a2, b2) => b2.date.localeCompare(a2.date));
  const next = plans[0];
  return `${heading("Your training space", "A little stronger,\none session at a time.", "Your workouts, your pace. Everything in one place.", `<span class="date-chip">${(/* @__PURE__ */ new Date()).toLocaleDateString(void 0, { weekday: "short", month: "short", day: "numeric" })}</span>`)}${session ? `<div class="notice"><strong>You have a session in progress.</strong> ${escape(session.title)} \xB7 ${session.queue.filter((s2) => s2.actual).length} sets logged.<div class="actions"><button class="small" data-action="resume">Resume session \u2192</button><button class="small quiet" data-action="discard">Discard draft</button></div></div>` : ""}<div class="dashboard"><section class="hero"><div class="eyebrow">${next ? "Ready when you are" : "Make room for movement"}</div><h2>${escape(next?.title ?? "Your first workout\nstarts here.")}</h2><p>${next ? `${next.exercises.length} exercises \xB7 ${countSets(next)} sets \xB7 ${escape(prettyDate(next.date))}` : "Build a simple plan, or log a workout as you go."}</p><div class="hero-footer"><button data-action="${next ? "detail" : "new"}" ${next ? `data-id="${next.id}"` : ""}>${next ? "Open workout" : "Create a workout"} <span aria-hidden="true">\u2197</span></button><span>${next ? "A plan to follow.\nRoom to adapt." : "Start small.\nMake it yours."}</span></div></section><section class="card companion-card"><div class="orb" aria-hidden="true">\u2733</div><div><h3>Plan it your way.</h3><p>Create a workout here, or ask your connected assistant to make one. Refresh to see its latest changes.</p></div><button class="secondary small" data-action="refresh">Refresh workouts \u21BB</button></section></div><div class="section-heading"><h2>Your workouts</h2><button class="quiet small" data-action="new">\uFF0B New workout</button></div>${builder ? '<div class="notice">An unsaved workout draft is waiting. <button class="quiet small" data-action="builder">Continue editing \u2192</button></div>' : ""}<div class="plan-list">${plans.length ? plans.map(planCard).join("") : '<div class="empty">No plans yet. Add exercises, sets, or timed intervals to build your first one.</div>'}</div><div class="section-heading"><h2>Recently completed</h2><a class="help" href="#history">View history \u2192</a></div>${recent.length ? historyRows(recent.slice(0, 3)) : '<div class="empty">Your completed sessions will appear here.</div>'}`;
}
function detail(w2) {
  return `<div class="narrow"><a class="back" href="#${w2.status === "completed" ? "history" : "workouts"}">\u2190 Back to ${w2.status === "completed" ? "history" : "workouts"}</a>${heading(w2.status === "planned" ? "Your plan" : "Saved session", w2.title, `${prettyDate(w2.date)} \xB7 ${totals(w2)}`)}<div class="actions">${w2.status === "planned" ? `<button data-action="start" data-id="${w2.id}">Start workout \u2192</button><button class="secondary" data-action="edit" data-id="${w2.id}">Edit plan</button>` : `<button data-action="repeat" data-id="${w2.id}">Use as a new plan</button>`}</div>${error()}${w2.exercises.map((e3) => `<section class="card detail-exercise"><h3>${escape(e3.name)}</h3>${e3.notes ? `<p class="text-note"><strong>This workout:</strong> ${escape(e3.notes)}</p>` : ""}${e3.guidance ? `<details><summary>Form &amp; muscles \xB7 saved guidance</summary>${library.guidance(e3.guidance)}</details>` : `<button class="quiet small" data-action="library-from-workout" data-id="${w2.id}" data-e="${w2.exercises.indexOf(e3)}">Add to exercise library</button>`}${e3.sets.length ? e3.sets.map((s2, i2) => `<div class="set-line"><span>Set ${i2 + 1}</span><span>${escape(setText(s2))}</span></div>`).join("") : '<p class="help">No sets in this exercise yet.</p>'}</section>`).join("")}${w2.notes ? `<section class="card detail-exercise"><h3>Notes</h3><p class="help text-note">${escape(w2.notes)}</p></section>` : ""}<p class="save-status">Saved \xB7 revision ${w2.revision}.${w2.status === "planned" ? " Starting a session fetches the latest version of this plan." : ""}</p></div>`;
}
function options(values, selected) {
  return values.map(([v2, label]) => `<option value="${v2}" ${v2 === selected ? "selected" : ""}>${label}</option>`).join("");
}
function inputField(label, value, attrs = "", type = "number") {
  return `<label class="field">${label}<input type="${type}" value="${escape(value ?? "")}" ${attrs}></label>`;
}
function builderPage() {
  if (!builder) return "";
  return `<div class="narrow"><a class="back" href="#workouts">\u2190 Your workouts</a>${heading(builder.id ? "Edit your plan" : "Make it yours", builder.id ? "Fine-tune your workout." : "Build a workout.", "Reps, timed intervals, or a mix. Leave unknown values blank.")}<form id="builder-form">${inputField("Workout name", builder.title, 'name="title" maxlength="160" required placeholder="e.g. Upper body \xB7 at home"', "text")}<div class="form-row">${inputField("Planned date", builder.date, 'name="date" required', "date")}<label class="field">Workout notes<textarea name="notes" maxlength="3000" placeholder="Anything you want to remember">${escape(builder.notes)}</textarea></label></div>${builder.exercises.map((e3, ei2) => `<section class="card exercise-editor"><div class="exercise-title"><input aria-label="Exercise ${ei2 + 1} name" data-e="${ei2}" data-field="name" value="${escape(e3.name)}" maxlength="160" required placeholder="Exercise name" ${e3.exerciseId ? "readonly" : ""}><button type="button" class="quiet small" data-action="remove-exercise" data-e="${ei2}" aria-label="Remove exercise ${ei2 + 1}">\xD7</button></div>${e3.exerciseId ? `<p class="help">Library exercise \xB7 saved revision ${e3.exerciseRevision} <button type="button" class="quiet small" data-action="refresh-guidance" data-e="${ei2}">Use latest guidance</button></p>` : ""}<label class="field">Notes for this workout<textarea data-e="${ei2}" data-field="notes" maxlength="3000" placeholder="e.g. Slow and controlled">${escape(e3.notes ?? "")}</textarea></label>${e3.sets.map((s2, si2) => `<div class="set-editor"><div class="set-heading"><span>SET ${si2 + 1}</span><button type="button" class="quiet small" data-action="remove-set" data-e="${ei2}" data-s="${si2}" aria-label="Remove set ${si2 + 1} of exercise ${ei2 + 1}">Remove</button></div><div class="set-fields">${inputField("Reps", s2.reps, `min="0" max="10000" step="1" data-e="${ei2}" data-s="${si2}" data-field="reps" placeholder="\u2014"`)}${inputField("Seconds", s2.seconds, `min="1" max="86400" step="1" data-e="${ei2}" data-s="${si2}" data-field="seconds" placeholder="\u2014"`)}${inputField("Weight", s2.load, `min="0" max="10000" step="any" data-e="${ei2}" data-s="${si2}" data-field="load" placeholder="\u2014"`)}<label class="field">Unit<select data-e="${ei2}" data-s="${si2}" data-field="unit">${options([["", "Not set"], ["lb", "lb"], ["kg", "kg"]], s2.unit ?? "")}</select></label><label class="field">Weight means<select data-e="${ei2}" data-s="${si2}" data-field="loadMeaning">${options([["unspecified", "Not set"], ["per_hand", "Per hand"], ["total", "Total"], ["bodyweight", "Bodyweight"], ["assistance", "Assistance"]], s2.loadMeaning)}</select></label><label class="field">Side<select data-e="${ei2}" data-s="${si2}" data-field="side">${options([["unspecified", "Not set"], ["per_side", "Per side"], ["both", "Both"], ["left", "Left"], ["right", "Right"]], s2.side)}</select></label></div></div>`).join("")}<button type="button" class="secondary small" data-action="add-set" data-e="${ei2}">\uFF0B Add set</button></section>`).join("")}<div class="editor-actions"><button type="button" class="secondary" data-action="add-exercise">\uFF0B Add exercise</button><button type="button" class="secondary" data-action="library">Choose from library</button></div><p class="help">Timed intervals use the seconds field. During a session you can choose hands-free transitions and rest lengths. A saved plan is separate from your completed session.</p>${error()}${builderConflict ? '<div class="notice">This plan changed elsewhere. Keep your edits as a new plan, or discard this draft and reload the latest.<div class="actions"><button type="button" data-action="save-copy">Keep as new plan</button><button type="button" class="secondary" data-action="reload-plan">Discard edits & reload</button></div></div>' : ""}<button class="big-button" type="submit" ${busy || builderConflict ? "disabled" : ""}>${busy ? "Saving\u2026" : builderIntent ? "Retry save" : "Save workout plan"}</button><button type="button" class="quiet small" data-action="discard-plan">Discard workout draft</button><p class="save-status">${storageOK ? "Draft saved on this device." : "Device storage unavailable. Keep this page open until saved."}</p>${builderIntent ? '<p class="help">The last save has an uncertain outcome. Retry it before editing so you don\u2019t create a duplicate.</p>' : ""}</form></div>`;
}
function previousSet(step) {
  const prior = workouts.filter((w2) => w2.status === "completed").sort((a2, b2) => b2.date.localeCompare(a2.date) || b2.updatedAt.localeCompare(a2.updatedAt));
  for (const w2 of prior) {
    const e3 = w2.exercises.find((e4) => e4.name.toLowerCase() === step.name.toLowerCase());
    if (e3?.sets[step.si]) return `${prettyDate(w2.date)}: ${setText(e3.sets[step.si])}`;
  }
  return "No previous set recorded yet.";
}
function sessionPage() {
  if (!session) return '<div class="empty">No session in progress. <a href="#workouts">Choose a workout \u2192</a></div>';
  const step = session.queue[session.index];
  if (!step) return reviewPage();
  const t2 = session.timer, isRest = t2?.kind === "rest";
  const done = session.queue.filter((x2) => x2.actual).length;
  const next = session.queue[session.index + 1];
  return `<div class="narrow"><div class="session-header"><a class="back" href="#workouts">\u2190 Your workouts</a><span class="pill">${done} / ${session.queue.length} logged</span></div><div class="help">${escape(session.title)}</div><div class="progress-track"><div class="progress-fill" style="width:${session.index / session.queue.length * 100}%"></div></div>${restored ? '<div class="notice">Your session is restored. Any timer is paused; resume when you\u2019re ready.</div>' : ""}${error()}<section class="card session-card ${isRest ? "rest" : ""}"><div class="eyebrow">${isRest ? "A moment to reset" : `Exercise ${step.ei + 1} \xB7 Set ${step.si + 1}`}</div><h1>${isRest ? "Take a breath." : escape(step.name)}</h1><p class="help">${isRest ? `Up next: ${escape(step.name)} \xB7 set ${step.si + 1}` : escape(setText(step.target))}</p>${!isRest && step.definition?.notes ? `<p class="text-note">${escape(step.definition.notes)}</p>` : ""}${!isRest && step.definition?.guidance ? `<details><summary>Form &amp; muscles</summary>${library.guidance(step.definition.guidance)}</details>` : ""}${isRest || step.target.seconds > 0 ? `<div id="timer-value" class="timer" role="timer" aria-label="Time remaining">${formatTime(t2 ? remaining(t2, Date.now()) : step.target.seconds)}</div><p class="timer-label">${isRest ? "Rest remaining" : "Seconds remaining"}</p><div class="actions" style="margin-top:24px">${t2 ? `<button data-action="toggle-timer">${t2.running ? "Pause" : "Resume timer"}</button>${isRest ? '<button class="secondary" data-action="add-rest">\uFF0B 15 sec</button>' : ""}` : '<button data-action="begin-timer">Start interval</button>'}</div>${isRest ? '<button class="quiet small" data-action="skip-rest">Skip rest \u2192</button>' : '<p class="help" style="margin-top:16px">Completing the timer logs this interval\u2019s duration. Reps are left blank.</p>'}` : `<p class="last">Last time \xB7 ${escape(previousSet(step))}</p><form id="set-form"><div class="set-fields">${inputField("Reps completed", step.entry ? step.entry.reps : step.target.reps, 'name="reps" min="0" max="10000" step="1" placeholder="\u2014"')}${inputField("Weight used", step.entry ? step.entry.load : step.target.load, 'name="load" min="0" max="10000" step="any" placeholder="\u2014"')}<label class="field">Unit<select name="unit">${options([["", "Not set"], ["lb", "lb"], ["kg", "kg"]], (step.entry ? step.entry.unit : step.target.unit) ?? "")}</select></label></div><p class="help">${escape(step.target.loadMeaning === "per_hand" ? "Weight is per hand." : step.target.loadMeaning === "total" ? "Weight is total." : "Weight meaning: " + step.target.loadMeaning.replace("_", " "))} Side: ${escape(step.target.side.replace("_", " "))}.</p><button class="big-button" type="submit">Log set ${step.si + 1} \u2713</button></form>`}</section><div class="up-next"><span>Then</span><div><strong>${next ? escape(next.name) + " \xB7 set " + (next.si + 1) : "Review your session"}</strong>${next ? `<p class="help">${escape(setText(next.target))}</p>` : ""}</div></div>${settings()}<p id="wake-status" class="wake">${escape(wakeText)}</p><p class="help">Keep the app open for cues and automatic transitions. Switching apps pauses the timer.</p><div class="session-foot"><button class="quiet" data-action="skip-set">Skip this set</button><button class="quiet" data-action="finish-early">Finish & review</button></div>${!storageOK ? '<p class="storage-warning help">Device storage is unavailable; keep this page open until your session is saved.</p>' : ""}</div>`;
}
function settings() {
  return `<details class="settings"><summary>Session settings</summary><label class="toggle">Auto-start the next timed interval<input type="checkbox" data-setting="autoAdvance" ${session.autoAdvance ? "checked" : ""}></label><label class="toggle">Sound cues<input type="checkbox" data-setting="sound" ${session.sound ? "checked" : ""}></label><label class="toggle">Keep screen awake<input type="checkbox" data-setting="keepAwake" ${session.keepAwake ? "checked" : ""}></label><div class="form-row">${inputField("Rest after rep-based sets", session.restSeconds, 'data-setting="restSeconds" min="0" max="600" step="1"')}${inputField("Rest after timed intervals", session.timedRestSeconds, 'data-setting="timedRestSeconds" min="0" max="600" step="1"')}</div><p class="help">Rest is in seconds. Set timed rest to 0 for back-to-back intervals. These settings apply to this session.</p></details>`;
}
function reviewPage() {
  if (!session) return "";
  const done = session.queue.filter((s2) => s2.actual), skipped = session.queue.length - done.length;
  return `<div class="narrow"><a class="back" href="#session">\u2190 Session</a><div class="review-header"><div class="complete-icon">\u2713</div><div class="eyebrow">Make it count</div><h1 style="margin-top:14px">Session in the books.</h1><p class="muted">Review what you did, then save it to your history.</p><div class="review-stats"><div><strong>${done.length}</strong><span>sets logged</span></div><div><strong>${new Set(done.map((s2) => s2.ei)).size}</strong><span>exercises</span></div></div></div>${skipped ? `<div class="notice">${skipped} unlogged or skipped ${skipped === 1 ? "set is" : "sets are"} excluded from your completed record.</div>` : ""}<form id="review-form">${inputField("Session name", session.title, 'name="title" maxlength="160" required', "text")}${inputField("Session date", session.date, 'name="date" required', "date")}${done.map((step) => `<section class="card detail-exercise"><div class="set-heading"><strong>${escape(step.name)} \xB7 set ${step.si + 1}</strong></div><div class="set-fields">${inputField("Reps", step.actual.reps, `min="0" max="10000" step="1" data-review="${session.queue.indexOf(step)}" data-field="reps"`)}${inputField("Seconds", step.actual.seconds, `min="0" max="86400" step="any" data-review="${session.queue.indexOf(step)}" data-field="seconds"`)}${inputField("Weight", step.actual.load, `min="0" max="10000" step="any" data-review="${session.queue.indexOf(step)}" data-field="load"`)}<label class="field">Unit<select data-review="${session.queue.indexOf(step)}" data-field="unit">${options([["", "Not set"], ["lb", "lb"], ["kg", "kg"]], step.actual.unit ?? "")}</select></label><label class="field">Weight means<select data-review="${session.queue.indexOf(step)}" data-field="loadMeaning">${options([["unspecified", "Not set"], ["per_hand", "Per hand"], ["total", "Total"], ["bodyweight", "Bodyweight"], ["assistance", "Assistance"]], step.actual.loadMeaning)}</select></label><label class="field">Side<select data-review="${session.queue.indexOf(step)}" data-field="side">${options([["unspecified", "Not set"], ["per_side", "Per side"], ["both", "Both"], ["left", "Left"], ["right", "Right"]], step.actual.side)}</select></label></div></section>`).join("")}<label class="field" style="margin-top:24px">How did it go?<textarea name="notes" maxlength="3000" placeholder="Energy, effort, anything to remember\u2026">${escape(session.notes)}</textarea></label>${error()}<button class="big-button" type="submit" ${busy || !done.length ? "disabled" : ""}>${busy ? "Saving session\u2026" : session.pending ? "Retry saving session" : "Save completed session"}</button><p class="save-status">${session.pending ? "Your save request is retained. Retry safely without duplicating the session." : "Only logged sets will be saved. Your original plan stays unchanged."}</p></form></div>`;
}
function render() {
  const route = location.hash.slice(1) || "workouts";
  document.querySelectorAll("[data-nav]").forEach((a2) => a2.classList.toggle("active", a2.dataset.nav === route));
  if (!profile) return;
  let html;
  if (route.startsWith("library")) html = library.page(route);
  else if (route === "build") html = builderPage() || home();
  else if (route === "session") html = sessionPage();
  else if (route === "review") html = reviewPage() || home();
  else if (route.startsWith("workout/")) {
    const w2 = workouts.find((w3) => w3.id === route.slice(8));
    html = w2 ? detail(w2) : '<div class="empty">This workout is no longer in the latest list. <a href="#workouts">Back to workouts</a></div>';
  } else if (route === "history") html = `${heading("Look how far you\u2019ve come", "Your training, recorded.", "Completed sessions, exactly as you logged them.")}<div class="actions" style="max-width:360px"><button class="secondary" data-action="refresh">Refresh history \u21BB</button></div>${workouts.some((w2) => w2.status === "completed") ? historyRows(workouts.filter((w2) => w2.status === "completed").sort((a2, b2) => b2.date.localeCompare(a2.date) || b2.updatedAt.localeCompare(a2.updatedAt))) : '<div class="empty" style="margin-top:25px">Finish your first session to start your history.</div>'}`;
  else if (route === "equipment") html = `${heading("Your setup", "Work with what you have.", "Equipment from your connected training profile.")}<div class="equipment-grid">${profile.equipment?.length ? profile.equipment.map((e3) => `<section class="card"><span class="pill">Available</span><h2 style="margin-top:20px">${escape(e3.name)}</h2><p class="muted">${escape(e3.quantity ?? "")} ${e3.quantity ? "\xD7 " : ""}${escape(e3.load ?? "")} ${escape(e3.unit ?? "")}</p></section>`).join("") : '<div class="empty">No equipment saved yet.</div>'}</div><p class="help" style="margin-top:25px">Profile editing and equipment-based exercise suggestions are coming in a later slice. Custom workouts can currently include any exercise.</p>`;
  else html = home();
  app.innerHTML = html;
  document.querySelector(".bottom-nav").hidden = route === "session" || route === "review";
  if (busy || builderIntent && route === "build" || session?.pending && route === "review") {
    app.querySelectorAll("input,select,textarea").forEach((e3) => e3.disabled = true);
    if (builderIntent && route === "build") app.querySelectorAll('button[type="button"]').forEach((e3) => e3.disabled = true);
  }
  updateWakeLabel();
}
function formatTime(seconds) {
  const n2 = Math.ceil(seconds);
  return n2 >= 60 ? `${Math.floor(n2 / 60)}:${String(n2 % 60).padStart(2, "0")}` : `${String(n2).padStart(2, "0")}`;
}
async function soundUnlock() {
  if (!session?.sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    await audio.resume();
  } catch {
    toast("Sound cues are unavailable in this browser.");
  }
}
function beep(end = false) {
  if (!session?.sound || !audio || audio.state !== "running") return;
  const o2 = audio.createOscillator(), g2 = audio.createGain();
  o2.connect(g2);
  g2.connect(audio.destination);
  o2.frequency.value = end ? 880 : 550;
  g2.gain.setValueAtTime(0.09, audio.currentTime);
  g2.gain.exponentialRampToValueAtTime(1e-3, audio.currentTime + 0.15);
  o2.start();
  o2.stop(audio.currentTime + 0.18);
}
function updateWakeLabel() {
  const el = $2("#wake-status");
  if (el) el.textContent = wakeText;
}
async function syncWake() {
  const active = session?.keepAwake && location.hash === "#session" && !document.hidden && session.index < session.queue.length;
  if (!active) {
    if (wakeLock) {
      await wakeLock.release().catch(() => {
      });
      wakeLock = null;
    }
    wakeText = "Screen awake is off";
  } else if (!("wakeLock" in navigator)) wakeText = "Screen-awake control unavailable. Adjust Auto-Lock if needed.";
  else if (!wakeLock && !wakePending) {
    wakePending = true;
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      if (!session?.keepAwake || location.hash !== "#session" || document.hidden) {
        await wakeLock.release();
        wakeLock = null;
        wakeText = "Screen awake is off";
        return;
      }
      wakeText = "Screen awake while this session is open";
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
        wakeText = "Screen-awake lock released";
        updateWakeLabel();
      });
    } catch {
      wakeText = "Could not keep the screen awake. Check your device settings.";
    } finally {
      wakePending = false;
    }
  }
  updateWakeLabel();
}
async function discard() {
  const dialog = $2("#confirm");
  $2("#confirm-title").textContent = "Discard this session?";
  $2("#confirm-copy").textContent = "Logged sets in this unsaved session will be removed from this device. Your saved workouts stay intact.";
  dialog.showModal();
  const choice = await new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true }));
  if (choice === "confirm") {
    session = null;
    persist();
    await syncWake();
    navigate("workouts");
  }
}
async function begin(w2) {
  if (session) {
    toast("Resume or discard your current session first.");
    navigate("session");
    return;
  }
  session = createSession(w2, today());
  restored = false;
  persist();
  await soundUnlock();
  navigate("session");
  await syncWake();
}
app.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || busy) return;
  const { action, id, e: e3, s: s2 } = button.dataset;
  errorText = "";
  try {
    if (action === "library") await library.open();
    else if (action === "library-from-workout") {
      await library.makeDraft(workouts.find((w2) => w2.id === id).exercises[Number(e3)].name);
    } else if (action === "refresh-guidance") {
      const entry = builder.exercises[e3];
      const fresh = await rpc("get_exercise", { id: entry.exerciseId });
      entry.name = fresh.name;
      entry.exerciseRevision = fresh.revision;
      entry.guidance = fresh;
    } else if (action === "detail") navigate("workout/" + id);
    else if (action === "refresh") {
      busy = true;
      button.disabled = true;
      await refresh();
      toast("Workouts refreshed");
    } else if (action === "new") {
      if (!builder) builder = { title: "", date: today(), status: "planned", notes: "", exercises: [{ name: "", sets: [blankSet()] }] };
      navigate("build");
    } else if (action === "builder") navigate("build");
    else if (action === "save-copy") {
      delete builder.id;
      delete builder.revision;
      delete builder.updatedAt;
      builderConflict = false;
    } else if (action === "reload-plan") {
      builder = clone(await rpc("get_workout", { id: builder.id }));
      builderConflict = false;
    } else if (action === "discard-plan") {
      const dialog = $2("#confirm");
      $2("#confirm-title").textContent = "Discard this workout draft?";
      $2("#confirm-copy").textContent = "Unsaved edits will be removed. Any saved plan stays intact.";
      dialog.showModal();
      const choice = await new Promise((resolve) => dialog.addEventListener("close", () => resolve(dialog.returnValue), { once: true }));
      if (choice === "confirm") {
        builder = null;
        builderIntent = null;
        builderConflict = false;
        navigate("workouts");
      }
    } else if (action === "edit" || action === "repeat") {
      if (builder) {
        toast("Finish your existing workout draft first.");
        navigate("build");
        return;
      }
      const fresh = await rpc("get_workout", { id });
      builder = clone(fresh);
      if (action === "repeat") {
        delete builder.id;
        delete builder.revision;
        delete builder.updatedAt;
        builder.date = today();
        builder.status = "planned";
      }
      navigate("build");
    } else if (action === "add-exercise") {
      if (builder.exercises.length >= 50) throw Error("A workout can contain up to 50 exercises.");
      builder.exercises.push({ name: "", sets: [blankSet()] });
    } else if (action === "remove-exercise") {
      builder.exercises.splice(+e3, 1);
    } else if (action === "add-set") {
      if (builder.exercises[e3].sets.length >= 100) throw Error("An exercise can contain up to 100 sets.");
      builder.exercises[e3].sets.push(clone(builder.exercises[e3].sets.at(-1) ?? blankSet()));
    } else if (action === "remove-set") builder.exercises[e3].sets.splice(+s2, 1);
    else if (action === "start") await begin(await rpc("get_workout", { id }));
    else if (action === "resume") navigate("session");
    else if (action === "discard") {
      await discard();
      return;
    } else if (action === "begin-timer") {
      await soundUnlock();
      restored = false;
      startTimer(session, "exercise", session.queue[session.index].target.seconds, Date.now());
    } else if (action === "toggle-timer") {
      await soundUnlock();
      restored = false;
      if (session.timer.running) pauseTimer(session, Date.now());
      else resumeTimer(session, Date.now());
    } else if (action === "add-rest") {
      const t2 = session.timer;
      t2.remaining = remaining(t2, Date.now()) + 15;
      if (t2.running) t2.deadline = Date.now() + t2.remaining * 1e3;
    } else if (action === "skip-rest") afterRest(session, Date.now());
    else if (action === "skip-set") {
      session.queue[session.index].skipped = true;
      session.index++;
      session.timer = null;
    } else if (action === "finish-early") {
      pauseTimer(session, Date.now());
      navigate("review");
    }
  } catch (e4) {
    errorText = e4.message;
    toast(e4.message);
  } finally {
    busy = false;
    persist();
    render();
    await syncWake();
  }
});
app.addEventListener("input", (event) => {
  const el = event.target, d2 = el.dataset;
  if (busy) return;
  if ($2("#builder-form") && builder && !builderIntent) {
    if (el.name) builder[el.name] = el.value;
    else if (d2.field) {
      const target = d2.s !== void 0 ? builder.exercises[d2.e].sets[d2.s] : builder.exercises[d2.e];
      target[d2.field] = ["reps", "seconds", "load"].includes(d2.field) ? el.value === "" ? null : Number(el.value) : d2.field === "unit" ? el.value || null : el.value;
    }
  } else if ($2("#set-form") && session) {
    const step = session.queue[session.index];
    step.entry ??= clone(step.target);
    step.entry[el.name] = el.name === "unit" ? el.value || null : el.value === "" ? null : Number(el.value);
  } else if ($2("#review-form") && session && !session.pending) {
    if (d2.review !== void 0) session.queue[d2.review].actual[d2.field] = ["reps", "seconds", "load"].includes(d2.field) ? el.value === "" ? null : Number(el.value) : d2.field === "unit" ? el.value || null : el.value;
    else if (el.name) session[el.name] = el.value;
  }
  persist();
});
app.addEventListener("change", async (event) => {
  const el = event.target;
  if (!el.dataset.setting || !session) return;
  session[el.dataset.setting] = el.type === "checkbox" ? el.checked : Math.min(600, Math.max(0, Number(el.value) || 0));
  persist();
  if (el.dataset.setting === "sound") await soundUnlock();
  await syncWake();
});
app.addEventListener("submit", async (event) => {
  if (event.target.id.startsWith("library-")) return;
  event.preventDefault();
  if (busy) return;
  errorText = "";
  const form = event.target;
  try {
    if (form.id === "builder-form") {
      if (!builderIntent) {
        if (!builder.exercises.length || builder.exercises.some((e3) => !e3.sets.length)) throw Error("Add at least one exercise and one set per exercise.");
        const { id, revision, updatedAt, ...workout } = builder;
        builderIntent = { name: id ? "update_workout" : "create_workout", args: { operationId: crypto.randomUUID(), ...id ? { id, expectedRevision: revision } : {}, workout } };
        persist();
      }
      busy = true;
      render();
      const receipt = await rpc(builderIntent.name, builderIntent.args);
      builder = null;
      builderIntent = null;
      persist();
      await refresh();
      navigate("workout/" + receipt.id);
      toast("Workout plan saved");
    } else if (form.id === "set-form") {
      const values = new FormData(form), step = session.queue[session.index], actual = clone(step.target);
      actual.reps = values.get("reps") === "" ? null : Number(values.get("reps"));
      actual.load = values.get("load") === "" ? null : Number(values.get("load"));
      actual.unit = values.get("unit") || null;
      if (actual.load !== null && !actual.unit) throw Error("Choose lb or kg for the weight.");
      if (actual.reps === null) throw Error("Enter the reps you completed, or skip this set.");
      await soundUnlock();
      finishSet(session, actual, Date.now());
      beep(true);
      persist();
    } else if (form.id === "review-form") {
      session.pending ??= { operationId: session.operationId, workout: completedWorkout(session) };
      persist();
      busy = true;
      render();
      const receipt = await rpc("create_workout", session.pending);
      session = null;
      persist();
      await refresh();
      navigate("workout/" + receipt.id);
      toast("Session saved. Nice work.");
    }
  } catch (e3) {
    errorText = e3.message;
    toast(e3.message);
    if (form.id === "builder-form" && (e3.status === 400 || e3.status === 409)) {
      builderConflict = e3.status === 409 && !!builder?.id;
      builderIntent = null;
      persist();
    }
    if (form.id === "review-form" && e3.status === 400 && session) {
      session.pending = null;
      persist();
    }
  } finally {
    busy = false;
    render();
    await syncWake();
  }
});
window.addEventListener("hashchange", () => {
  if (session?.timer?.running && location.hash !== "#session") {
    pauseTimer(session, Date.now());
    persist();
  }
  errorText = "";
  library.hydrate(location.hash.slice(1));
  render();
  window.scrollTo(0, 0);
  syncWake();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && session) {
    pauseTimer(session, Date.now());
    persist();
  }
  syncWake();
});
window.addEventListener("pagehide", () => {
  if (session) {
    pauseTimer(session, Date.now());
    persist();
  }
});
setInterval(() => {
  if (!session?.timer?.running) return;
  const result = tick(session, Date.now());
  const t2 = session.timer;
  if (result) {
    if (result === "suspended") {
      toast("Timer paused while the browser was inactive. Resume when ready.");
      restored = true;
    } else beep(true);
    persist();
    render();
    syncWake();
  } else {
    const n2 = Math.ceil(remaining(t2, Date.now()));
    const el = $2("#timer-value");
    if (el) el.textContent = formatTime(n2);
    if (n2 <= 3 && n2 > 0 && n2 !== lastBeep) {
      lastBeep = n2;
      beep();
    }
    if (n2 > 3) lastBeep = -1;
    t2.remaining = remaining(t2, Date.now());
  }
}, 150);
var authConfig;
function connectionScreen(message = "") {
  document.querySelector(".bottom-nav").hidden = true;
  $2("#sign-out").hidden = true;
  app.innerHTML = `<div class="narrow sign-in"><div class="eyebrow">Runtime Ready \xB7 Training Companion</div><h1>Your space to<br>get stronger.</h1><p class="muted">Plan a workout, log what you did, and pick up where you left off.</p>${message ? `<p class="notice" role="status">${escape(message)}</p>` : ""}${authConfig?.preview ? '<div class="card"><h2>Try a sample training space</h2><p class="help">Two separate accounts with sample workouts. Changes stay on this computer.</p><div class="actions"><button data-login="sample-a">Open Alex\u2019s space</button><button class="secondary" data-login="sample-b">Open Sam\u2019s space</button></div></div>' : `<button id="sign-in" ${authConfig?.clientId ? "" : "disabled"}>Sign in to your training space \u2192</button>`}<p class="help">Your workouts are private to your account.</p></div>`;
  app.querySelectorAll("[data-login]").forEach((button) => button.onclick = () => signIn(button.dataset.login).catch((e3) => toast(e3.message)));
  if ($2("#sign-in")) $2("#sign-in").onclick = () => signIn().catch((e3) => toast(e3.message));
}
async function openAccount() {
  profile = await rpc("get_profile");
  $2("#account").textContent = profile.name + " \xB7 private space";
  $2("#sign-out").hidden = false;
  storageKey = "rr-training-draft-v1:" + profile.athleteId;
  loadDraft();
  await refresh();
  await library.hydrate(location.hash.slice(1));
  render();
  await syncWake();
}
async function init() {
  try {
    authConfig = await initializeAuth();
    if (authConfig.redirecting) return;
    if (authConfig.preview) $2("#preview-banner").hidden = false;
    await openAccount();
  } catch (e3) {
    authConfig = e3.authConfig ?? authConfig;
    profile = null;
    connectionScreen(e3.status === 401 || ["login_required", "missing_refresh_token"].includes(e3.error) ? "" : e3.message);
    if (e3.code === "not_a_member" && !authConfig?.preview) {
      const button = document.createElement("button");
      button.textContent = "Create my test training space";
      button.onclick = async () => {
        button.disabled = true;
        try {
          await activateAccount();
          await openAccount();
        } catch (err) {
          toast(err.message);
          button.disabled = false;
        }
      };
      app.querySelector(".sign-in").append(button);
    }
  }
}
$2("#sign-out").onclick = async () => {
  if (busy || library.isBusy()) {
    toast("Wait for the current save before signing out.");
    return;
  }
  if (session) pauseTimer(session, Date.now());
  persist();
  session = null;
  builder = null;
  builderIntent = null;
  profile = null;
  workouts = [];
  library.clear();
  storageKey = "";
  await syncWake();
  connectionScreen();
  try {
    await signOut();
  } catch (e3) {
    toast(e3.message);
  }
};
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
init();
document.querySelectorAll('[data-nav="library"]').forEach((link) => link.addEventListener("click", (event) => {
  event.preventDefault();
  library.open();
}));
