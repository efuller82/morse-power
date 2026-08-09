// Play screen: 60-second scored rounds against an endless random word
// stream (anti-memorization — never a fixed passage). Two directions:
// "send" (char shown, key its code) and "catch" (code played, name the
// letter — keyboard or on-screen grid). Static HTML lives in index.html;
// this module drives the direction-choice/round/results sub-views.
//
// State lives at module scope (same reasoning as learn.js): app.js needs
// an onPlayShow() hook it can call every time the Play screen becomes
// visible, and that hook has to share state with initPlay().

import { wordStream, wpm } from "/lib/words.js";
import { toCode } from "/lib/morse.js";
import { qualifies } from "/lib/scores.js";
import { playCode, playSuccessBlip, playErrorBlip } from "./audio.js";
import { createKeyer } from "./keyerui.js";
import { mascotSvg } from "./mascot.js";
import { confettiBurst } from "./celebrate.js";
import { getUnitMs } from "./app.js";
import { fetchScores, renderBoard } from "./scores.js";

const ROUND_SECONDS = 60;
const LOW_TIME_SECONDS = 10;
const MISS_REVEAL_MS = 1200;
const TIMER_TICK_MS = 250;

const ANSWER_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

// play.js's internal round "direction" already happens to spell the same
// words as the leaderboard API's "mode", but the mapping is kept explicit
// (rather than passing `direction` straight through) so the two naming
// schemes are free to diverge later without a silent breakage.
const DIRECTION_TO_MODE = { send: "send", catch: "catch" };
function directionToMode(dir) {
  return DIRECTION_TO_MODE[dir] ?? dir;
}

function codeSymbols(code) {
  return Array.from(code)
    .map((s) => (s === "." ? "●" : "▬"))
    .join(" ");
}

// --- DOM refs, filled in by initPlay() ---
let views = {};
let quitBtn, timerEl, tallyEl, lampEl, wordEl, inputEl, skipBtn;
let resultCorrectEl, resultMissedEl, resultWpmEl, resultMascotEl, againBtn, changeModeBtn;
let scoreboardStatusEl, scoreboardEntryEl, nameInputEl, saveScoreBtn;
let scoreboardResultEl, scoreboardRankEl, scoreboardResultListEl;

// --- Round state ---
let direction = "send";
let stream = null;
let currentWord = "";
let charIndex = 0;
let correctCount = 0;
let missedCount = 0;
let roundEndAt = 0;
let timerInterval = null;
let activeKeyer = null;
let currentPlayback = null;
let advanceTimer = null;
let roundRunning = false;

// The just-finished round's result, kept around so handleSaveScore() can
// POST it once the player has typed a name.
let lastResult = null;

function cancelPlayback() {
  if (currentPlayback) {
    currentPlayback.cancel();
    currentPlayback = null;
  }
}

// Eager teardown rather than relying only on the keyer's own visibility
// guard — same reasoning as learn.js's teardownKeyer.
function teardownKeyer() {
  if (activeKeyer) {
    activeKeyer.destroy();
    activeKeyer = null;
  }
}

function clearAdvanceTimer() {
  if (advanceTimer !== null) {
    clearTimeout(advanceTimer);
    advanceTimer = null;
  }
}

function playAndFlash(code) {
  cancelPlayback();
  const controller = playCode(code, getUnitMs(), {
    onOn: () => lampEl.classList.add("lit"),
    onOff: () => lampEl.classList.remove("lit"),
  });
  currentPlayback = controller;
  controller.done.then(() => {
    if (currentPlayback === controller) currentPlayback = null;
  });
  return controller;
}

function showView(name) {
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

// True only while the round sub-view is actually on screen (accounts for
// the outer #screen-play also being hidden, not just this sub-view) —
// mirrors keyerui.js's offsetParent visibility-guard pattern.
function isRoundVisible() {
  return views.round.offsetParent !== null;
}

// --- Timer ---

function stopTimer() {
  if (timerInterval !== null) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(secondsOverride) {
  const seconds = secondsOverride ?? Math.max(0, Math.ceil((roundEndAt - performance.now()) / 1000));
  timerEl.textContent = String(seconds);
  timerEl.classList.toggle("play-timer-low", seconds <= LOW_TIME_SECONDS);
}

function tickTimer() {
  const remainingMs = roundEndAt - performance.now();
  if (remainingMs <= 0) {
    updateTimerDisplay(0);
    endRound();
    return;
  }
  updateTimerDisplay(Math.ceil(remainingMs / 1000));
}

function startTimer() {
  stopTimer(); // guards against double-running if the player restarts quickly
  roundEndAt = performance.now() + ROUND_SECONDS * 1000;
  updateTimerDisplay(ROUND_SECONDS);
  timerInterval = setInterval(tickTimer, TIMER_TICK_MS);
}

// --- Round flow ---

function updateTally() {
  tallyEl.textContent = `${correctCount} correct · ${missedCount} missed`;
}

function renderWord() {
  wordEl.innerHTML = "";
  Array.from(currentWord).forEach((ch, i) => {
    const span = document.createElement("span");
    let cls = "play-word-char";
    if (i < charIndex) cls += " play-word-done";
    else if (i === charIndex) cls += " play-word-current";
    span.className = cls;
    span.textContent = ch;
    wordEl.appendChild(span);
  });
}

function renderSendInput(char) {
  const keyerMount = document.createElement("div");
  keyerMount.className = "play-keyer-mount";
  inputEl.appendChild(keyerMount);
  activeKeyer = createKeyer(keyerMount, {
    onLetter: (code) => handleAnswer(code === toCode(char)),
  });
}

function renderCatchInput(char) {
  const replayBtn = document.createElement("button");
  replayBtn.type = "button";
  replayBtn.className = "btn btn-teal play-replay-btn";
  replayBtn.textContent = "Hear it again";
  replayBtn.addEventListener("click", () => playAndFlash(toCode(char)));

  const grid = document.createElement("div");
  grid.className = "play-answer-grid";
  for (const answerChar of ANSWER_CHARS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "play-answer-btn";
    btn.textContent = answerChar;
    btn.setAttribute("aria-label", `Answer ${answerChar}`);
    btn.addEventListener("click", () => handleAnswer(answerChar === char));
    grid.appendChild(btn);
  }

  inputEl.append(replayBtn, grid);
  playAndFlash(toCode(char));
}

function askCurrentChar() {
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();
  renderWord();
  inputEl.innerHTML = "";

  const char = currentWord[charIndex];
  if (direction === "send") {
    renderSendInput(char);
  } else {
    renderCatchInput(char);
  }
}

function advanceChar() {
  if (!roundRunning) return;
  charIndex++;
  if (charIndex >= currentWord.length) {
    currentWord = stream.next();
    charIndex = 0;
  }
  askCurrentChar();
}

function showMissReveal(char) {
  const code = toCode(char);
  inputEl.innerHTML = "";
  const msg = document.createElement("p");
  msg.className = "play-miss-message";
  msg.textContent = `${char} = ${codeSymbols(code)}`;
  inputEl.appendChild(msg);
}

function handleAnswer(correct) {
  if (!roundRunning) return;
  teardownKeyer();
  cancelPlayback();
  clearAdvanceTimer();

  if (correct) {
    playSuccessBlip();
    correctCount++;
    updateTally();
    advanceChar();
    return;
  }

  playErrorBlip();
  missedCount++;
  updateTally();
  showMissReveal(currentWord[charIndex]);
  advanceTimer = setTimeout(() => {
    advanceTimer = null;
    advanceChar();
  }, MISS_REVEAL_MS);
}

function handleSkip() {
  if (!roundRunning) return;
  teardownKeyer();
  cancelPlayback();
  clearAdvanceTimer();
  missedCount++;
  updateTally();
  advanceChar(); // no reveal delay — skip advances immediately
}

function startRound(dir) {
  direction = dir;
  stream = wordStream();
  currentWord = stream.next();
  charIndex = 0;
  correctCount = 0;
  missedCount = 0;
  roundRunning = true;

  updateTally();
  showView("round");
  startTimer();
  askCurrentChar();
}

// --- Leaderboard (results-view scoreboard block) ---

function resetScoreboardUi() {
  scoreboardStatusEl.textContent = "";
  scoreboardEntryEl.hidden = true;
  scoreboardResultEl.hidden = true;
  nameInputEl.value = "";
  saveScoreBtn.disabled = false;
}

// Fetches the current leaderboard and, if this round's score would make
// the Top 10, reveals the name-entry block. Fire-and-forget from
// showResults() — nothing else on the results view depends on it.
async function checkLeaderboard(result) {
  let scores;
  try {
    scores = await fetchScores();
  } catch {
    scoreboardStatusEl.textContent = "Scoreboard is napping.";
    return;
  }
  if (lastResult !== result) return; // a newer round finished while we waited
  if (qualifies(scores, result.mode, result.wpm, result.correct)) {
    scoreboardStatusEl.textContent = "You made the Top 10!";
    scoreboardEntryEl.hidden = false;
    resultMascotEl.innerHTML = mascotSvg("cheer", { size: 100 });
    nameInputEl.focus();
  }
}

async function handleSaveScore() {
  if (!lastResult) return;
  const result = lastResult;
  saveScoreBtn.disabled = true;
  try {
    const res = await fetch("/api/scores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInputEl.value,
        mode: result.mode,
        wpm: result.wpm,
        correct: result.correct,
        missed: result.missed,
      }),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
    const body = await res.json();
    if (lastResult !== result) return; // a newer round finished while we waited

    scoreboardEntryEl.hidden = true;
    scoreboardStatusEl.textContent = "";
    if (body.rank) {
      scoreboardRankEl.textContent = `You're #${body.rank}!`;
      renderBoard(scoreboardResultListEl, body.scores, result.mode, body.rank);
      scoreboardResultEl.hidden = false;
      playSuccessBlip();
      confettiBurst(scoreboardRankEl);
    }
  } catch {
    if (lastResult !== result) return;
    saveScoreBtn.disabled = false;
    scoreboardStatusEl.textContent = "Scoreboard is napping. Try again soon.";
  }
}

function showResults() {
  const result = {
    mode: directionToMode(direction),
    correct: correctCount,
    missed: missedCount,
    wpm: wpm(correctCount),
  };
  lastResult = result;
  resultCorrectEl.textContent = String(result.correct);
  resultMissedEl.textContent = String(result.missed);
  resultWpmEl.textContent = String(result.wpm);
  // Encouraging by default — checkLeaderboard() below upgrades this to a
  // cheer if the round turns out to qualify for the Top 10.
  resultMascotEl.innerHTML = mascotSvg("wave", { size: 100 });
  resetScoreboardUi();
  showView("results");
  checkLeaderboard(result);
}

function endRound() {
  roundRunning = false;
  stopTimer();
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();
  showResults();
}

function quitRound() {
  roundRunning = false;
  stopTimer();
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();
  showView("choice");
}

// Physical keyboard answers for "catch" mode. Left permanently registered
// (rather than added/removed on view change) and gated internally — same
// visibility-guard pattern keyerui.js uses for its spacebar handler.
function onWindowKeydown(e) {
  if (!roundRunning || direction !== "catch" || !isRoundVisible()) return;
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const key = e.key.toUpperCase();
  if (!/^[A-Z0-9]$/.test(key)) return;
  e.preventDefault();
  handleAnswer(key === currentWord[charIndex]);
}

export function initPlay() {
  views = {
    choice: document.getElementById("play-choice"),
    round: document.getElementById("play-round"),
    results: document.getElementById("play-results"),
  };

  quitBtn = document.getElementById("play-quit-btn");
  timerEl = document.getElementById("play-timer");
  tallyEl = document.getElementById("play-tally");
  lampEl = document.getElementById("play-lamp");
  wordEl = document.getElementById("play-word");
  inputEl = document.getElementById("play-input");
  skipBtn = document.getElementById("play-skip-btn");

  resultCorrectEl = document.getElementById("play-result-correct");
  resultMissedEl = document.getElementById("play-result-missed");
  resultWpmEl = document.getElementById("play-result-wpm");
  resultMascotEl = document.getElementById("play-result-mascot");
  againBtn = document.getElementById("play-again-btn");
  changeModeBtn = document.getElementById("play-change-mode-btn");

  scoreboardStatusEl = document.getElementById("play-scoreboard-status");
  scoreboardEntryEl = document.getElementById("play-scoreboard-entry");
  nameInputEl = document.getElementById("play-name-input");
  saveScoreBtn = document.getElementById("play-save-score-btn");
  scoreboardResultEl = document.getElementById("play-scoreboard-result");
  scoreboardRankEl = document.getElementById("play-scoreboard-rank");
  scoreboardResultListEl = document.getElementById("play-scoreboard-result-list");

  for (const btn of document.querySelectorAll("[data-play-direction]")) {
    btn.addEventListener("click", () => startRound(btn.dataset.playDirection));
  }
  quitBtn.addEventListener("click", quitRound);
  skipBtn.addEventListener("click", handleSkip);
  againBtn.addEventListener("click", () => startRound(direction));
  changeModeBtn.addEventListener("click", () => showView("choice"));
  saveScoreBtn.addEventListener("click", handleSaveScore);

  window.addEventListener("keydown", onWindowKeydown);

  showView("choice");
}

// Called by app.js whenever the outer router navigates to the Play screen
// — always land on the direction choice, and make sure any in-progress
// round's timer/keyer/audio/listeners are torn down. Mirrors learn.js's
// onLearnShow() reset hook.
export function onPlayShow() {
  quitRound();
}
