import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  setPersistence,
  signInWithEmailLink,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";

const $ = (id) => document.getElementById(id);
const localDay = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const localInput = (date) => `${localDay(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const timeLabel = (date) => new Date(date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const names = { feed: "Feed", wee: "Wee", poo: "Poo", both: "Wee + poo", sleep: "Sleep" };
const symbols = { feed: "♡", wee: "♧", poo: "≋", both: "≋", sleep: "☾" };
const includes = (entry, type) => entry.type === type || (entry.type === "both" && (type === "wee" || type === "poo"));
const sizeLabel = (size) => ({ small: "Small", medium: "Medium", large: "Large" })[size] || "";
let selectedDay = localDay(new Date());
let filter = "all";
let entries = [];
let sleepSessions = [];
let activeSleep = null;
let undoAction = null;
let toastTimer;
let auth;
let db;
let currentUser;
let members = [];
let stopEntries;
let stopMembership;
let stopMembers;
let stopSleep;
let demo = true;
let wizard = null;

function setStatus(message, mode = "") {
  $("app-status-text").textContent = message;
  $("app-status").dataset.mode = mode;
}

function showSignIn(message = "Use the email address assigned to your Riley account.") {
  $("tracker-app").hidden = true;
  $("sign-in-panel").hidden = false;
  $("access-pending").hidden = true;
  $("account-controls").hidden = true;
  $("auth-message").textContent = message;
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function durationLabel(start, end) {
  if (!end) return "Still asleep";
  const elapsed = Math.max(0, new Date(end) - new Date(start));
  const minutes = Math.round(elapsed / 60000);
  if (elapsed > 0 && minutes === 0) return "Under 1 min";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder} min`;
}

function detail(entry) {
  const parts = [];
  if (entry.type === "feed") {
    parts.push(entry.method === "bottle" ? "Bottle" : "Breast");
    if (entry.method === "bottle" && entry.amount) parts.push(`${entry.amount} ml`);
    if (entry.method === "breast") {
      if (entry.leftMinutes || entry.rightMinutes) {
        const sides = [];
        if (entry.leftMinutes) sides.push(`Left ${entry.leftMinutes} min`);
        if (entry.rightMinutes) sides.push(`Right ${entry.rightMinutes} min`);
        parts.push(sides.join(" + "));
        if (entry.startedSide) parts.push(`Started ${entry.startedSide}`);
      } else {
        if (entry.side) parts.push(entry.side === "Both" ? "Both sides" : `${entry.side} side`);
        if (entry.duration) parts.push(`${entry.duration} min`);
      }
    }
  } else if (entry.type === "sleep") {
    parts.push(entry.endTime ? `${timeLabel(entry.time)}–${timeLabel(entry.endTime)}` : `Started ${timeLabel(entry.time)}`);
    parts.push(durationLabel(entry.time, entry.endTime));
  } else {
    parts.push(entry.type === "both" ? "Wet + dirty diaper" : entry.type === "wee" ? "Wet diaper" : "Dirty diaper");
    if (entry.wetSize) parts.push(`Wee ${sizeLabel(entry.wetSize).toLowerCase()}`);
    if (entry.stoolSize) parts.push(`Poo ${sizeLabel(entry.stoolSize).toLowerCase()}`);
  }
  if (entry.person) parts.push(entry.person);
  return parts.join(" · ");
}

function render() {
  const today = localDay(new Date());
  const date = new Date(`${selectedDay}T12:00:00`);
  const isToday = selectedDay === today;
  $("day-label").textContent = isToday ? "Today" : date.toLocaleDateString([], { weekday: "long" });
  $("date-label").textContent = date.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
  $("next-day").disabled = selectedDay >= today;
  $("timeline-title").textContent = isToday ? "Today’s timeline" : "The day’s timeline";
  $("summary-period").textContent = isToday ? "Today so far" : date.toLocaleDateString([], { month: "long", day: "numeric" });
  const dayStart = new Date(`${selectedDay}T00:00:00`);
  const dayEnd = new Date(`${selectedDay}T00:00:00`);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const candidates = demo ? entries : [...entries, ...sleepSessions];
  const dayEntries = [...new Map(candidates.filter((entry) => {
    const start = new Date(entry.time);
    if (entry.type !== "sleep") return localDay(start) === selectedDay;
    const end = entry.endTime ? new Date(entry.endTime) : null;
    return start < dayEnd && (!end || end > dayStart);
  }).map((entry) => [entry.id, entry])).values()].sort((a, b) => new Date(b.time) - new Date(a.time));
  const shown = dayEntries.filter((entry) => filter === "all" || includes(entry, filter));
  $("event-count").textContent = `${shown.length} ${shown.length === 1 ? "moment" : "moments"}`;
  document.querySelectorAll("[data-filter]").forEach((button) => {
    const active = button.dataset.filter === filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  $("timeline").replaceChildren();
  shown.forEach((entry) => {
    const item = element("li", "");
    const button = element("button", "timeline-entry");
    button.type = "button";
    button.setAttribute("aria-label", `Edit ${names[entry.type]} at ${timeLabel(entry.time)}`);
    const time = element("span", "entry-time", timeLabel(entry.time));
    const icon = element("span", `entry-symbol ${entry.type === "both" ? "poo" : entry.type}`, symbols[entry.type]);
    icon.setAttribute("aria-hidden", "true");
    const body = element("span", "entry-body");
    body.append(element("strong", "", names[entry.type]), element("span", "detail", detail(entry)));
    if (entry.note) body.append(element("span", "note", entry.note));
    const arrow = element("span", "entry-arrow", "↗");
    arrow.setAttribute("aria-hidden", "true");
    button.append(time, icon, body, arrow);
    button.addEventListener("click", () => openEntry(entry.type, entry));
    item.append(button);
    $("timeline").append(item);
  });
  $("empty").hidden = shown.length > 0;
  $("summary").replaceChildren();
  ["feed", "wee", "poo", "sleep"].forEach((type) => {
    const row = element("div", "stat-row");
    const label = type === "sleep" ? "Sleep sessions" : `${names[type]}s`;
    row.append(element("span", "", label), element("strong", "", String(dayEntries.filter((entry) => includes(entry, type)).length)));
    $("summary").append(row);
  });
  const latest = dayEntries.find((entry) => entry.type === "feed");
  $("last-feed").textContent = latest ? `${timeLabel(latest.time)} · ${latest.method === "bottle" ? "Bottle" : "Breast"}` : "No feed recorded";
  renderSleepAction();
}

function renderSleepAction() {
  $("sleep-action-title").textContent = activeSleep ? "Wake up" : "Sleep";
  $("sleep-action-hint").textContent = activeSleep ? `Sleeping since ${timeLabel(activeSleep.time)}` : "Start or log sleep";
  $("sleep-action-card").setAttribute("aria-label", activeSleep ? "Wake Riley" : "Start or log sleep");
  $("sleep-action-card").querySelector(".plus").textContent = activeSleep ? "✓" : "+";
}

function setCaregiverOptions(selected) {
  const select = $("entry-person");
  const namesList = members.map((member) => member.name).filter(Boolean);
  if (!namesList.length) namesList.push("Caregiver");
  select.replaceChildren(...namesList.map((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    return option;
  }));
  if (namesList.includes(selected)) select.value = selected;
}

function syncFields() {
  const type = $("entry-type").value;
  const isFeed = type === "feed";
  const breast = $("feed-method").value === "breast";
  $("feed-fields").hidden = !isFeed;
  $("breast-fields").hidden = !isFeed || !breast;
  $("bottle-fields").hidden = !isFeed || breast;
  $("diaper-fields").hidden = !["wee", "poo", "both"].includes(type);
  $("wet-size-label").hidden = !["wee", "both"].includes(type);
  $("stool-size-label").hidden = !["poo", "both"].includes(type);
  $("sleep-end-label").hidden = type !== "sleep";
  $("dialog-title").textContent = `Edit ${names[type].toLowerCase()}`;
}

function defaultTime() {
  const now = new Date();
  return selectedDay === localDay(now) ? now : new Date(`${selectedDay}T12:00:00`);
}

function openEntry(type, entry) {
  wizard = null;
  $("entry-wizard").hidden = true;
  $("entry-form").hidden = false;
  $("entry-form").reset();
  $("entry-time").setCustomValidity("");
  $("entry-id").value = entry?.id || "";
  $("entry-type").value = type;
  const now = new Date();
  const time = entry?.time ? new Date(entry.time) : defaultTime();
  $("entry-time").value = localInput(time);
  $("entry-time").max = localInput(now);
  const startSide = entry?.startedSide || ((entry?.side === "Left" || entry?.side === "Right") ? entry.side : "");
  $("feed-method").value = entry?.method || "breast";
  $("feed-started").value = startSide;
  $("feed-left-minutes").value = entry?.leftMinutes || (entry?.side === "Left" ? entry.duration || "" : "");
  $("feed-right-minutes").value = entry?.rightMinutes || (entry?.side === "Right" ? entry.duration || "" : "");
  $("feed-legacy-duration").value = entry?.leftMinutes || entry?.rightMinutes || entry?.side !== "Both" ? "" : entry?.duration || "";
  $("feed-legacy-label").hidden = !(entry?.method === "breast" && entry?.side === "Both" && entry?.duration && !entry?.leftMinutes && !entry?.rightMinutes);
  $("feed-amount").value = entry?.amount || "";
  $("wet-size").value = entry?.wetSize || "";
  $("stool-size").value = entry?.stoolSize || "";
  $("sleep-end-time").value = entry?.endTime ? localInput(new Date(entry.endTime)) : "";
  $("entry-person").value = entry?.person || currentMemberName();
  setCaregiverOptions(entry?.person || currentMemberName());
  $("entry-note").value = entry?.note || "";
  $("delete-entry").hidden = !entry;
  syncFields();
  $("entry-dialog").showModal();
}

function currentMemberName() {
  return members.find((member) => member.id === currentUser?.uid)?.name || members[0]?.name || "";
}

function stepsForWizard() {
  const state = wizard;
  if (state.category === "feed") {
    const steps = [
      { key: "method", title: "What kind of feed?", kind: "choice", choices: [["breast", "Breast"], ["bottle", "Bottle"]] },
      { key: "time", title: "What time?", kind: "time", label: "Today by default" },
    ];
    if (state.values.method === "breast") {
      steps.push({ key: "side", title: "Which side?", kind: "choice", choices: [["Left", "Left"], ["Right", "Right"], ["Both", "Both"]] });
      if (state.values.side === "Both") steps.push({ key: "startedSide", title: "Which side did Riley start on?", kind: "choice", choices: [["Left", "Left"], ["Right", "Right"]] });
      const sides = state.values.side === "Both" ? [state.values.startedSide, state.values.startedSide === "Left" ? "Right" : "Left"] : [state.values.side];
      sides.filter(Boolean).forEach((side) => steps.push({ key: `${side.toLowerCase()}Minutes`, title: `Minutes on the ${side.toLowerCase()}?`, kind: "number", label: "Optional", suffix: "min" }));
    } else {
      steps.push({ key: "amount", title: "How much?", kind: "number", label: "Bottle amount (optional)", suffix: "ml" });
    }
    steps.push({ key: "details", title: "Anything else?", kind: "details" });
    return steps;
  }
  if (state.category === "diaper") {
    const steps = [{ key: "type", title: "What was in the diaper?", kind: "choice", choices: [["wee", "Wee"], ["poo", "Poo"], ["both", "Both"]] }];
    if (["wee", "both"].includes(state.values.type)) steps.push({ key: "wetSize", title: "How much wee?", kind: "choice", choices: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] });
    if (["poo", "both"].includes(state.values.type)) steps.push({ key: "stoolSize", title: "How much poo?", kind: "choice", choices: [["small", "Small"], ["medium", "Medium"], ["large", "Large"]] });
    steps.push({ key: "time", title: "What time?", kind: "time", label: "Today by default" }, { key: "details", title: "Anything else?", kind: "details" });
    return steps;
  }
  if (state.category === "sleep") {
    return [
      { key: "startTime", title: "When did sleep start?", kind: "time", label: "Today by default" },
      { key: "endTime", title: "When did Riley wake up?", kind: "time", label: "Choose the wake time" },
      { key: "details", title: "Anything else?", kind: "details" },
    ];
  }
  return [];
}

function wizardTimeDefault(key) {
  const now = new Date();
  if (key === "startTime" && selectedDay === localDay(now)) return new Date(now.getTime() - 45 * 60000);
  if (key === "endTime" && selectedDay === localDay(now)) return now;
  if (key === "endTime") return new Date(defaultTime().getTime() + 45 * 60000);
  return defaultTime();
}

function renderWizard() {
  const steps = stepsForWizard();
  const step = steps[wizard.step];
  $("dialog-title").textContent = wizard.category === "feed" ? "Record a feed" : wizard.category === "diaper" ? "Record a diaper" : "Log sleep";
  $("wizard-progress").textContent = `STEP ${wizard.step + 1}`;
  const content = $("wizard-content");
  content.replaceChildren();
  content.append(element("h3", "wizard-title", step.title));
  if (step.kind === "choice") {
    const choices = element("div", "wizard-choices");
    step.choices.forEach(([value, label]) => {
      const button = element("button", `choice-button${wizard.values[step.key] === value ? " selected" : ""}`, label);
      button.type = "button";
      button.setAttribute("aria-pressed", String(wizard.values[step.key] === value));
      button.addEventListener("click", () => {
        wizard.values[step.key] = value;
        const newSteps = stepsForWizard();
        wizard.step = Math.min(wizard.step + 1, newSteps.length - 1);
        renderWizard();
      });
      choices.append(button);
    });
    content.append(choices);
  } else if (step.kind === "time") {
    const label = document.createElement("label");
    label.className = "wizard-label";
    label.textContent = step.label;
    const input = document.createElement("input");
    input.type = "datetime-local";
    input.id = "wizard-input";
    input.required = true;
    input.max = localInput(new Date());
    input.value = wizard.values[step.key] || localInput(wizardTimeDefault(step.key));
    label.append(input);
    content.append(label);
  } else if (step.kind === "number") {
    const label = document.createElement("label");
    label.className = "wizard-label";
    label.textContent = step.label;
    const input = document.createElement("input");
    input.type = "number";
    input.id = "wizard-input";
    input.min = "1";
    input.max = step.key === "amount" ? "2000" : "300";
    input.step = "1";
    input.inputMode = "numeric";
    input.placeholder = `Enter ${step.suffix}`;
    input.value = wizard.values[step.key] || "";
    label.append(input);
    content.append(label);
  } else if (step.kind === "details") {
    const caregiverLabel = element("label", "wizard-label", "Caregiver");
    const select = document.createElement("select");
    select.id = "wizard-caregiver";
    setCaregiverOptions(wizard.values.person || currentMemberName());
    [...$("entry-person").options].forEach((option) => select.append(option.cloneNode(true)));
    select.value = wizard.values.person || currentMemberName();
    caregiverLabel.append(select);
    const noteLabel = element("label", "wizard-label", "A note (optional)");
    const note = document.createElement("textarea");
    note.id = "wizard-note";
    note.rows = 2;
    note.maxLength = 300;
    note.placeholder = "Anything you’d like to remember";
    note.value = wizard.values.note || "";
    noteLabel.append(note);
    content.append(caregiverLabel, noteLabel);
  }
  $("wizard-back").hidden = wizard.step === 0;
  $("wizard-next").hidden = step.kind === "choice";
  const last = wizard.step === steps.length - 1;
  $("wizard-next").innerHTML = last ? 'Save moment <span aria-hidden="true">↗</span>' : 'Next <span aria-hidden="true">↗</span>';
}

function openWizard(category) {
  wizard = { category, step: 0, values: {} };
  $("entry-form").hidden = true;
  $("entry-wizard").hidden = false;
  $("delete-entry").hidden = true;
  $("entry-dialog").showModal();
  renderWizard();
}

function collectWizardValue() {
  const steps = stepsForWizard();
  const step = steps[wizard.step];
  if (step.kind === "time" || step.kind === "number") {
    const input = $("wizard-input");
    if (step.kind === "time" && (!input.value || !Number.isFinite(new Date(input.value).getTime()) || new Date(input.value) > new Date())) {
      input.setCustomValidity("Choose a valid time that is not in the future.");
      input.reportValidity();
      return false;
    }
    if (step.kind === "number" && input.value && !input.checkValidity()) {
      input.reportValidity();
      return false;
    }
    wizard.values[step.key] = input.value;
  } else if (step.kind === "details") {
    wizard.values.person = $("wizard-caregiver").value;
    wizard.values.note = $("wizard-note").value.trim();
  }
  return true;
}

function buildWizardEntry() {
  const values = wizard.values;
  if (wizard.category === "feed") {
    const entry = { type: "feed", method: values.method, time: new Date(values.time), person: values.person, note: values.note || "" };
    if (values.method === "bottle") {
      if (values.amount) entry.amount = Number(values.amount);
    } else {
      entry.side = values.side;
      if (values.side === "Both") entry.startedSide = values.startedSide;
      const firstSide = values.side === "Both" ? values.startedSide : values.side;
      const firstKey = `${firstSide.toLowerCase()}Minutes`;
      const otherSide = firstSide === "Left" ? "Right" : "Left";
      const otherKey = `${otherSide.toLowerCase()}Minutes`;
      if (values[firstKey]) entry[ firstSide === "Left" ? "leftMinutes" : "rightMinutes" ] = Number(values[firstKey]);
      if (values.side === "Both" && values[otherKey]) entry[ otherSide === "Left" ? "leftMinutes" : "rightMinutes" ] = Number(values[otherKey]);
    }
    return entry;
  }
  if (wizard.category === "diaper") {
    const entry = { type: values.type, time: new Date(values.time), person: values.person, note: values.note || "" };
    if (values.wetSize) entry.wetSize = values.wetSize;
    if (values.stoolSize) entry.stoolSize = values.stoolSize;
    return entry;
  }
  return { type: "sleep", time: new Date(values.startTime), endTime: new Date(values.endTime), person: values.person, note: values.note || "" };
}

async function saveEntry(entry, id) {
  if (demo) {
    const localEntry = { ...entry, time: entry.time.toISOString(), endTime: entry.endTime ? entry.endTime.toISOString() : null, id: id || crypto.randomUUID() };
    entries = id ? entries.map((existing) => existing.id === id ? localEntry : existing) : [...entries, localEntry];
  } else if (id) {
    const saved = { ...entry, time: Timestamp.fromDate(entry.time), updatedAt: Timestamp.now() };
    if (entry.endTime) saved.endTime = Timestamp.fromDate(entry.endTime);
    else if (entry.type === "sleep") saved.endTime = null;
    await updateDoc(doc(db, "households", "riley", "events", id), saved);
  } else {
    const saved = { ...entry, time: Timestamp.fromDate(entry.time), createdBy: currentUser.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
    if (entry.endTime) saved.endTime = Timestamp.fromDate(entry.endTime);
    else if (entry.type === "sleep") saved.endTime = null;
    await addDoc(collection(db, "households", "riley", "events"), saved);
  }
}

function notify(message, undo) {
  clearTimeout(toastTimer);
  undoAction = undo || null;
  $("toast-text").textContent = message;
  $("undo").hidden = !undo;
  $("toast").hidden = false;
  toastTimer = setTimeout(() => {
    $("toast").hidden = true;
    undoAction = null;
  }, undo ? 12000 : 4500);
}

function seedDemo() {
  const now = new Date();
  const elapsed = now.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const sample = [
    { type: "feed", method: "breast", side: "Both", startedSide: "Left", leftMinutes: 12, rightMinutes: 8, person: "Kane", note: "A quiet cuddle afterwards." },
    { type: "wee", wetSize: "medium", person: "Aidan" },
    { type: "feed", method: "bottle", amount: 70, person: "Aidan" },
    { type: "both", wetSize: "small", stoolSize: "medium", person: "Kane" },
    { type: "sleep", endTime: null, person: "Kane" },
    { type: "feed", method: "breast", side: "Right", rightMinutes: 15, startedSide: "Right", person: "Kane" },
  ];
  entries = sample.map((entry, i) => {
    const time = new Date(now.getTime() - elapsed * (0.08 + i * 0.15));
    const endTime = entry.type === "sleep" ? new Date(Math.min(time.getTime() + 40 * 60000, now.getTime())).toISOString() : undefined;
    return { id: crypto.randomUUID(), note: "", ...entry, time: time.toISOString(), endTime };
  });
  activeSleep = null;
  selectedDay = localDay(now);
  filter = "all";
  render();
}

function mapFirestoreEvent(eventDoc) {
  const data = eventDoc.data();
  return {
    id: eventDoc.id,
    ...data,
    time: data.time.toDate().toISOString(),
    endTime: data.endTime?.toDate ? data.endTime.toDate().toISOString() : data.endTime || null,
  };
}

function subscribeToDay() {
  stopEntries?.();
  const start = new Date(`${selectedDay}T00:00:00`);
  const end = new Date(`${selectedDay}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const events = collection(db, "households", "riley", "events");
  const eventQuery = query(events, where("time", ">=", Timestamp.fromDate(start)), where("time", "<", Timestamp.fromDate(end)), orderBy("time", "desc"));
  stopEntries = onSnapshot(eventQuery, (snapshot) => {
    entries = snapshot.docs.map(mapFirestoreEvent);
    render();
    setStatus("Shared Riley records", "live");
  }, (error) => {
    console.error("Riley records could not be loaded", error);
    setStatus("Could not load Riley records. Check Firebase setup and access.", "error");
    notify("Could not load shared moments. Try refreshing.");
  });
}

function subscribeToActiveSleep() {
  stopSleep?.();
  const sleepQuery = query(collection(db, "households", "riley", "events"), where("type", "==", "sleep"));
  stopSleep = onSnapshot(sleepQuery, (snapshot) => {
    sleepSessions = snapshot.docs.map(mapFirestoreEvent);
    activeSleep = sleepSessions.find((session) => !session.endTime) || null;
    render();
  }, (error) => {
    console.error("Riley's active sleep could not be loaded", error);
    notify("Could not check sleep status. Try refreshing.");
  });
}

async function startSleepNow() {
  if (activeSleep) return notify("Riley is already marked as sleeping.");
  const now = new Date();
  selectedDay = localDay(now);
  const person = currentMemberName();
  const entry = { type: "sleep", time: now, endTime: null, person, note: "" };
  try {
    await saveEntry(entry);
    if (demo) {
      activeSleep = entries.find((item) => item.type === "sleep" && !item.endTime) || null;
      render();
    } else {
      subscribeToDay();
    }
    notify("Sleep started.");
  } catch (error) {
    console.error("Sleep could not be started", error);
    notify("Could not start sleep. Check your connection and try again.");
  }
}

async function endSleepNow() {
  if (!activeSleep) return;
  const endTime = new Date();
  try {
    if (demo) {
      entries = entries.map((entry) => entry.id === activeSleep.id ? { ...entry, endTime: endTime.toISOString() } : entry);
      activeSleep = null;
      render();
    } else {
      await updateDoc(doc(db, "households", "riley", "events", activeSleep.id), { endTime: Timestamp.fromDate(endTime), updatedAt: Timestamp.now() });
      subscribeToDay();
    }
    notify("Sleep ended.");
  } catch (error) {
    console.error("Sleep could not be ended", error);
    notify("Could not end sleep. Try again.");
  }
}

function chooseSleepAction() {
  if (activeSleep) return endSleepNow();
  wizard = { category: "sleep-choice", step: 0, values: {} };
  $("entry-form").hidden = true;
  $("entry-wizard").hidden = false;
  $("dialog-title").textContent = "Sleep";
  $("wizard-progress").textContent = "QUICK ACTION";
  const content = $("wizard-content");
  content.replaceChildren(element("h3", "wizard-title", "How would you like to log sleep?"));
  const choices = element("div", "wizard-choices");
  [["start", "Start sleep now"], ["manual", "Log a past sleep"]].forEach(([value, label]) => {
    const button = element("button", "choice-button", label);
    button.type = "button";
    button.addEventListener("click", () => {
      $("entry-dialog").close();
      if (value === "start") startSleepNow(); else openWizard("sleep");
    });
    choices.append(button);
  });
  content.append(choices);
  $("wizard-back").hidden = true;
  $("wizard-next").hidden = true;
  $("entry-dialog").showModal();
}

function openSleepChoice() {
  chooseSleepAction();
}

function onMembersLoaded(snapshot) {
  members = snapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }));
  setCaregiverOptions(currentMemberName());
}

function initializeHousehold(user) {
  currentUser = user;
  stopMembership?.();
  stopMembers?.();
  $("sign-in-panel").hidden = true;
  const memberRef = doc(db, "households", "riley", "members", user.uid);
  stopMembership = onSnapshot(memberRef, (memberSnapshot) => {
    if (!memberSnapshot.exists()) {
      stopEntries?.();
      stopMembers?.();
      stopSleep?.();
      $("access-pending").hidden = false;
      $("auth-uid").textContent = user.uid;
      $("sign-in-panel").hidden = false;
      $("tracker-app").hidden = true;
      $("auth-message").textContent = "Your email is verified, but this account needs to be added to the household.";
      $("account-controls").hidden = true;
      setStatus("Household access is not set up yet", "error");
      return;
    }
    const member = memberSnapshot.data();
    $("account-name").textContent = member.name || user.email;
    $("account-controls").hidden = false;
    $("tracker-app").hidden = false;
    $("storage-note").textContent = "Shared securely with your household";
    $("entry-hint").textContent = "Shared with your household as soon as you save.";
    setStatus("Shared Riley records", "live");
    stopMembers?.();
    stopMembers = onSnapshot(collection(db, "households", "riley", "members"), onMembersLoaded, (error) => {
      console.error("Riley household members could not be loaded", error);
      setStatus("Could not load household members", "error");
    });
    subscribeToDay();
    subscribeToActiveSleep();
  }, (error) => {
    console.error("Riley household access could not be checked", error);
    showSignIn("Could not check household access. Confirm Firestore rules are installed.");
    setStatus("Could not check household access", "error");
  });
}

const firebaseConfig = {
  apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY,
  authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID,
  appId: import.meta.env.PUBLIC_FIREBASE_APP_ID,
};
const configValues = Object.values(firebaseConfig);
const hasFirebaseConfig = configValues.every(Boolean);

if (!configValues.some(Boolean)) {
  demo = true;
  members = [{ id: "demo-aidan", name: "Aidan" }, { id: "demo-kane", name: "Kane" }];
  $("sign-in-panel").hidden = true;
  $("tracker-app").hidden = false;
  $("storage-note").textContent = "Design preview · no shared storage yet";
  $("entry-hint").textContent = "Demo only. Entries disappear when you refresh.";
  $("reset-demo").hidden = false;
  setStatus("Interactive proposal · sample data");
  seedDemo();
} else if (!hasFirebaseConfig) {
  showSignIn("Firebase is only partly configured. Add all four public Firebase settings.");
  setStatus("Firebase configuration is incomplete", "error");
} else {
  demo = false;
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).then(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const emailLink = window.location.href;
      let email = window.localStorage.getItem("riley:emailForSignIn");
      if (!email) email = window.prompt("Confirm the email address you used to request this sign-in link.");
      if (email) {
        signInWithEmailLink(auth, email, emailLink)
          .then(() => {
            window.localStorage.removeItem("riley:emailForSignIn");
            window.history.replaceState({}, document.title, window.location.pathname);
          })
          .catch((error) => {
            console.error("Riley sign-in link could not be completed", error);
            showSignIn("That sign-in link could not be verified. Request a fresh link and open it in this browser.");
          });
      } else showSignIn("Enter the email address used to request this sign-in link.");
    }
    onAuthStateChanged(auth, (user) => {
      if (!user) {
        currentUser = undefined;
        members = [];
        sleepSessions = [];
        activeSleep = null;
        stopEntries?.();
        stopMembership?.();
        stopMembers?.();
        stopSleep?.();
        showSignIn();
        setStatus("Sign in to view Riley records");
      } else initializeHousehold(user);
    });
  }).catch((error) => {
    console.error("Riley Firebase could not be initialized", error);
    showSignIn("Firebase could not start. Check the project configuration.");
    setStatus("Firebase setup error", "error");
  });
}

$("sign-in-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!auth) return;
  const email = $("auth-email").value.trim();
  const submit = $("sign-in-submit");
  submit.disabled = true;
  try {
    await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/riley/`, handleCodeInApp: true });
    window.localStorage.setItem("riley:emailForSignIn", email);
    $("auth-message").textContent = "Check your email for the sign-in link. It will return you to Riley.";
  } catch (error) {
    console.error("Riley sign-in link could not be sent", error);
    $("auth-message").textContent = "Could not send the sign-in link. Check the email and Firebase authorized domains.";
  } finally {
    submit.disabled = false;
  }
});

$("copy-auth-uid").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("auth-uid").textContent);
    notify("Account ID copied.");
  } catch {
    notify("Select and copy the account ID above.");
  }
});

$("sign-out").addEventListener("click", () => signOut(auth).catch((error) => console.error("Riley sign-out failed", error)));
document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => {
  if (button.dataset.add === "feed") openWizard("feed");
  else if (button.dataset.add === "diaper") openWizard("diaper");
  else openSleepChoice();
}));
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.filter; render(); }));
$("entry-type").addEventListener("change", syncFields);
$("feed-method").addEventListener("change", syncFields);
["close-dialog", "cancel-dialog", "wizard-cancel"].forEach((id) => $(id).addEventListener("click", () => $("entry-dialog").close()));
$("wizard-back").addEventListener("click", () => {
  if (wizard?.category === "sleep-choice") return;
  if (wizard && wizard.step > 0) {
    collectWizardValue();
    wizard.step -= 1;
    renderWizard();
  }
});
$("wizard-next").addEventListener("click", async () => {
  if (!wizard || !collectWizardValue()) return;
  const steps = stepsForWizard();
  if (wizard.step < steps.length - 1) {
    wizard.step += 1;
    renderWizard();
    return;
  }
  const entry = buildWizardEntry();
  if (entry.type === "sleep" && (!entry.endTime || entry.endTime <= entry.time || entry.endTime > new Date())) {
    notify("Choose a wake time after sleep began and not in the future.");
    wizard.step = stepsForWizard().findIndex((step) => step.key === "endTime");
    renderWizard();
    return;
  }
  try {
    await saveEntry(entry);
    if (demo) {
      if (entry.type === "sleep" && !entry.endTime) activeSleep = entries[entries.length - 1];
      selectedDay = localDay(entry.time);
      render();
    } else {
      selectedDay = localDay(entry.time);
      subscribeToDay();
    }
    filter = "all";
    $("entry-dialog").close();
    notify("Moment added.");
  } catch (error) {
    console.error("Riley moment could not be saved", error);
    notify("Could not save that moment. Check your connection and try again.");
  }
});

$("entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const timestamp = new Date($("entry-time").value);
  const type = $("entry-type").value;
  const endInput = $("sleep-end-time").value;
  const endTime = endInput ? new Date(endInput) : null;
  if (!Number.isFinite(timestamp.getTime()) || timestamp > new Date()) {
    $("entry-time").setCustomValidity("Choose a valid time that is not in the future.");
    $("entry-time").reportValidity();
    return;
  }
  if (type === "sleep" && endTime && (endTime <= timestamp || endTime > new Date())) {
    $("sleep-end-time").setCustomValidity("Choose a wake time after sleep began and not in the future.");
    $("sleep-end-time").reportValidity();
    return;
  }
  const id = $("entry-id").value;
  const entry = { type, time: timestamp, person: $("entry-person").value, note: $("entry-note").value.trim() };
  if (type === "feed") {
    entry.method = $("feed-method").value;
    if (entry.method === "breast") {
      const left = $("feed-left-minutes").value;
      const right = $("feed-right-minutes").value;
      entry.startedSide = $("feed-started").value || "";
      if (left) entry.leftMinutes = Number(left);
      if (right) entry.rightMinutes = Number(right);
      if (left && right) entry.side = "Both";
      else if (left) entry.side = "Left";
      else if (right) entry.side = "Right";
      else entry.side = "";
      if ($("feed-legacy-duration").value) entry.duration = Number($("feed-legacy-duration").value);
    } else if ($("feed-amount").value) entry.amount = Number($("feed-amount").value);
  } else if (["wee", "poo", "both"].includes(type)) {
    if ($("wet-size").value) entry.wetSize = $("wet-size").value;
    if ($("stool-size").value) entry.stoolSize = $("stool-size").value;
  } else if (type === "sleep") entry.endTime = endTime;
  try {
    await saveEntry(entry, id);
    selectedDay = localDay(timestamp);
    filter = "all";
    $("entry-dialog").close();
    if (demo) {
      if (activeSleep?.id === id) activeSleep = entry.endTime ? null : { ...activeSleep, ...entry, time: timestamp.toISOString(), endTime: endTime?.toISOString() || null };
      render();
    } else {
      subscribeToDay();
      if (type === "sleep") subscribeToActiveSleep();
    }
    notify("Moment updated.");
  } catch (error) {
    console.error("Riley moment could not be saved", error);
    notify("Could not save that moment. Check your connection and try again.");
  }
});

$("entry-time").addEventListener("input", () => $("entry-time").setCustomValidity(""));
$("sleep-end-time").addEventListener("input", () => $("sleep-end-time").setCustomValidity(""));
$("delete-entry").addEventListener("click", async () => {
  const deleted = [...entries, ...sleepSessions].find((entry) => entry.id === $("entry-id").value);
  if (!deleted) return;
  try {
    if (demo) entries = entries.filter((entry) => entry.id !== deleted.id);
    else await deleteDoc(doc(db, "households", "riley", "events", deleted.id));
    if (activeSleep?.id === deleted.id) activeSleep = null;
    $("entry-dialog").close();
    if (demo) render(); else { subscribeToDay(); subscribeToActiveSleep(); }
    notify("Moment deleted.", async () => {
      if (demo) entries.push(deleted);
      else {
        const restored = { ...deleted, time: Timestamp.fromDate(new Date(deleted.time)), createdBy: currentUser.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
        if (deleted.endTime) restored.endTime = Timestamp.fromDate(new Date(deleted.endTime));
        delete restored.id;
        await addDoc(collection(db, "households", "riley", "events"), restored);
      }
      if (demo) render(); else { subscribeToDay(); subscribeToActiveSleep(); }
      notify("Moment restored.");
    });
  } catch (error) {
    console.error("Riley moment could not be deleted", error);
    notify("Could not delete that moment. Try again.");
  }
});
$("undo").addEventListener("click", () => undoAction?.());
function changeDay(offset) {
  const date = new Date(`${selectedDay}T12:00:00`);
  date.setDate(date.getDate() + offset);
  selectedDay = localDay(date);
  if (demo) render(); else if (currentUser && !$("tracker-app").hidden) subscribeToDay();
}
$("previous-day").addEventListener("click", () => changeDay(-1));
$("next-day").addEventListener("click", () => changeDay(1));
$("reset-demo").addEventListener("click", () => { seedDemo(); notify("Sample day restored."); });
