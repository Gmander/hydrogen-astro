import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore, collection, doc, getDoc, getDocs, onSnapshot, setDoc, updateDoc, runTransaction, serverTimestamp, query, where, deleteDoc } from "firebase/firestore";

const $ = (id) => document.getElementById(id);
const config = { apiKey: import.meta.env.PUBLIC_FIREBASE_API_KEY, authDomain: import.meta.env.PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: import.meta.env.PUBLIC_FIREBASE_PROJECT_ID, appId: import.meta.env.PUBLIC_FIREBASE_APP_ID };
let db, user, game, deck, roomId, playerId, editingDeckId = null, isHost = false, offGame, offPlayers, offReplies, toastTimer;
let players = [], replies = [], finalCategory = 0, myFinalSubmitted = false, checkedFinalRoom = "";
const defaultCategories = ["Around the World", "Pop Culture", "Food & Drink", "History", "Wild Card"];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
function say(message) { const el = $("toast"); el.textContent = message; el.style.display = "block"; clearTimeout(toastTimer); toastTimer = setTimeout(() => el.style.display = "none", 3200); }
function show(view) { for (const id of ["home", "editor", "room"]) $(id).hidden = id !== view; }
function gameRef(id = roomId) { return doc(db, "jeopardyGames", id); }
function playerRef(uid, id = roomId) { return doc(db, "jeopardyGames", id, "players", uid); }
function deckRef(id) { return doc(db, "jeopardyDecks", id); }
function newCode() { const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; const bytes = crypto.getRandomValues(new Uint8Array(8)); return [...bytes].map((n) => alphabet[n % alphabet.length]).join(""); }

const roundValues = [[100, 200, 300, 400, 500], [200, 400, 600, 800, 1000]];
function editorCategory(roundIndex, name = "", clues = null) {
  const root = $(`categories-${roundIndex}`), index = root.querySelectorAll(".category-editor").length;
  const section = document.createElement("section"); section.className = "category-editor";
  const cards = clues || roundValues[roundIndex].map((value) => ({ value, question: "", answer: "", dailyDouble: false }));
  section.innerHTML = `<div class="category-title"><input class="category-name" maxlength="40" placeholder="Category ${index + 1}" value="${esc(name)}"><button class="quiet remove-category" type="button">Remove</button></div><div class="question-grid">${cards.map((c, i) => `<label class="question-card"><small>$${c.value}</small><textarea class="question-text" data-row="${i}" placeholder="Clue / question" maxlength="500">${esc(c.question)}</textarea><textarea class="answer-text" data-row="${i}" placeholder="Correct response" maxlength="300">${esc(c.answer)}</textarea><label class="field bonus-field">Bonus points<input class="bonus-points" data-row="${i}" type="number" min="0" step="50" value="${Number(c.bonusPoints || 0)}" aria-label="Bonus points"></label><span class="check"><input type="checkbox" class="daily-double" data-row="${i}" ${c.dailyDouble ? "checked" : ""}> Daily Double</span></label>`).join("")}</div>`;
  section.querySelector(".remove-category").onclick = () => { section.remove(); renumberCategories(roundIndex); };
  root.append(section);
}
function renumberCategories(roundIndex) { [...$(`categories-${roundIndex}`).querySelectorAll(".category-editor")].forEach((el, i) => { el.querySelector(".category-name").placeholder = `Category ${i + 1}`; }); }
function readBoard() { return [0, 1].map((roundIndex) => [...$(`categories-${roundIndex}`).querySelectorAll(".category-editor")].map((section) => ({ name: section.querySelector(".category-name").value.trim(), clues: roundValues[roundIndex].map((value, i) => ({ value, question: section.querySelector(`.question-text[data-row="${i}"]`).value.trim(), answer: section.querySelector(`.answer-text[data-row="${i}"]`).value.trim(), bonusPoints: Number(section.querySelector(`.bonus-points[data-row="${i}"]`).value || 0), dailyDouble: section.querySelector(`.daily-double[data-row="${i}"]`).checked })) }))); }
function renderDecks(snapshot) {
  const root = $("saved-decks"); root.replaceChildren();
  if (!snapshot.size) return;
  const title = document.createElement("p"); title.className = "kicker"; title.textContent = "YOUR SAVED BOARDS"; root.append(title);
  snapshot.forEach((record) => { const row = document.createElement("div"); row.className = "deck-row"; const label = document.createElement("strong"); label.textContent = record.data().name; const edit = document.createElement("button"); edit.className = "quiet"; edit.textContent = "Edit"; edit.onclick = () => editDeck(record.id, record.data()); const launch = document.createElement("button"); launch.className = "secondary"; launch.textContent = "Host game"; launch.onclick = () => createRoom(record.id); const remove = document.createElement("button"); remove.className = "quiet"; remove.textContent = "Delete"; remove.onclick = async () => { if (confirm(`Delete “${record.data().name}”?`)) { await deleteDoc(record.ref); say("Board deleted."); loadDecks(); } }; row.append(label, edit, launch, remove); root.append(row); });
}
function editDeck(id, data) {
  editingDeckId = id; $("categories-0").replaceChildren(); $("categories-1").replaceChildren(); $("deck-name").value = data.name;
  const rounds = data.rounds || [{ name: "Jeopardy!", categories: data.categories || [] }, { name: "Double Jeopardy!", categories: [] }];
  rounds.forEach((round, roundIndex) => (round.categories || []).forEach((c) => editorCategory(roundIndex, c.name, c.clues)));
  $("final-category").value = data.final.category; $("final-question").value = data.final.question; $("final-answer").value = data.final.answer;
  $("save-deck").textContent = "Save changes"; show("editor");
}
async function loadDecks() {
  // Query is owner-scoped; Firestore rules enforce the same filter.
  const q = await getDocs(query(collection(db, "jeopardyDecks"), where("owner", "==", user.uid))); renderDecks({ size: q.docs.length, forEach: (fn) => q.docs.forEach(fn) });
}
async function saveDeck() {
  const rounds = readBoard(), name = $("deck-name").value.trim();
  const final = { category: $("final-category").value.trim(), question: $("final-question").value.trim(), answer: $("final-answer").value.trim() };
  if (!name || rounds.some((categories) => categories.length < 2 || categories.length > 6 || categories.some((c) => !c.name || c.clues.some((q) => !q.question || !q.answer))) || Object.values(final).some((v) => !v)) { say("Add 2–6 categories to each round and complete every clue and Final Jeopardy."); return; }
  deck = { name, rounds: rounds.map((categories, i) => ({ name: i ? "Double Jeopardy!" : "Jeopardy!", values: roundValues[i], categories })), final, owner: user.uid, updatedAt: serverTimestamp() };
  if (editingDeckId) await updateDoc(deckRef(editingDeckId), { name, rounds: deck.rounds, final, updatedAt: serverTimestamp() });
  else await setDoc(doc(collection(db, "jeopardyDecks")), { ...deck, createdAt: serverTimestamp() });
  editingDeckId = null; $("save-deck").textContent = "Save board";
  say("Board saved. Ready to host!"); show("home"); await loadDecks();
}
async function createRoom(deckId) {
  const ref = deckRef(deckId), snap = await getDoc(ref); if (!snap.exists()) { say("That board is no longer available."); return; }
  deck = snap.data(); roomId = newCode(); isHost = true; playerId = user.uid; history.replaceState({}, "", `?room=${roomId}&host=1`);
  deck.rounds ||= [{ name: "Jeopardy!", values: roundValues[0], categories: deck.categories }, { name: "Double Jeopardy!", values: roundValues[1], categories: [] }];
  const labels = deck.rounds[0].categories.map((c) => c.name);
  await setDoc(gameRef(), { hostUid: user.uid, deckId, name: deck.name, phase: "lobby", roundIndex: 0, categories: labels, values: roundValues[0], completed: [], current: null, buzzedBy: null, buzzAt: null, activePlayer: null, finalCategory: null, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  await setDoc(doc(db, "jeopardyGames", roomId, "private", "board"), { rounds: deck.rounds, final: deck.final });
  await setDoc(playerRef(user.uid), { name: "Host", score: 0, joinedAt: serverTimestamp(), isHost: true });
  enterRoom(roomId);
}
function enterRoom(id) {
  roomId = id.toUpperCase(); playerId = isHost ? user.uid : localStorage.getItem(`jeopardy:${roomId}`) || user.uid; myFinalSubmitted = false; checkedFinalRoom = ""; show("room"); $("room-title").textContent = "Game night"; $("room-kicker").textContent = `ROOM ${roomId}`; $("code-display").textContent = roomId;
  offGame?.(); offPlayers?.(); offReplies?.();
  offGame = onSnapshot(gameRef(), (snap) => { if (!snap.exists()) { say("Room not found or game ended."); show("home"); return; } game = snap.data(); if (game.hostUid === user.uid && params.get("host") === "1") isHost = true; renderRoom(); if (!isHost && game.phase === "final" && checkedFinalRoom !== roomId) { checkedFinalRoom = roomId; getDoc(doc(db, "jeopardyGames", roomId, "responses", user.uid)).then((response) => { myFinalSubmitted = response.exists(); renderControls(); }); } }, (e) => say(e.message));
  offPlayers = onSnapshot(collection(db, "jeopardyGames", roomId, "players"), (snap) => { players = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderRoom(); }, (e) => say(e.message));
}
async function joinRoom(id, name) {
  const ref = gameRef(id), snap = await getDoc(ref);
  if (!snap.exists() || snap.data().phase !== "lobby") { say("Room code not found or the game has already started."); return; }
  roomId = id; isHost = false; playerId = user.uid;
  await setDoc(playerRef(user.uid, id), { name: name.trim(), score: 0, joinedAt: serverTimestamp() });
  localStorage.setItem(`jeopardy:${id}`, user.uid); enterRoom(id);
}
function renderRoom() {
  if (!game) return;
  $("room-title").textContent = game.name || "Game night";
  const lobby = game.phase === "lobby";
  const joined = players.some((p) => p.id === user.uid);
  $("join-panel").hidden = isHost || playerId !== user.uid || joined;
  $("lobby").hidden = !lobby;
  $("copy-link").hidden = !isHost; $("start-board").hidden = !isHost; $("lobby-instructions").hidden = !isHost; $("waiting-host").hidden = isHost || !joined;
  $("play").hidden = lobby;
  $("lobby-players").innerHTML = players.map((p) => `<span class="player-pill">${esc(p.name)}</span>`).join("");
  if (lobby) return;
  $("host-controls").hidden = !isHost; $("player-controls").hidden = isHost;
  $("scores").innerHTML = players.filter((p) => !p.isHost).map((p) => `<span class="score-pill">${esc(p.name)} · $${Number(p.score || 0).toLocaleString()}</span>`).join("");
  $("round-label").textContent = game.phase === "board" ? (game.roundIndex === 1 ? "DOUBLE JEOPARDY!" : "JEOPARDY!") : "";
  renderBoard(); renderClue(); renderControls();
}
function renderBoard() {
  const root = $("board"), values = game.values || roundValues[game.roundIndex || 0]; root.style.setProperty("--cols", game.categories.length); root.innerHTML = "";
  game.categories.forEach((name) => { const el = document.createElement("div"); el.className = "category-cell"; el.textContent = name; root.append(el); });
  for (let row = 0; row < values.length; row++) game.categories.forEach((_, col) => {
    const key = `${game.roundIndex || 0}:${col}:${row}`, done = (game.completed || []).includes(key); const cell = document.createElement("button"); cell.className = `clue-cell ${done ? "done" : ""}`; cell.textContent = `$${values[row]}`; cell.disabled = done || !isHost || game.phase !== "board"; if (isHost && !done) cell.onclick = () => selectClue(col, row); root.append(cell);
  });
  root.hidden = game.phase === "clue" || game.phase === "daily-wager" || game.phase === "final" || game.phase === "finished";
}
async function selectClue(col, row) {
  if (!deck) { const snap = await getDoc(doc(db, "jeopardyGames", roomId, "private", "board")); deck = snap.data(); }
  const roundIndex = game.roundIndex || 0, q = deck.rounds[roundIndex].categories[col].clues[row], key = `${roundIndex}:${col}:${row}`;
  const next = { roundIndex, col, row, key, question: q.question, value: q.value, dailyDouble: q.dailyDouble, bonusPoints: q.bonusPoints || 0 };
  await updateDoc(gameRef(), { current: next, buzzedBy: null, buzzAt: null, phase: q.dailyDouble ? "daily-wager" : "clue", updatedAt: serverTimestamp() });
}
function renderClue() {
  const box = $("clue"), active = ["clue", "daily-wager", "final"].includes(game.phase); box.hidden = !active;
  if (!active) return;
  if (game.phase === "final") { box.innerHTML = `<div class="kicker">FINAL JEOPARDY · ${esc(game.finalCategory || "Final Category")}</div><p>${esc(game.finalQuestion || "Waiting for host to reveal the clue…")}</p>`; return; }
  if (game.phase === "daily-wager") { const who = players.find((p) => p.id === game.activePlayer); box.innerHTML = `<div class="kicker">DAILY DOUBLE · ${esc(who?.name || "Choose a player")}</div><p>Waiting for the host to set a wager.</p>`; return; }
  box.innerHTML = `<div class="kicker">${game.current.roundIndex ? "DOUBLE JEOPARDY! · " : "JEOPARDY! · "}${esc(game.categories[game.current.col])} · $${Number(game.current.value).toLocaleString()}${game.current.dailyDouble ? " · DAILY DOUBLE" : ""}</div><p>${esc(game.current.question)}</p>${game.buzzedBy ? `<div class="buzz-result">${esc(players.find((p) => p.id === game.buzzedBy)?.name || "Player")} buzzed first!</div>` : ""}`;
}
function renderControls() {
  const host = $("host-controls"), player = $("player-controls"); host.replaceChildren(); player.replaceChildren();
  if (isHost) {
    const tools = document.createElement("div"); tools.className = "host-tools";
    if (game.phase === "board" && game.roundIndex === 1 && (game.completed || []).length >= 60) { const final = document.createElement("button"); final.className = "secondary"; final.textContent = "Final Jeopardy"; final.onclick = chooseFinal; tools.append(final); }
    if (game.phase === "daily-wager") {
      const options = players.filter((p) => !p.isHost); const select = document.createElement("select"); select.innerHTML = options.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
      const wager = document.createElement("input"); wager.type = "number"; wager.min = "0"; wager.value = String(game.current.value); wager.setAttribute("aria-label", "Daily Double wager");
      const set = document.createElement("button"); set.className = "primary"; set.textContent = "Set wager & reveal"; set.onclick = () => setDailyWager(select.value, Number(wager.value)); tools.append(select, wager, set);
    }
    if (game.phase === "clue" && !game.buzzedBy) { const pass = document.createElement("button"); pass.className = "quiet"; pass.textContent = "No one got it · next clue"; pass.onclick = () => resolveClue(null, 0); tools.append(pass); }
    if (game.phase === "clue" && game.buzzedBy) {
      const who = players.find((p) => p.id === game.buzzedBy), amount = game.current.wager ?? game.current.value;
      const correct = document.createElement("button"); correct.className = "primary"; correct.textContent = `Correct · +$${amount}`; correct.onclick = () => resolveClue(game.buzzedBy, amount);
      const wrong = document.createElement("button"); wrong.className = "secondary"; wrong.textContent = `Incorrect · −$${amount}`; wrong.onclick = () => resolveClue(game.buzzedBy, -amount);
    const reveal = document.createElement("button"); reveal.className = "quiet"; reveal.textContent = "Show answer"; reveal.onclick = async () => { const d = deck || (await getDoc(doc(db, "jeopardyGames", roomId, "private", "board"))).data(), q = d.rounds[game.current.roundIndex].categories[game.current.col].clues[game.current.row]; say(`Correct response: ${q.answer}${q.acceptedAnswers?.length ? ` (also accept: ${q.acceptedAnswers.join(" / ")})` : ""}`); };
      tools.append(correct, wrong, reveal); if (who) { const label = document.createElement("span"); label.className = "buzz-result"; label.textContent = `${who.name} buzzed first`; tools.prepend(label); if (game.current.bonusPoints > 0 && !game.current.bonusAwarded) { const bonus = document.createElement("button"); bonus.className = "secondary"; bonus.textContent = `Award +$${game.current.bonusPoints} bonus`; bonus.onclick = () => awardBonus(game.buzzedBy, game.current.bonusPoints); tools.append(bonus); } }
    }
    if (game.phase === "final") renderFinalHost(tools);
    if (game.phase === "finished") { const again = document.createElement("button"); again.className = "primary"; again.textContent = "Back to my boards"; again.onclick = () => { offGame?.(); offPlayers?.(); show("home"); loadDecks(); }; tools.append(again); }
    host.append(tools);
  } else {
    if (game.phase === "clue" && !game.buzzedBy && (!game.current.dailyDouble || game.activePlayer === user.uid)) { const buzz = document.createElement("button"); buzz.className = "buzz"; buzz.textContent = "BUZZ IN"; buzz.onclick = buzzIn; player.append(buzz); }
    else if (game.phase === "clue" && game.buzzedBy) { const status = document.createElement("p"); status.className = "empty"; status.textContent = game.buzzedBy === user.uid ? "You buzzed first! Answer out loud." : `${players.find((p) => p.id === game.buzzedBy)?.name || "Someone"} buzzed first.`; player.append(status); }
    if (game.phase === "daily-wager" && game.activePlayer === user.uid) { const wrap = document.createElement("form"); wrap.className = "host-tools"; const input = document.createElement("input"); input.type = "number"; input.min = "0"; input.placeholder = "Your wager"; input.required = true; const btn = document.createElement("button"); btn.className = "primary"; btn.textContent = "Submit wager"; wrap.append(input, btn); wrap.onsubmit = (e) => { e.preventDefault(); submitWager(Number(input.value)); }; player.append(wrap); }
    if (game.phase === "final" && !myFinalSubmitted) player.append(finalResponseForm());
    if (game.phase === "final" && myFinalSubmitted) { const status = document.createElement("p"); status.textContent = "Final response submitted. Wait for the reveal!"; player.append(status); }
  }
}
async function buzzIn() {
  try { await runTransaction(db, async (tx) => { const ref = gameRef(), snap = await tx.get(ref), data = snap.data(); if (!snap.exists() || data.phase !== "clue" || data.buzzedBy || (data.current?.dailyDouble && data.activePlayer !== user.uid)) throw new Error("Too late — someone buzzed first or this Daily Double is assigned to another player."); tx.update(ref, { buzzedBy: user.uid, buzzAt: serverTimestamp(), updatedAt: serverTimestamp() }); }); }
  catch (e) { say(e.message.includes("Too late") ? e.message : "Buzz did not connect. Try once more."); }
}
async function resolveClue(uid, delta) {
  if (uid && delta) await updateDoc(playerRef(uid), { score: Number(players.find((p) => p.id === uid)?.score || 0) + delta });
  const done = [...new Set([...(game.completed || []), game.current.key])], updates = { phase: "board", completed: done, current: null, buzzedBy: null, buzzAt: null, activePlayer: null, updatedAt: serverTimestamp() };
  if ((game.roundIndex || 0) === 0 && done.filter((key) => key.startsWith("0:")).length >= 30) { updates.roundIndex = 1; updates.categories = deck.rounds[1].categories.map((c) => c.name); updates.values = roundValues[1]; }
  await updateDoc(gameRef(), updates);
}
async function awardBonus(uid, amount) {
  if (!uid || game.current.bonusAwarded) return;
  const p = players.find((x) => x.id === uid); if (!p) return;
  await updateDoc(playerRef(uid), { score: Number(p.score || 0) + amount });
  await updateDoc(gameRef(), { current: { ...game.current, bonusAwarded: true }, updatedAt: serverTimestamp() });
  say(`${p.name} earned the $${amount} bonus.`);
}
async function setDailyWager(uid, wager) {
  if (!uid || !Number.isFinite(wager) || wager < 0) { say("Choose a player and enter a valid wager."); return; }
  const ref = gameRef(); await updateDoc(ref, { phase: "clue", activePlayer: uid, current: { ...game.current, wager }, buzzedBy: null, buzzAt: null, updatedAt: serverTimestamp() });
}
async function submitWager(wager) { if (!Number.isFinite(wager) || wager < 0) return; await setDoc(doc(db, "jeopardyGames", roomId, "responses", user.uid), { wager, answer: "", submittedAt: serverTimestamp() }); say("Wager submitted privately."); }
async function chooseFinal() {
  if (!deck) { const snap = await getDoc(doc(db, "jeopardyGames", roomId, "private", "board")); deck = snap.data(); }
  const question = deck.final.question, response = deck.final.answer;
  await setDoc(doc(db, "jeopardyGames", roomId, "private", "answers"), { finalAnswer: response });
  await updateDoc(gameRef(), { phase: "final", finalCategory: deck.final.category, finalQuestion: question, updatedAt: serverTimestamp() });
  offReplies = onSnapshot(collection(db, "jeopardyGames", roomId, "responses"), (snap) => { replies = snap.docs.map((d) => ({ id: d.id, ...d.data() })); renderControls(); });
}
function finalResponseForm() { const form = document.createElement("form"); form.className = "host-tools"; const wager = document.createElement("input"); wager.type = "number"; wager.min = "0"; wager.placeholder = "Wager"; wager.required = true; const answer = document.createElement("input"); answer.placeholder = "Your response"; answer.maxLength = 300; answer.required = true; const button = document.createElement("button"); button.className = "primary"; button.textContent = "Lock in"; form.append(wager, answer, button); form.onsubmit = async (e) => { e.preventDefault(); await setDoc(doc(db, "jeopardyGames", roomId, "responses", user.uid), { wager: Number(wager.value), answer: answer.value.trim(), submittedAt: serverTimestamp() }); myFinalSubmitted = true; renderControls(); }; return form; }
function renderFinalHost(root) {
  const answer = document.createElement("button"); answer.className = "quiet"; answer.textContent = "Reveal correct response"; answer.onclick = async () => { const snap = await getDoc(doc(db, "jeopardyGames", roomId, "private", "answers")); say(`Correct response: ${snap.data()?.finalAnswer || "(not set)"}`); }; root.append(answer);
  replies.forEach((r) => { const row = document.createElement("div"); row.className = "host-tools"; const p = players.find((x) => x.id === r.id); const text = document.createElement("span"); text.textContent = `${p?.name || "Player"}: wager $${r.wager} · “${r.answer || "Wager in"}”${r.scored ? " · scored" : ""}`; row.append(text); if (!r.scored) { const plus = document.createElement("button"); plus.className = "primary"; plus.textContent = "Correct"; plus.onclick = () => scoreFinal(r, true); const minus = document.createElement("button"); minus.className = "secondary"; minus.textContent = "Incorrect"; minus.onclick = () => scoreFinal(r, false); row.append(plus, minus); } root.append(row); });
  const end = document.createElement("button"); end.className = "primary"; end.textContent = "Finish game"; end.onclick = () => updateDoc(gameRef(), { phase: "finished", updatedAt: serverTimestamp() }); root.append(end);
}
async function scoreFinal(reply, correct) {
  const p = players.find((x) => x.id === reply.id); if (!p || reply.scored) return;
  await updateDoc(playerRef(reply.id), { score: Number(p.score || 0) + (correct ? reply.wager : -reply.wager) });
  await updateDoc(doc(db, "jeopardyGames", roomId, "responses", reply.id), { scored: true }); say(`${p.name} ${correct ? "gained" : "lost"} $${reply.wager}.`);
}

function importMarkdown() {
  const lines = $("import-text").value.split(/\r?\n/), rounds = [[], []]; let roundIndex = 0, category = null, clue = null;
  const finishClue = () => { if (!clue || !category) return; const entries = clue.entries, answerItems = entries.filter((x) => !/^additional points/i.test(x)); const answer = answerItems.pop() || ""; const hint = answerItems.filter((x) => !/^say what again|^royale with cheese/i.test(x)); const alternatives = answerItems.filter((x) => /^say what again|^royale with cheese/i.test(x));
    const row = roundValues[roundIndex].indexOf(clue.value), bonusText = entries.find((x) => /^additional points/i.test(x)); if (row >= 0) category.clues[row] = { value: clue.value, question: clue.question + (hint.length ? `\n\nHint: ${hint.join("; ")}` : "") + (bonusText ? `\n\nBonus: ${bonusText}` : ""), answer, acceptedAnswers: alternatives, bonusPoints: bonusText ? 200 : 0, dailyDouble: false };
    clue = null;
  };
  for (const raw of lines) {
    const line = raw.trim();
    if (/^#\s*Round\s*2|^#\s*Double Jeopardy/i.test(line)) { finishClue(); roundIndex = 1; category = null; continue; }
    const categoryMatch = line.match(/^##\s*\d+[.)]\s*(.+)$/);
    if (categoryMatch) { finishClue(); category = { name: categoryMatch[1].trim(), clues: roundValues[roundIndex].map((value) => ({ value, question: "", answer: "", acceptedAnswers: [], bonusPoints: 0, dailyDouble: false })) }; rounds[roundIndex].push(category); continue; }
    const clueMatch = line.match(/^-\s*\$([\d,]+):\s*(.*)$/);
    if (clueMatch && category) { finishClue(); clue = { value: Number(clueMatch[1].replaceAll(",", "")), question: clueMatch[2].trim(), entries: [] }; continue; }
    const entry = line.match(/^-\s+(.+)$/); if (entry && clue) clue.entries.push(entry[1].trim());
  }
  finishClue();
  if (rounds.some((r) => r.length < 2 || r.some((c) => c.clues.some((q) => !q.question || !q.answer)))) { say("I couldn't read the full two-round board. Check that every category has five dollar-value clues with answers below them."); return; }
  $("categories-0").replaceChildren(); $("categories-1").replaceChildren(); rounds.forEach((categories, ri) => categories.forEach((c) => editorCategory(ri, c.name, c.clues)));
  if (!$("deck-name").value.trim() || $("deck-name").value === "Friends Game Night") $("deck-name").value = "GACK 1";
  $("final-category").value = "The Alphabet";
  $("final-question").value = "If you write out every whole number from one to one hundred in English, this letter never appears.";
  $("final-answer").value = "A";
  say(`Imported ${rounds[0].length + rounds[1].length} categories. Review the questions and responses, then save GACK 1.`);
}

$("new-game").onclick = () => { editingDeckId = null; $("save-deck").textContent = "Save board"; $("categories-0").replaceChildren(); $("categories-1").replaceChildren(); defaultCategories.slice(0, 4).forEach((c) => editorCategory(0, c)); defaultCategories.slice(0, 4).forEach((c) => editorCategory(1, c)); $("deck-name").value = "Friends Game Night"; $("import-text").value = ""; $("final-category").value = ""; $("final-question").value = ""; $("final-answer").value = ""; show("editor"); };
$("cancel-editor").onclick = () => { editingDeckId = null; $("save-deck").textContent = "Save board"; show("home"); };
$("add-category-0").onclick = () => { if ($("categories-0").querySelectorAll(".category-editor").length >= 6) return say("Up to six categories per round."); editorCategory(0); };
$("add-category-1").onclick = () => { if ($("categories-1").querySelectorAll(".category-editor").length >= 6) return say("Up to six categories per round."); editorCategory(1); };
$("import-board").onclick = importMarkdown;
$("save-deck").onclick = saveDeck;
$("join-form").onsubmit = async (e) => { e.preventDefault(); const id = $("room-code").value.trim().toUpperCase(); const existing = localStorage.getItem(`jeopardy:${id}`); if (existing) { playerId = existing; isHost = false; enterRoom(id); } else { const name = prompt("What name should appear on the scoreboard?"); if (name?.trim()) joinRoom(id, name); } };
$("player-form").onsubmit = (e) => { e.preventDefault(); joinRoom(roomId, $("player-name").value); };
$("start-board").onclick = () => { const eligible = players.filter((p) => !p.isHost); if (!eligible.length) return say("At least one player needs to join first."); updateDoc(gameRef(), { phase: "board", updatedAt: serverTimestamp() }); };
$("copy-link").onclick = async () => { await navigator.clipboard.writeText(`${location.origin}/jeopardy/?room=${roomId}`); say("Invite link copied."); };
$("leave-room").onclick = () => { offGame?.(); offPlayers?.(); offReplies?.(); game = null; deck = null; isHost = false; show("home"); loadDecks(); };
const params = new URLSearchParams(location.search);
if (!Object.values(config).every(Boolean)) { $("connection").textContent = "Game setup needs Firebase configuration"; say("The game service is not configured yet."); }
else {
  const app = initializeApp(config, "jeopardy"); const auth = getAuth(app); db = getFirestore(app);
  setPersistence(auth, browserLocalPersistence).then(() => auth.authStateReady()).then(() => auth.currentUser || signInAnonymously(auth).then((cred) => cred.user)).then((currentUser) => { user = currentUser; $("connection").textContent = "Connected · live game sync"; return params.get("room") ? (isHost = params.get("host") === "1", enterRoom(params.get("room"))) : loadDecks(); }).catch((e) => { $("connection").textContent = "Connection issue"; say(e.message); });
}
