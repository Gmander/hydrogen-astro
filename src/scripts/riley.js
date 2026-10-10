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
const names = { feed: "Feed", wee: "Wee", poo: "Poo", both: "Wee + poo" };
const symbols = { feed: "♡", wee: "♧", poo: "≋", both: "≋" };
const includes = (entry, type) => entry.type === type || (entry.type === "both" && (type === "wee" || type === "poo"));
let selectedDay = localDay(new Date());
let filter = "all";
let entries = [];
let undoAction = null;
let toastTimer;
let auth;
let db;
let currentUser;
let members = [];
let stopEntries;
let stopMembership;
let stopMembers;
let demo = true;

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

function detail(entry) {
  const parts = [];
  if (entry.type === "feed") {
    parts.push(entry.method === "bottle" ? "Bottle" : "Breast");
    if (entry.method === "bottle" && entry.amount) parts.push(`${entry.amount} ml`);
    if (entry.method === "breast") {
      if (entry.side) parts.push(entry.side === "Both" ? "Both sides" : `${entry.side} side`);
      if (entry.duration) parts.push(`${entry.duration} min`);
    }
  } else parts.push(entry.type === "both" ? "Wet + dirty nappy" : entry.type === "wee" ? "Wet nappy" : "Dirty nappy");
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
  const dayEntries = entries.filter((entry) => localDay(new Date(entry.time)) === selectedDay).sort((a, b) => new Date(b.time) - new Date(a.time));
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
  ["feed", "wee", "poo"].forEach((type) => {
    const row = element("div", "stat-row");
    row.append(element("span", "", `${names[type]}s`), element("strong", "", String(dayEntries.filter((entry) => includes(entry, type)).length)));
    $("summary").append(row);
  });
  const latest = dayEntries.find((entry) => entry.type === "feed");
  $("last-feed").textContent = latest ? `${timeLabel(latest.time)} · ${latest.method === "bottle" ? "Bottle" : "Breast"}` : "No feed recorded";
}

function syncFields() {
  const isFeed = $("entry-type").value === "feed";
  const breast = $("feed-method").value === "breast";
  $("feed-fields").hidden = !isFeed;
  $("breast-fields").hidden = !breast;
  $("bottle-fields").hidden = breast;
  ["feed-side", "feed-duration"].forEach((id) => ($(id).disabled = !isFeed || !breast));
  $("feed-amount").disabled = !isFeed || breast;
  $("dialog-title").textContent = `${$("entry-id").value ? "Edit" : "Record"} ${names[$("entry-type").value].toLowerCase()}`;
}

function openEntry(type, entry) {
  $("entry-form").reset();
  $("entry-time").setCustomValidity("");
  $("entry-id").value = entry?.id || "";
  $("entry-type").value = type;
  const now = new Date();
  const defaultTime = selectedDay === localDay(now) ? now : new Date(`${selectedDay}T12:00:00`);
  $("entry-time").value = localInput(entry ? new Date(entry.time) : defaultTime);
  $("entry-time").max = localInput(now);
  $("entry-person").value = entry?.person || members[0]?.name || "";
  $("entry-note").value = entry?.note || "";
  $("feed-method").value = entry?.method || "breast";
  $("feed-side").value = entry?.side ?? "Left";
  $("feed-duration").value = entry?.duration || "";
  $("feed-amount").value = entry?.amount || "";
  $("delete-entry").hidden = !entry;
  syncFields();
  $("entry-dialog").showModal();
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
    { type: "feed", method: "breast", side: "Left", duration: "18", person: "Kane", note: "A quiet cuddle afterwards." },
    { type: "wee", person: "Aidan" },
    { type: "feed", method: "bottle", amount: "70", person: "Aidan" },
    { type: "both", person: "Kane" },
    { type: "wee", person: "Kane" },
    { type: "feed", method: "breast", side: "Right", duration: "15", person: "Kane" },
  ];
  entries = sample.map((entry, i) => ({ id: crypto.randomUUID(), note: "", ...entry, time: new Date(now.getTime() - elapsed * (0.08 + i * 0.15)).toISOString() }));
  selectedDay = localDay(now);
  filter = "all";
  render();
}

function subscribeToDay() {
  stopEntries?.();
  const start = new Date(`${selectedDay}T00:00:00`);
  const end = new Date(`${selectedDay}T00:00:00`);
  end.setDate(end.getDate() + 1);
  const events = collection(db, "households", "riley", "events");
  const eventQuery = query(events, where("time", ">=", Timestamp.fromDate(start)), where("time", "<", Timestamp.fromDate(end)), orderBy("time", "desc"));
  stopEntries = onSnapshot(eventQuery, (snapshot) => {
    entries = snapshot.docs.map((eventDoc) => {
      const data = eventDoc.data();
      return { id: eventDoc.id, ...data, time: data.time.toDate().toISOString() };
    });
    render();
    setStatus("Shared Riley records", "live");
  }, (error) => {
    console.error("Riley records could not be loaded", error);
    setStatus("Could not load Riley records. Check Firebase setup and access.", "error");
    notify("Could not load shared moments. Try refreshing.");
  });
}

async function initializeHousehold(user) {
  currentUser = user;
  stopMembership?.();
  stopMembers?.();
  $("sign-in-panel").hidden = true;
  const memberRef = doc(db, "households", "riley", "members", user.uid);
  stopMembership = onSnapshot(memberRef, (memberSnapshot) => {
    if (!memberSnapshot.exists()) {
      stopEntries?.();
      stopMembers?.();
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
    $("access-pending").hidden = true;
    $("account-name").textContent = member.name || user.email;
    $("account-controls").hidden = false;
    $("tracker-app").hidden = false;
    $("storage-note").textContent = "Shared securely with your household";
    $("entry-hint").textContent = "Shared with your household as soon as you save.";
    setStatus("Shared Riley records", "live");
    stopMembers?.();
    stopMembers = onSnapshot(collection(db, "households", "riley", "members"), (snapshot) => {
      members = snapshot.docs.map((memberDoc) => ({ id: memberDoc.id, ...memberDoc.data() }));
      const select = $("entry-person");
      const selected = select.value;
      select.replaceChildren(...members.map((householdMember) => {
        const option = document.createElement("option");
        option.value = householdMember.name;
        option.textContent = householdMember.name;
        return option;
      }));
      if (members.some((householdMember) => householdMember.name === selected)) select.value = selected;
    }, (error) => {
      console.error("Riley household members could not be loaded", error);
      setStatus("Could not load household members", "error");
    });
    subscribeToDay();
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
        stopEntries?.();
        stopMembership?.();
        stopMembers?.();
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
document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => openEntry(button.dataset.add)));
document.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { filter = button.dataset.filter; render(); }));
$("entry-type").addEventListener("change", syncFields);
$("feed-method").addEventListener("change", syncFields);
["close-dialog", "cancel-dialog"].forEach((id) => $(id).addEventListener("click", () => $("entry-dialog").close()));
$("entry-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const timestamp = new Date($("entry-time").value);
  if (!Number.isFinite(timestamp.getTime()) || timestamp > new Date()) {
    $("entry-time").setCustomValidity("Choose a valid time that is not in the future.");
    $("entry-time").reportValidity();
    return;
  }
  const id = $("entry-id").value;
  const type = $("entry-type").value;
  const entry = { type, time: timestamp, person: $("entry-person").value, note: $("entry-note").value.trim() };
  if (type === "feed") {
    entry.method = $("feed-method").value;
    if (entry.method === "breast") { entry.side = $("feed-side").value; entry.duration = $("feed-duration").value; }
    else entry.amount = $("feed-amount").value;
  }
  try {
    if (demo) {
      const localEntry = { ...entry, time: timestamp.toISOString(), id: id || crypto.randomUUID() };
      entries = id ? entries.map((existing) => existing.id === id ? localEntry : existing) : [...entries, localEntry];
    } else if (id) {
      await updateDoc(doc(db, "households", "riley", "events", id), { ...entry, updatedAt: Timestamp.now() });
    } else {
      await addDoc(collection(db, "households", "riley", "events"), { ...entry, createdBy: currentUser.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    }
    selectedDay = localDay(timestamp);
    filter = "all";
    $("entry-dialog").close();
    if (demo) render(); else subscribeToDay();
    notify(id ? "Moment updated." : demo ? "Moment added to the demo." : "Moment added.");
  } catch (error) {
    console.error("Riley moment could not be saved", error);
    notify("Could not save that moment. Check your connection and try again.");
  }
});
$("entry-time").addEventListener("input", () => $("entry-time").setCustomValidity(""));
$("delete-entry").addEventListener("click", async () => {
  const deleted = entries.find((entry) => entry.id === $("entry-id").value);
  if (!deleted) return;
  try {
    if (demo) entries = entries.filter((entry) => entry.id !== deleted.id);
    else await deleteDoc(doc(db, "households", "riley", "events", deleted.id));
    $("entry-dialog").close();
    if (demo) render(); else subscribeToDay();
    notify("Moment deleted.", async () => {
      if (demo) entries.push(deleted);
      else {
        const restored = { ...deleted, time: Timestamp.fromDate(new Date(deleted.time)), createdBy: currentUser.uid, createdAt: Timestamp.now(), updatedAt: Timestamp.now() };
        delete restored.id;
        await addDoc(collection(db, "households", "riley", "events"), restored);
      }
      if (demo) render(); else subscribeToDay();
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
