import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailLink,
  signInWithEmailAndPassword,
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
let historyEntries = [];
let sleepSessions = [];
let activeSleep = null;
let undoAction = null;
let toastTimer;
let auth;
let db;
let currentUser;
let members = [];
let stopEntries;
let stopHistory;
let historyWindowDay;
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

function sleepDurationForDay(sessions, dayStart, dayEnd) {
  const now = new Date();
  const milliseconds = sessions.reduce((total, session) => {
    const start = new Date(session.time);
    const end = session.endTime ? new Date(session.endTime) : now;
    const overlapStart = Math.max(start.getTime(), dayStart.getTime());
    const overlapEnd = Math.min(end.getTime(), dayEnd.getTime(), now.getTime());
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);
  const minutes = Math.round(milliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function sleepMinutesInRange(sessions, start, end, now = new Date()) {
  const milliseconds = sessions.reduce((total, session) => {
    const sleepStart = new Date(session.time);
    const sleepEnd = session.endTime ? new Date(session.endTime) : now;
    const overlapStart = Math.max(sleepStart.getTime(), start.getTime());
    const overlapEnd = Math.min(sleepEnd.getTime(), end.getTime(), now.getTime());
    return total + Math.max(0, overlapEnd - overlapStart);
  }, 0);
  return Math.round(milliseconds / 60000);
}

function dayMetrics(records, day, elapsedMs, now = new Date()) {
  const start = new Date(`${day}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const cutoff = new Date(Math.min(end.getTime(), start.getTime() + elapsedMs));
  const dayRecords = records.filter((entry) => localDay(new Date(entry.time)) === day);
  const sleeps = records.filter((entry) => entry.type === "sleep");
  const tracked = dayRecords.length > 0 || sleeps.some((session) => {
    const sleepStart = new Date(session.time);
    const sleepEnd = session.endTime ? new Date(session.endTime) : now;
    return sleepStart < end && sleepEnd > start;
  });
  const current = records.filter((entry) => {
    const time = new Date(entry.time);
    return time >= start && time < cutoff;
  });
  return {
    tracked,
    sleepMinutes: sleepMinutesInRange(sleeps, start, cutoff, now),
    feeds: current.filter((entry) => entry.type === "feed").length,
    diapers: current.filter((entry) => ["wee", "poo", "both"].includes(entry.type)).length,
  };
}

function renderAverages(dayEntries) {
  const now = new Date();
  const today = localDay(now);
  const isToday = selectedDay === today;
  const selectedStart = new Date(`${selectedDay}T00:00:00`);
  const elapsedMs = isToday ? Math.max(0, now.getTime() - selectedStart.getTime()) : 86400000;
  const records = demo ? entries : [...historyEntries, ...dayEntries, ...sleepSessions];
  const uniqueRecords = [...new Map(records.map((entry) => [entry.id, entry])).values()];
  const current = dayMetrics(uniqueRecords, selectedDay, elapsedMs, now);
  $("average-title").textContent = isToday ? "Today vs. usual" : "Day vs. usual";
  $("average-legend-day").textContent = isToday ? "Today so far" : "Selected day";
  const currentLabel = isToday ? "so far" : "total";
  const averageLabel = isToday ? "average by now" : "daily average";
  ["sleep", "feeds", "diapers"].forEach((key) => {
    $(`average-${key}-current-label`).textContent = currentLabel;
    $(`average-${key}-mean-label`).textContent = averageLabel;
  });
  const previousDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(selectedStart);
    date.setDate(date.getDate() - 7 + index);
    return localDay(date);
  });
  const daily = previousDays.map((day) => dayMetrics(uniqueRecords, day, elapsedMs, now)).filter((day) => day.tracked);
  const average = daily.length ? {
    sleepMinutes: daily.reduce((sum, day) => sum + day.sleepMinutes, 0) / daily.length,
    feeds: daily.reduce((sum, day) => sum + day.feeds, 0) / daily.length,
    diapers: daily.reduce((sum, day) => sum + day.diapers, 0) / daily.length,
  } : null;
  $("average-period").textContent = demo ? "Sample 7-day history" : daily.length ? `${daily.length} of 7 days logged` : "Building your baseline";
  $("average-context").textContent = isToday
    ? "Today so far compared with the same time on previous days."
    : `${new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { month: "long", day: "numeric" })} compared with the previous 7 days.`;
  $("average-metrics").hidden = !average;
  $("average-empty").hidden = Boolean(average);
  if (!average) {
    $("average-description").textContent = "There are not enough previous logged days to calculate an average yet.";
    return;
  }
  const metrics = [
    { key: "sleep", current: current.sleepMinutes, average: average.sleepMinutes, max: 1440, scale: "24h", format: (value) => {
      const minutes = Math.round(value);
      const hours = Math.floor(minutes / 60);
      const remainder = minutes % 60;
      return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
    } },
    { key: "feeds", current: current.feeds, average: average.feeds, max: Math.max(10, Math.ceil(Math.max(current.feeds, average.feeds, 1) / 2) * 2), format: (value) => String(Math.round(value * 10) / 10) },
    { key: "diapers", current: current.diapers, average: average.diapers, max: Math.max(10, Math.ceil(Math.max(current.diapers, average.diapers, 1) / 2) * 2), format: (value) => String(Math.round(value * 10) / 10) },
  ];
  const values = [];
  metrics.forEach(({ key, current: value, average: mean, max, scale, format }) => {
    const currentRatio = Math.min(100, (value / max) * 100);
    const averageRatio = Math.min(100, (mean / max) * 100);
    $(`average-${key}-current`).textContent = format(value);
    $(`average-${key}-mean`).textContent = format(mean);
    $(`average-${key}-bar`).style.width = `${currentRatio}%`;
    $(`average-${key}-tick`).style.left = `${averageRatio}%`;
    $(`average-${key}-scale`).textContent = scale || String(max);
    values.push(`${key === "sleep" ? "Sleep" : key === "feeds" ? "Feeds" : "Diapers"}: ${format(value)} ${currentLabel}, compared with ${format(mean)} ${averageLabel} across ${daily.length} logged days.`);
  });
  const comparison = isToday ? "at the same time of day" : "over the full day";
  $("average-description").textContent = `${values.join(" ")} Comparisons use the previous seven calendar days with at least one recorded event, ${comparison}.`;
}

function lastFeedLabel(feed) {
  if (!feed) return "No feed recorded";
  if (feed.method === "bottle") return "Bottle";
  const side = feed.side || (feed.leftMinutes && feed.rightMinutes ? "Both" : feed.leftMinutes ? "Left" : feed.rightMinutes ? "Right" : "");
  if (side === "Both") {
    if (feed.startedSide === "Left") return "Right Breast";
    if (feed.startedSide === "Right") return "Left Breast";
    return "Both Breasts";
  }
  if (side === "Left" || side === "Right") return `${side} Breast`;
  return "Breast";
}

function renderRhythm(dayEntries, dayStart, dayEnd) {
  const sleepTrack = $("rhythm-sleep-track");
  const diaperTrack = $("rhythm-diaper-track");
  const sessions = dayEntries.filter((entry) => entry.type === "sleep");
  const diapers = dayEntries.filter((entry) => ["wee", "poo", "both"].includes(entry.type)).sort((a, b) => new Date(a.time) - new Date(b.time));
  const dayLength = dayEnd - dayStart;
  const now = new Date();
  const selectedDate = new Date(`${selectedDay}T12:00:00`);
  const dateLabel = selectedDate.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  $("rhythm-date").textContent = dateLabel;
  $("rhythm-chart").setAttribute("aria-label", `Sleep periods and diaper times for ${dateLabel}`);
  sleepTrack.replaceChildren();
  diaperTrack.replaceChildren();
  const sleepDescriptions = [];
  sessions.forEach((session) => {
    const start = new Date(session.time);
    const end = session.endTime ? new Date(session.endTime) : now;
    const clippedStart = new Date(Math.max(start.getTime(), dayStart.getTime()));
    const clippedEnd = new Date(Math.min(end.getTime(), dayEnd.getTime(), now.getTime()));
    if (clippedEnd <= clippedStart) return;
    const span = element("span", "rhythm-sleep-span");
    const left = ((clippedStart - dayStart) / dayLength) * 100;
    const width = ((clippedEnd - clippedStart) / dayLength) * 100;
    span.style.left = `${left}%`;
    span.style.width = `${width}%`;
    span.title = `Sleep ${timeLabel(clippedStart)}–${timeLabel(clippedEnd)}`;
    span.setAttribute("aria-hidden", "true");
    sleepTrack.append(span);
    sleepDescriptions.push(`${timeLabel(clippedStart)} to ${timeLabel(clippedEnd)}`);
  });
  diapers.forEach((entry, index) => {
    const marker = element("span", `rhythm-marker ${entry.type}`);
    marker.style.left = `${((new Date(entry.time) - dayStart) / dayLength) * 100}%`;
    marker.style.top = `${6 + (index % 3) * 16}px`;
    marker.title = `${names[entry.type]} at ${timeLabel(entry.time)}`;
    marker.setAttribute("aria-hidden", "true");
    diaperTrack.append(marker);
  });
  if (!sessions.length) sleepTrack.append(element("span", "rhythm-empty", "No sleep recorded"));
  if (!diapers.length) diaperTrack.append(element("span", "rhythm-empty", "No diapers recorded"));
  const diaperDescriptions = diapers.map((entry) => `${names[entry.type]} at ${timeLabel(entry.time)}`);
  $("rhythm-description").textContent = `Sleep periods: ${sleepDescriptions.length ? sleepDescriptions.join("; ") : "none recorded"}. Diapers: ${diaperDescriptions.length ? diaperDescriptions.join("; ") : "none recorded"}.`;
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
  const stats = [
    ["Feeds", dayEntries.filter((entry) => entry.type === "feed").length],
    ["Diapers", dayEntries.filter((entry) => ["wee", "poo", "both"].includes(entry.type)).length],
    ["Wees", dayEntries.filter((entry) => includes(entry, "wee")).length],
    ["Poos", dayEntries.filter((entry) => includes(entry, "poo")).length],
    ["Sleep sessions", dayEntries.filter((entry) => entry.type === "sleep").length],
    ["Hours slept", sleepDurationForDay(dayEntries.filter((entry) => entry.type === "sleep"), dayStart, dayEnd)],
  ];
  stats.forEach(([label, value]) => {
    const row = element("div", "stat-row");
    row.append(element("span", "", label), element("strong", "", String(value)));
    $("summary").append(row);
  });
  const latest = dayEntries.find((entry) => entry.type === "feed");
  $("last-feed").textContent = lastFeedLabel(latest);
  renderRhythm(dayEntries, dayStart, dayEnd);
  renderAverages(dayEntries);
  renderSleepTrends(dayEntries);
  renderSleepAction();
}

function sleepDurationText(minutes) {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours ? hours + "h " + String(remainder).padStart(2, "0") + "m" : rounded + "m";
}

function sleepClockText(minutes) {
  const dayMinute = ((Math.round(minutes) + 18 * 60) % 1440 + 1440) % 1440;
  return new Date(2020, 0, 1, Math.floor(dayMinute / 60), dayMinute % 60).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderSleepTrends(dayEntries) {
  const now = new Date();
  const selectedDate = new Date(selectedDay + "T12:00:00");
  const isToday = selectedDay === localDay(now);
  const records = demo ? entries : [...historyEntries, ...dayEntries, ...sleepSessions];
  const sessions = [...new Map(records.filter((entry) => entry.type === "sleep").map((entry) => [entry.id, entry])).values()]
    .map((entry) => ({ ...entry, start: new Date(entry.time), end: entry.endTime ? new Date(entry.endTime) : now }));
  const dayLength = 24 * 60 * 60 * 1000;
  const days = Array.from({ length: isToday ? 15 : 14 }, (_, index) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() - (isToday ? 14 : 13) + index);
    const windowStart = new Date(date);
    windowStart.setDate(windowStart.getDate() - 1);
    windowStart.setHours(18, 0, 0, 0);
    const windowEnd = new Date(date);
    windowEnd.setHours(18, 0, 0, 0);
    const nightCutoff = new Date(windowStart.getTime() + 12 * 60 * 60 * 1000);
    const nightEnd = new Date(windowStart.getTime() + 18 * 60 * 60 * 1000);
    const visibleEnd = new Date(Math.min(windowEnd.getTime(), now.getTime()));
    const segments = [];
    let totalMinutes = 0;
    let nightMinutes = 0;
    let hasCompletedNight = false;
    sessions.forEach((session) => {
      const start = new Date(Math.max(session.start.getTime(), windowStart.getTime()));
      const end = new Date(Math.min(session.end.getTime(), visibleEnd.getTime()));
      if (end <= start) return;
      const duration = (end - start) / 60000;
      totalMinutes += duration;
      const night = session.start >= windowStart && session.start < nightCutoff;
      if (night && session.endTime) {
        const nightOverlap = Math.max(0, Math.min(session.end.getTime(), nightEnd.getTime(), now.getTime()) - Math.max(session.start.getTime(), windowStart.getTime()));
        if (nightOverlap > 0) {
          nightMinutes += nightOverlap / 60000;
          hasCompletedNight = true;
        }
      }
      segments.push({ start, end, night, complete: Boolean(session.endTime), title: timeLabel(start) + "–" + timeLabel(end) + (night ? " night sleep" : " nap") });
    });
    const bedtimeCandidates = sessions.filter((session) => session.endTime && session.start >= windowStart && session.start < nightCutoff).sort((a, b) => a.start - b.start);
    const morningCandidates = sessions.filter((session) => session.endTime && session.start >= nightCutoff && session.start < nightEnd).sort((a, b) => a.start - b.start);
    const bedtime = bedtimeCandidates[0]?.start || morningCandidates[0]?.start || null;
    const bedtimeMinutes = bedtime ? (bedtime.getTime() - windowStart.getTime()) / 60000 : null;
    return { date, windowStart, windowEnd, segments, totalMinutes, nightMinutes, hasCompletedNight, bedtime, bedtimeMinutes };
  });

  const periodStart = days[0].date.toLocaleDateString([], { month: "short", day: "numeric" });
  const periodEnd = days[days.length - 1].date.toLocaleDateString([], { month: "short", day: "numeric" });
  $("sleep-trend-period").textContent = demo ? "Sample pattern · 14 days" : periodStart + "–" + periodEnd;
  const completedTrendDays = isToday ? days.slice(0, 14) : days;
  const olderDays = completedTrendDays.slice(0, 7);
  const recentDays = completedTrendDays.slice(-7);
  const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const olderBedtime = mean(olderDays.map((day) => day.bedtimeMinutes).filter(Number.isFinite));
  const recentBedtime = mean(recentDays.map((day) => day.bedtimeMinutes).filter(Number.isFinite));
  const olderNightSleep = mean(olderDays.filter((day) => day.hasCompletedNight).map((day) => day.nightMinutes));
  const recentNightSleep = mean(recentDays.filter((day) => day.hasCompletedNight).map((day) => day.nightMinutes));
  const insights = $("sleep-trend-insights");
  insights.replaceChildren();
  const addInsight = (label, value, detail) => {
    const card = element("div", "sleep-trend-insight");
    card.append(element("span", "sleep-trend-insight-label", label), element("strong", "", value), element("small", "", detail));
    insights.append(card);
  };
  if (olderBedtime !== null && recentBedtime !== null) {
    const change = olderBedtime - recentBedtime;
    const direction = change > 1 ? Math.round(change) + "m earlier" : change < -1 ? Math.round(Math.abs(change)) + "m later" : "about the same";
    addInsight("Bedtime", sleepClockText(olderBedtime) + " → " + sleepClockText(recentBedtime), direction + " · first 7 vs. most recent 7");
  } else addInsight("Bedtime", "Building a pattern", "Need more completed nights");
  if (olderNightSleep !== null && recentNightSleep !== null) {
    const change = recentNightSleep - olderNightSleep;
    const direction = Math.abs(change) < 2 ? "about the same" : (change > 0 ? "+" : "−") + sleepDurationText(Math.abs(change));
    addInsight("Night sleep", sleepDurationText(olderNightSleep) + " → " + sleepDurationText(recentNightSleep), direction + " · first 7 vs. most recent 7");
  } else addInsight("Night sleep", "Building a pattern", "Need more completed nights");
  const napStartDays = new Map();
  const trackedSleepDays = completedTrendDays.filter((day) => day.segments.some((segment) => segment.complete)).length;
  completedTrendDays.forEach((day) => {
    const dateKey = localDay(day.date);
    day.segments.filter((segment) => !segment.night && segment.complete).forEach((segment) => {
      const minute = segment.start.getHours() * 60 + segment.start.getMinutes();
      if (minute < 11 * 60 || minute >= 15 * 60) return;
      const bucket = (Math.round(minute / 30) * 30) % 1440;
      if (!napStartDays.has(bucket)) napStartDays.set(bucket, new Set());
      napStartDays.get(bucket).add(dateKey);
    });
  });
  const typicalNap = [...napStartDays.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  if (typicalNap && typicalNap[1].size >= 3) {
    const napMinute = typicalNap[0];
    const napTime = new Date(2020, 0, 1, Math.floor(napMinute / 60), napMinute % 60).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    addInsight("Midday nap", napTime, typicalNap[1].size + " of " + trackedSleepDays + " logged sleep days");
  } else addInsight("Midday nap", "Still emerging", "Need more repeated midday naps");

  const chart = $("sleep-trend-chart");
  chart.replaceChildren();
  const accessibleRows = [];
  days.forEach((day) => {
    const key = localDay(day.date);
    const isToday = key === localDay(now);
    const dateLabel = isToday ? "Today" : day.date.toLocaleDateString([], { month: "numeric", day: "numeric" });
    const row = element("div", "sleep-trend-row");
    row.append(element("span", "sleep-trend-day", dateLabel));
    const track = element("div", "sleep-trend-track");
    track.setAttribute("aria-hidden", "true");
    day.segments.forEach((segment) => {
      const bar = element("span", "sleep-trend-period " + (segment.night ? "night" : "nap"));
      bar.style.left = ((segment.start - day.windowStart) / dayLength) * 100 + "%";
      bar.style.width = ((segment.end - segment.start) / dayLength) * 100 + "%";
      bar.title = segment.title;
      track.append(bar);
    });
    row.append(track, element("span", "sleep-trend-total", day.totalMinutes ? sleepDurationText(day.totalMinutes) : "—"));
    chart.append(row);
    accessibleRows.push(dateLabel + ": " + (day.segments.length ? day.segments.map((segment) => segment.title).join(", ") : "no sleep logged") + "; total " + (day.totalMinutes ? sleepDurationText(day.totalMinutes) : "none"));
  });
  const axis = element("div", "sleep-trend-axis");
  axis.append(element("span", "", ""));
  const labels = element("div", "sleep-trend-axis-labels");
  ["6 PM", "12 AM", "6 AM", "12 PM", "6 PM"].forEach((label) => labels.append(element("span", "", label)));
  axis.append(labels, element("span", "", ""));
  chart.append(axis);
  const bedtimeSummary = olderBedtime !== null && recentBedtime !== null ? "Bedtime average changed from " + sleepClockText(olderBedtime) + " to " + sleepClockText(recentBedtime) + ". " : "Bedtime trend is still building. ";
  const nightSummary = olderNightSleep !== null && recentNightSleep !== null ? "Night sleep average changed from " + sleepDurationText(olderNightSleep) + " to " + sleepDurationText(recentNightSleep) + ". " : "Night sleep trend is still building. ";
  $("sleep-trends-description").textContent = "Fourteen completed sleep-day rows, each from 6 PM through the next day at 6 PM" + (isToday ? ", plus today's in-progress row" : "") + ". Dark bars are overnight sleep and pale bars are naps. " + bedtimeSummary + nightSummary + accessibleRows.join(" ");
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

function localClockTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function wizardClockDefault(key) {
  const date = wizardTimeDefault(key);
  date.setMinutes(Math.floor(date.getMinutes() / 5) * 5, 0, 0);
  return date;
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
    const clockOnly = step.key === "time";
    label.textContent = clockOnly
      ? `Time on ${new Date(`${selectedDay}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" })}`
      : step.label;
    const input = document.createElement("input");
    input.type = clockOnly ? "time" : "datetime-local";
    input.id = "wizard-input";
    input.required = true;
    if (clockOnly) {
      input.step = "300";
      input.value = wizard.values[step.key]
        ? localClockTime(new Date(wizard.values[step.key]))
        : localClockTime(wizardClockDefault(step.key));
      if (selectedDay === localDay(new Date())) input.max = localClockTime(new Date());
      const hint = element("span", "wizard-time-hint", "Scroll or tap to change by 5 minutes");
      label.append(input, hint);
    } else {
      input.max = localInput(new Date());
      input.value = wizard.values[step.key] || localInput(wizardTimeDefault(step.key));
      label.append(input);
    }
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
    const clockOnly = step.kind === "time" && step.key === "time";
    const selectedTime = clockOnly ? new Date(`${selectedDay}T${input.value || ""}`) : new Date(input.value);
    if (step.kind === "time") input.setCustomValidity("");
    if (step.kind === "time" && (!input.value || !Number.isFinite(selectedTime.getTime()) || selectedTime > new Date())) {
      input.setCustomValidity("Choose a valid time that is not in the future.");
      input.reportValidity();
      return false;
    }
    if (step.kind === "number" && input.value && !input.checkValidity()) {
      input.reportValidity();
      return false;
    }
    wizard.values[step.key] = clockOnly ? localInput(selectedTime) : input.value;
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
  const currentDayEntries = sample.map((entry, i) => {
    const time = new Date(now.getTime() - elapsed * (0.08 + i * 0.15));
    const endTime = entry.type === "sleep" ? new Date(Math.min(time.getTime() + 40 * 60000, now.getTime())).toISOString() : undefined;
    return { id: crypto.randomUUID(), note: "", ...entry, time: time.toISOString(), endTime };
  });
  const history = [];
  for (let daysAgo = 1; daysAgo <= 14; daysAgo += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
    const dayAt = (dayOffset, hour, minute) => new Date(day.getFullYear(), day.getMonth(), day.getDate() + dayOffset, hour, minute);
    const variation = daysAgo % 3;
    const trend = 14 - daysAgo;
    const add = (type, time, endTime, extra = {}) => history.push({ id: crypto.randomUUID(), type, time: time.toISOString(), endTime: endTime?.toISOString() || null, note: "", person: "Kane", ...extra });
    const bedtimeMinute = 30 - trend * 3;
    const bedtimeHour = 22 + Math.floor(bedtimeMinute / 60);
    const normalizedBedtimeMinute = (bedtimeMinute + 60) % 60;
    const wakeMinute = 45 + trend * 3;
    add("sleep", dayAt(-1, bedtimeHour, normalizedBedtimeMinute), dayAt(0, 5 + Math.floor(wakeMinute / 60), wakeMinute % 60));
    add("sleep", dayAt(0, 9, 15 + variation * 5), dayAt(0, 10, variation * 5));
    add("sleep", dayAt(0, 13, variation * 5), dayAt(0, 14, 45 + variation * 5));
    add("sleep", dayAt(0, 16, 15 + variation * 5), dayAt(0, 17, variation * 5));
    add("wee", dayAt(0, 5, 20), null, { wetSize: "large" });
    add("both", dayAt(0, 9, 0), null, { wetSize: "large", stoolSize: "small" });
    add("both", dayAt(0, 13, 10), null, { wetSize: "large", stoolSize: "large" });
    add("both", dayAt(0, 18, 55), null, { wetSize: "medium", stoolSize: "small" });
    add("both", dayAt(0, 22, 30), null, { wetSize: "medium", stoolSize: "large" });
    add("feed", dayAt(0, 0, 3 + variation * 4), null, { method: "breast", side: "Left", startedSide: "Left", leftMinutes: 8 });
    add("both", dayAt(0, 0, 10 + variation * 4), null, { wetSize: "small", stoolSize: "medium" });
    [5, 8, 10, 12, 14, 17, 20, 23].forEach((hour, index) => {
      add("feed", dayAt(0, hour, index % 2 ? 45 : 15), null, index % 3 === 0
        ? { method: "bottle", amount: 75 }
        : { method: "breast", side: index % 2 ? "Left" : "Right", startedSide: index % 2 ? "Left" : "Right", leftMinutes: index % 2 ? 8 : 0, rightMinutes: index % 2 ? 0 : 8 });
    });
  }
  entries = [...currentDayEntries, ...history];
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
  subscribeToHistory();
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

function subscribeToHistory() {
  if (demo || !db || historyWindowDay === selectedDay) return;
  historyWindowDay = selectedDay;
  stopHistory?.();
  historyEntries = [];
  const start = new Date(`${selectedDay}T00:00:00`);
  start.setDate(start.getDate() - 8);
  const end = new Date(`${selectedDay}T00:00:00`);
  const events = collection(db, "households", "riley", "events");
  const historyQuery = query(events, where("time", ">=", Timestamp.fromDate(start)), where("time", "<", Timestamp.fromDate(end)), orderBy("time", "desc"));
  stopHistory = onSnapshot(historyQuery, (snapshot) => {
    historyEntries = snapshot.docs.map(mapFirestoreEvent);
    render();
  }, (error) => {
    console.error("Riley history could not be loaded", error);
    historyEntries = [];
    render();
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
      stopHistory?.();
      stopMembers?.();
      stopSleep?.();
      historyEntries = [];
      historyWindowDay = null;
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
        historyEntries = [];
        historyWindowDay = null;
        sleepSessions = [];
        activeSleep = null;
        stopEntries?.();
        stopHistory?.();
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
  const submit = $("sign-in-submit");
  submit.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, $("auth-email").value.trim(), $("auth-password").value);
    $("auth-password").value = "";
  } catch (error) {
    console.error("Riley password sign-in failed", error);
    const messages = {
      "auth/invalid-credential": "The email or password wasn't recognized. Try again, or set/reset your password.",
      "auth/wrong-password": "The email or password wasn't recognized. Try again, or set/reset your password.",
      "auth/user-not-found": "The email or password wasn't recognized. Try again, or set/reset your password.",
      "auth/too-many-requests": "Too many sign-in attempts. Please wait before trying again.",
      "auth/network-request-failed": "Could not connect. Check your internet connection and try again.",
    };
    $("auth-message").textContent = messages[error.code] || "Could not sign in. Please try again later.";
  } finally {
    submit.disabled = false;
  }
});

$("reset-password").addEventListener("click", async () => {
  if (!auth || !$("auth-email").reportValidity()) return;
  const button = $("reset-password");
  button.disabled = true;
  try {
    await sendPasswordResetEmail(auth, $("auth-email").value.trim(), { url: `${window.location.origin}/riley/` });
    $("auth-message").textContent = "If this email has a Riley account, you'll receive a link to set or reset your password. Then return here to sign in.";
  } catch (error) {
    console.error("Riley password reset could not be sent", error);
    $("auth-message").textContent = error.code === "auth/too-many-requests" || error.code === "auth/quota-exceeded"
      ? "The password reset limit has been reached. Please try again later."
      : "Could not send the password reset email. Please try again later.";
  } finally {
    button.disabled = false;
  }
});

$("email-link-sign-in").addEventListener("click", async (event) => {
  event.preventDefault();
  if (!auth || !$("auth-email").reportValidity()) return;
  const email = $("auth-email").value.trim();
  const submit = $("email-link-sign-in");
  submit.disabled = true;
  try {
    await sendSignInLinkToEmail(auth, email, { url: `${window.location.origin}/riley/`, handleCodeInApp: true });
    window.localStorage.setItem("riley:emailForSignIn", email);
    $("auth-message").textContent = "Check your email for the sign-in link. It will return you to Riley.";
  } catch (error) {
    console.error("Riley sign-in link could not be sent", error);
    const messages = {
      "auth/quota-exceeded": "Today's sign-in email limit has been reached. Try again later, or use a browser where you're already signed in.",
      "auth/too-many-requests": "Too many sign-in attempts. Please wait before trying again.",
      "auth/invalid-email": "Enter a valid email address.",
      "auth/network-request-failed": "Could not connect. Check your internet connection and try again.",
    };
    $("auth-message").textContent = messages[error.code] || "Could not send the sign-in link. Please try again later.";
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

function setupGraphCarousel() {
  const viewport = $("graph-carousel-viewport");
  const slides = [...document.querySelectorAll("[data-graph-slide-panel]")];
  const buttons = [...document.querySelectorAll("[data-graph-slide]")];
  if (!viewport || slides.length < 2 || buttons.length !== slides.length) return;

  let frame = 0;
  const updateCurrentSlide = () => {
    frame = 0;
    const width = Math.max(viewport.clientWidth, 1);
    const index = Math.max(0, Math.min(slides.length - 1, Math.round(viewport.scrollLeft / width)));
    buttons.forEach((button, buttonIndex) => button.setAttribute("aria-pressed", String(buttonIndex === index)));
    slides.forEach((slide, slideIndex) => {
      const inactive = slideIndex !== index;
      slide.setAttribute("aria-hidden", String(inactive));
      slide.inert = inactive;
    });
    viewport.style.height = `${slides[index].offsetHeight}px`;
  };

  buttons.forEach((button, index) => button.addEventListener("click", () => {
    const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    viewport.scrollTo({ left: index * viewport.clientWidth, behavior });
  }));
  viewport.addEventListener("scroll", () => {
    if (!frame) frame = requestAnimationFrame(updateCurrentSlide);
  }, { passive: true });
  viewport.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const activeIndex = buttons.findIndex((button) => button.getAttribute("aria-pressed") === "true");
    const nextIndex = (activeIndex + (event.key === "ArrowRight" ? 1 : -1) + slides.length) % slides.length;
    buttons[nextIndex].click();
  });
  window.addEventListener("resize", updateCurrentSlide);
  updateCurrentSlide();
}

setupGraphCarousel();
$("previous-day").addEventListener("click", () => changeDay(-1));
$("next-day").addEventListener("click", () => changeDay(1));
$("reset-demo").addEventListener("click", () => { seedDemo(); notify("Sample day restored."); });
