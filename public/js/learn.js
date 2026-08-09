// Learn screen: a continuous three-phase flashcard system covering all 36
// characters (A-Z, then 0-9). Static HTML lives in index.html; this module
// drives the phase-overview and the single shared "card" view that all
// three phases render into, plus a phase-complete celebration, and the
// per-phase localStorage completion tracking.
//
// The three phases share one deck (lib/flashcards.js's DECK) and one
// card-run loop, differing only in how a card is rendered and what
// happens on a wrong answer:
//   1. practice — alphabet order, code shown on the card, wrong answers
//      just retry the same card (the code's already visible, so there's
//      nothing to reveal).
//   2. test     — shuffled order, no code shown, wrong answers reveal the
//      code (lamp + audio) then move to a different card, re-queuing the
//      missed one to come back later.
//   3. listen   — shuffled order, code played first, four-letter multiple
//      choice; wrong answers behave like phase 2 (reveal + re-queue).
//
// State lives at module scope (same reasoning as the old learn.js/play.js)
// because app.js needs an onLearnShow() hook it can call every time the
// Learn screen becomes visible, and that hook has to share state with
// initLearn().

import { DECK, remaining, shuffled, requeue, pickListenChoices } from "/lib/flashcards.js";
import { toCode } from "/lib/morse.js";
import { playCode, playSuccessBlip, playErrorBlip } from "./audio.js";
import { createKeyer } from "./keyerui.js";
import { mascotSvg } from "./mascot.js";
import { confettiBurst, sparklePop } from "./celebrate.js";
import { getUnitMs } from "./app.js";

const PROGRESS_KEY = "morse-power.learn.flashcards";
const PHASE_IDS = ["practice", "test", "listen"];

// How long to hold on a revealed answer (code shown + played) before
// auto-advancing to the next card, on top of however long the code itself
// takes to play.
const REVEAL_PAUSE_MS = 900;

// Where a missed test/listen card lands back in the queue, relative to the
// front — see lib/flashcards.js's requeue() for the exact rule.
const REQUEUE_GAP = 4;

const PHASE_META = [
  {
    id: "practice",
    title: "1. Practice (see the code)",
    shortTitle: "Practice",
    desc: "The card shows the code — key it on the telegraph key.",
    completeCopy: "You've keyed the code for every letter and number!",
  },
  {
    id: "test",
    title: "2. Test yourself",
    shortTitle: "Test",
    desc: "No codes this time — key each one from memory.",
    completeCopy: "You keyed every letter and number correctly from memory!",
  },
  {
    id: "listen",
    title: "3. Listen",
    shortTitle: "Listen",
    desc: "Hear a code, then pick the letter it spells.",
    completeCopy: "You matched every code by ear!",
  },
];

function codeSymbols(code) {
  return Array.from(code)
    .map((s) => (s === "." ? "●" : "▬"))
    .join(" ");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      const progress = {};
      for (const id of PHASE_IDS) {
        progress[id] = Array.isArray(parsed[id]) ? parsed[id] : [];
      }
      return progress;
    }
  } catch {
    // localStorage unavailable or the saved value is corrupt — start fresh.
  }
  return { practice: [], test: [], listen: [] };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Ignore — progress just won't persist across reloads.
  }
}

function markDone(phase, char) {
  const progress = loadProgress();
  if (!progress[phase].includes(char)) {
    progress[phase].push(char);
    saveProgress(progress);
  }
}

function clearPhaseProgress(phase) {
  const progress = loadProgress();
  progress[phase] = [];
  saveProgress(progress);
}

// --- DOM refs, filled in by initLearn() ---
let lamp;
let overviewView, phaseListEl;
let cardView, progressEl, questionEl, feedbackEl;
let celebrateView, celebrateTitleEl, celebrateCopyEl, celebrateMascotEl;
let views = {};

// --- Card-run state ---
let currentPhase = null;
let queue = [];
let activeKeyer = null;
let currentPlayback = null;
let advanceTimer = null;
// Bumped every time we leave/restart a run, so async continuations from a
// stale run (a reveal's setTimeout, a playback's .done) can tell they're
// no longer relevant and quietly no-op instead of mutating state for a
// screen the player has already left — same idea as play.js's
// `lastResult !== result` guard, adapted for a run that has no single
// result object to compare against.
let runToken = 0;

function cancelPlayback() {
  if (currentPlayback) {
    currentPlayback.cancel();
    currentPlayback = null;
  }
}

// Eager teardown rather than relying only on the keyer's own visibility
// guard — same reasoning as the old learn.js/play.js.
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
    onOn: () => lamp.classList.add("lit"),
    onOff: () => lamp.classList.remove("lit"),
  });
  currentPlayback = controller;
  controller.done.then(() => {
    if (currentPlayback === controller) currentPlayback = null;
  });
  return controller;
}

function showView(name) {
  if (name !== "card") {
    teardownKeyer();
    cancelPlayback();
  }
  // A card run needs every vertical pixel: the flashcard and the
  // telegraph key should both fit on screen together, so the screen
  // heading gets out of the way — same trick the old lesson practice loop
  // used.
  document.getElementById("screen-learn").classList.toggle("card-active", name === "card");
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

function hideFeedback() {
  feedbackEl.hidden = true;
  feedbackEl.textContent = "";
  feedbackEl.className = "learn-feedback";
}

function showFeedback(kind, text) {
  feedbackEl.hidden = false;
  feedbackEl.className = "learn-feedback learn-feedback-" + kind;
  feedbackEl.textContent = text;
}

// --- Overview ---

function renderOverview() {
  const progress = loadProgress();
  phaseListEl.innerHTML = "";

  PHASE_META.forEach((meta, index) => {
    const doneCount = progress[meta.id].length;
    const complete = doneCount >= DECK.length;
    // Phase 2 is visually nudged once phase 1 is finished (owner: "phase 2
    // visually suggested after phase 1") — every phase stays tappable
    // regardless, this is just a hint about a sensible next step.
    const previousDone = index === 0 ? true : progress[PHASE_META[index - 1].id].length >= DECK.length;
    const suggested = previousDone && !complete && index > 0;

    const card = document.createElement("div");
    card.className = "phase-card" + (complete ? " phase-card-complete" : "");

    const head = document.createElement("div");
    head.className = "phase-card-head";

    const titleEl = document.createElement("span");
    titleEl.className = "phase-card-title";
    titleEl.textContent = meta.title;
    head.appendChild(titleEl);

    if (complete) {
      const star = document.createElement("span");
      star.className = "phase-card-star";
      star.textContent = "★";
      star.setAttribute("aria-hidden", "true");
      head.appendChild(star);
    }

    const descEl = document.createElement("p");
    descEl.className = "phase-card-desc";
    descEl.textContent = meta.desc;

    card.append(head, descEl);

    if (suggested) {
      const badge = document.createElement("span");
      badge.className = "phase-card-suggested";
      badge.textContent = "Try this next!";
      card.appendChild(badge);
    }

    const barOuter = document.createElement("div");
    barOuter.className = "phase-card-bar";
    const barFill = document.createElement("div");
    barFill.className = "phase-card-bar-fill";
    barFill.style.width = `${Math.round((doneCount / DECK.length) * 100)}%`;
    barOuter.appendChild(barFill);

    const progressText = document.createElement("p");
    progressText.className = "phase-card-progress";
    progressText.textContent = `${doneCount} of ${DECK.length} done`;

    const buttons = document.createElement("div");
    buttons.className = "phase-card-buttons";

    const continueBtn = document.createElement("button");
    continueBtn.type = "button";
    continueBtn.className = "btn btn-coral";
    continueBtn.textContent = complete ? "Play again" : doneCount > 0 ? "Continue" : "Start";
    continueBtn.addEventListener("click", () => startPhase(meta.id));
    buttons.appendChild(continueBtn);

    if (doneCount > 0) {
      const resetBtn = document.createElement("button");
      resetBtn.type = "button";
      resetBtn.className = "phase-reset-btn";
      resetBtn.textContent = "Start over";
      resetBtn.addEventListener("click", () => {
        clearPhaseProgress(meta.id);
        renderOverview();
      });
      buttons.appendChild(resetBtn);
    }

    card.append(barOuter, progressText, buttons);
    phaseListEl.appendChild(card);
  });
}

function goToOverview() {
  runToken++;
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();
  currentPhase = null;
  queue = [];
  renderOverview();
  showView("overview");
}

// --- Card run ---

function startPhase(phaseId) {
  runToken++;
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();

  currentPhase = phaseId;
  const progress = loadProgress();
  const notDone = remaining(DECK, progress[phaseId]);
  // Resume = skip completed cards: phase 1 continues at the first not-done
  // character in deck order; phases 2/3 shuffle the not-done remainder.
  queue = phaseId === "practice" ? notDone : shuffled(notDone, Math.random);

  showView("card");
  askNext();
}

function askNext() {
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();
  hideFeedback();

  if (queue.length === 0) {
    showCelebration();
    return;
  }

  const progress = loadProgress();
  progressEl.textContent = `${progress[currentPhase].length} of ${DECK.length}`;

  questionEl.innerHTML = "";
  const char = queue[0];
  if (currentPhase === "practice") renderPracticeCard(char);
  else if (currentPhase === "test") renderTestCard(char);
  else renderListenCard(char);
}

function renderPracticeCard(char) {
  const card = document.createElement("div");
  card.className = "flash-card";

  const charEl = document.createElement("span");
  charEl.className = "flash-card-char";
  charEl.textContent = char;

  const codeEl = document.createElement("span");
  codeEl.className = "flash-card-code";
  codeEl.textContent = codeSymbols(toCode(char));

  card.append(charEl, codeEl);

  const keyerMount = document.createElement("div");
  keyerMount.className = "learn-keyer-mount";

  questionEl.append(card, keyerMount);

  activeKeyer = createKeyer(keyerMount, {
    onLetter: (code) => {
      if (code === toCode(char)) handleCorrect(char);
      else handlePracticeWrong();
    },
  });
}

function renderTestCard(char) {
  const card = document.createElement("div");
  card.className = "flash-card";

  const charEl = document.createElement("span");
  charEl.className = "flash-card-char";
  charEl.textContent = char;
  card.appendChild(charEl);

  const keyerMount = document.createElement("div");
  keyerMount.className = "learn-keyer-mount";

  questionEl.append(card, keyerMount);

  activeKeyer = createKeyer(keyerMount, {
    onLetter: (code) => {
      if (code === toCode(char)) handleCorrect(char);
      else handleQuizWrong(char);
    },
  });
}

function renderListenCard(char) {
  const code = toCode(char);

  const prompt = document.createElement("p");
  prompt.className = "learn-send-line";
  prompt.textContent = "Listen, then pick the letter:";

  const replayBtn = document.createElement("button");
  replayBtn.type = "button";
  replayBtn.className = "btn btn-teal learn-replay-btn";
  replayBtn.textContent = "Hear it again";
  replayBtn.addEventListener("click", () => playAndFlash(code));

  const choicesEl = document.createElement("div");
  choicesEl.className = "learn-choices";

  for (const choice of pickListenChoices(char, 4, Math.random)) {
    const choiceBtn = document.createElement("button");
    choiceBtn.type = "button";
    choiceBtn.className = "learn-choice-btn";
    choiceBtn.textContent = choice;
    choiceBtn.addEventListener("click", () => {
      for (const btn of choicesEl.querySelectorAll(".learn-choice-btn")) {
        btn.disabled = true;
      }
      if (choice === char) {
        handleCorrect(char);
        return;
      }
      choiceBtn.classList.add("learn-choice-wrong");
      for (const btn of choicesEl.querySelectorAll(".learn-choice-btn")) {
        if (btn.textContent === char) btn.classList.add("learn-choice-correct");
      }
      handleQuizWrong(char);
    });
    choicesEl.appendChild(choiceBtn);
  }

  questionEl.append(prompt, replayBtn, choicesEl);
  playAndFlash(code);
}

// Correct on any phase: blip + sparkle, mark the character done, drop it
// off the front of the queue, move on.
function handleCorrect(char) {
  teardownKeyer();
  playSuccessBlip();
  sparklePop(questionEl);
  markDone(currentPhase, char);
  queue.shift();
  askNext();
}

// Phase 1 wrong: the code is already on the card, so there's nothing to
// reveal — just a gentle nudge. The same card (and the same keyer
// instance) stays put so the player can retry immediately.
function handlePracticeWrong() {
  playErrorBlip();
  showFeedback("bad", "Not quite — try again!");
}

// Phase 2/3 wrong: reveal the code (lamp + audio), then move to a
// different card once the reveal has had time to sink in. The missed
// character comes off the front of the queue and gets re-queued a few
// cards later, rather than being retried immediately — a post-reveal
// retry is not how this character gets marked done.
function handleQuizWrong(char) {
  const token = runToken;
  playErrorBlip();
  teardownKeyer();
  queue.shift();

  const code = toCode(char);
  showFeedback("bad", `Not quite — ${char} is ${codeSymbols(code)}`);
  const controller = playAndFlash(code);

  controller.done.then(() => {
    if (token !== runToken) return;
    advanceTimer = setTimeout(() => {
      if (token !== runToken) return;
      advanceTimer = null;
      queue = requeue(queue, char, REQUEUE_GAP, Math.random);
      askNext();
    }, REVEAL_PAUSE_MS);
  });
}

// --- Phase complete ---

function showCelebration() {
  clearAdvanceTimer();
  teardownKeyer();
  cancelPlayback();

  const meta = PHASE_META.find((p) => p.id === currentPhase);
  celebrateTitleEl.textContent = `${meta.shortTitle} complete!`;
  celebrateCopyEl.textContent = meta.completeCopy;
  celebrateMascotEl.innerHTML = mascotSvg("cheer", { size: 108 });

  showView("celebrate");
  confettiBurst(celebrateMascotEl);
}

export function initLearn() {
  lamp = document.getElementById("learn-lamp");

  overviewView = document.getElementById("learn-overview");
  phaseListEl = document.getElementById("learn-phase-list");

  cardView = document.getElementById("learn-card");
  progressEl = document.getElementById("learn-progress");
  questionEl = document.getElementById("learn-question");
  feedbackEl = document.getElementById("learn-feedback");

  celebrateView = document.getElementById("learn-celebrate");
  celebrateTitleEl = document.getElementById("learn-celebrate-title");
  celebrateCopyEl = document.getElementById("learn-celebrate-copy");
  celebrateMascotEl = document.getElementById("learn-celebrate-mascot");

  views = { overview: overviewView, card: cardView, celebrate: celebrateView };

  for (const btn of document.querySelectorAll('#screen-learn [data-learn-back="overview"]')) {
    btn.addEventListener("click", goToOverview);
  }

  renderOverview();
  showView("overview");
}

// Called by app.js whenever the outer router navigates to the Learn screen
// — always land on the overview (with freshly reloaded progress counts)
// rather than wherever a previous visit left off, and make sure any
// in-progress card's keyer/audio/timers are torn down.
export function onLearnShow() {
  goToOverview();
}
