// Learn screen: progressive lessons that teach the alphabet a few
// characters at a time, both directions — keying a letter's code, and
// naming a letter from its code. Static HTML lives in index.html; this
// module drives the lesson picker, lesson intro, practice loop, and
// lesson-complete sub-views, plus localStorage completion tracking.
//
// State lives at module scope (rather than nested inside one init
// function, like tutorial.js does) because app.js needs an onLearnShow()
// hook it can call every time the Learn screen becomes visible, and that
// hook has to share the same picker/practice state as initLearn().

import { LESSONS, buildQueue, pickChoices } from "/lib/lessons.js";
import { toCode } from "/lib/morse.js";
import { playCode, playSuccessBlip, playErrorBlip } from "./audio.js";
import { createKeyer } from "./keyerui.js";
import { mascotSvg } from "./mascot.js";
import { confettiBurst, sparklePop } from "./celebrate.js";
import { getUnitMs } from "./app.js";

const PROGRESS_KEY = "morse-power.learn.progress";

function codeSymbols(code) {
  return Array.from(code)
    .map((s) => (s === "." ? "●" : "▬"))
    .join(" ");
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && Array.isArray(parsed.completed)) return { completed: parsed.completed };
  } catch {
    // localStorage unavailable or the saved value is corrupt — start fresh.
  }
  return { completed: [] };
}

function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Ignore — progress just won't persist across reloads.
  }
}

function markLessonCompleted(lessonId) {
  const progress = loadProgress();
  if (!progress.completed.includes(lessonId)) {
    progress.completed.push(lessonId);
    saveProgress(progress);
  }
}

// --- DOM refs, filled in by initLearn() ---
let lamp;
let pickerView, lessonListEl;
let introView, introTitleEl, introCardsEl, startBtn;
let practiceView, progressEl, questionEl, feedbackEl;
let completeView, completeTitleEl, completeCopyEl, completeMascotEl, nextLessonBtn;
let views = {};

// --- Practice state ---
let currentLessonIndex = -1;
let queue = [];
let totalQuestions = 0;
let completedCount = 0;
let activeKeyer = null;
let currentPlayback = null;

function cancelPlayback() {
  if (currentPlayback) {
    currentPlayback.cancel();
    currentPlayback = null;
  }
}

// The keyer must never keep listening for spacebar once we've left the
// practice question it was mounted for — destroy it eagerly rather than
// relying only on keyerui's offsetParent visibility guard.
function teardownKeyer() {
  if (activeKeyer) {
    activeKeyer.destroy();
    activeKeyer = null;
  }
}

// Same single-flight playback pattern as tutorial.js: audio.playCode plus a
// lamp element that lights up in sync.
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
  if (name !== "practice") {
    teardownKeyer();
    cancelPlayback();
  }
  for (const [key, el] of Object.entries(views)) {
    el.hidden = key !== name;
  }
}

// --- Lesson picker ---

function renderPicker() {
  const progress = loadProgress();
  lessonListEl.innerHTML = "";

  LESSONS.forEach((lesson, index) => {
    const completed = progress.completed.includes(lesson.id);

    const card = document.createElement("button");
    card.type = "button";
    card.className = "lesson-card" + (completed ? " completed" : "");

    const title = document.createElement("span");
    title.className = "lesson-card-title";
    title.textContent = lesson.title;

    const chars = document.createElement("span");
    chars.className = "lesson-card-chars";
    chars.textContent = lesson.chars.join(" ");

    const status = document.createElement("span");
    status.className = "lesson-card-status";
    status.textContent = completed ? "★" : "☆";
    status.setAttribute("aria-hidden", "true");

    card.append(title, chars, status);
    card.addEventListener("click", () => openLessonIntro(index));
    lessonListEl.appendChild(card);
  });
}

function goToPicker() {
  renderPicker();
  showView("picker");
}

// --- Lesson intro ---

function openLessonIntro(index) {
  currentLessonIndex = index;
  const lesson = LESSONS[index];

  introTitleEl.textContent = lesson.title;
  introCardsEl.innerHTML = "";

  for (const char of lesson.chars) {
    const code = toCode(char);

    const card = document.createElement("div");
    card.className = "learn-intro-card";

    const charEl = document.createElement("span");
    charEl.className = "learn-intro-char";
    charEl.textContent = char;

    const codeEl = document.createElement("span");
    codeEl.className = "learn-intro-code";
    codeEl.textContent = codeSymbols(code);

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "learn-intro-play";
    playBtn.setAttribute("aria-label", `Play the code for ${char}`);
    playBtn.textContent = "▶ Play";
    playBtn.addEventListener("click", () => playAndFlash(code));

    card.append(charEl, codeEl, playBtn);
    introCardsEl.appendChild(card);
  }

  showView("intro");
}

// --- Practice loop ---

function startPractice() {
  queue = buildQueue(currentLessonIndex);
  totalQuestions = queue.length;
  completedCount = 0;
  showView("practice");
  askNext();
}

function askNext() {
  teardownKeyer();
  cancelPlayback();
  feedbackEl.hidden = true;
  feedbackEl.innerHTML = "";
  feedbackEl.className = "learn-feedback";

  if (queue.length === 0) {
    finishLesson();
    return;
  }

  const question = queue.shift();
  progressEl.textContent = `${completedCount + 1} of ${totalQuestions}`;

  if (question.direction === "key") {
    renderKeyQuestion(question);
  } else {
    renderHearQuestion(question);
  }
}

function renderKeyQuestion(question) {
  questionEl.innerHTML = "";

  const sendLine = document.createElement("p");
  sendLine.className = "learn-send-line";
  sendLine.append("Send: ");
  const bigChar = document.createElement("span");
  bigChar.className = "learn-big-char";
  bigChar.textContent = question.char;
  sendLine.appendChild(bigChar);

  const keyerMount = document.createElement("div");
  keyerMount.className = "learn-keyer-mount";

  questionEl.append(sendLine, keyerMount);

  activeKeyer = createKeyer(keyerMount, {
    onLetter: (code) => handleAnswer(question, code === toCode(question.char)),
  });
}

function renderHearQuestion(question) {
  questionEl.innerHTML = "";
  const code = toCode(question.char);

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

  for (const choice of pickChoices(question.char, currentLessonIndex)) {
    const choiceBtn = document.createElement("button");
    choiceBtn.type = "button";
    choiceBtn.className = "learn-choice-btn";
    choiceBtn.textContent = choice;
    choiceBtn.addEventListener("click", () => {
      for (const btn of choicesEl.querySelectorAll(".learn-choice-btn")) {
        btn.disabled = true;
      }
      handleAnswer(question, choice === question.char);
    });
    choicesEl.appendChild(choiceBtn);
  }

  questionEl.append(prompt, replayBtn, choicesEl);
  playAndFlash(code);
}

function handleAnswer(question, correct) {
  // Stop accepting more key input the instant this question is answered.
  teardownKeyer();
  const code = toCode(question.char);

  feedbackEl.hidden = false;
  feedbackEl.className = "learn-feedback " + (correct ? "learn-feedback-good" : "learn-feedback-bad");

  const message = document.createElement("p");
  message.className = "learn-feedback-message";
  message.textContent = correct
    ? `Yes! ${codeSymbols(code)} is ${question.char}`
    : `Not quite — ${codeSymbols(code)} is ${question.char}. Listen again:`;
  feedbackEl.appendChild(message);

  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-coral";
  nextBtn.textContent = "Next";
  nextBtn.addEventListener("click", askNext);
  feedbackEl.appendChild(nextBtn);
  nextBtn.focus();

  if (correct) {
    playSuccessBlip();
    sparklePop(feedbackEl);
    completedCount++;
  } else {
    playErrorBlip();
    playAndFlash(code);
    queue.push(question);
  }
}

// --- Lesson complete ---

function finishLesson() {
  const lesson = LESSONS[currentLessonIndex];
  markLessonCompleted(lesson.id);

  completeTitleEl.textContent = `${lesson.title} complete!`;
  completeCopyEl.textContent = `Great job! You've learned ${lesson.chars.join(", ")}.`;
  completeMascotEl.innerHTML = mascotSvg("cheer", { size: 108 });

  const hasNext = currentLessonIndex + 1 < LESSONS.length;
  nextLessonBtn.hidden = !hasNext;
  // Assigning .onclick (rather than addEventListener) keeps this idempotent
  // across repeated lesson completions in one session — no listeners pile up.
  nextLessonBtn.onclick = hasNext ? () => openLessonIntro(currentLessonIndex + 1) : null;

  showView("complete");
  confettiBurst(completeMascotEl);
}

export function initLearn() {
  lamp = document.getElementById("learn-lamp");

  pickerView = document.getElementById("learn-picker");
  lessonListEl = document.getElementById("learn-lesson-list");

  introView = document.getElementById("learn-intro");
  introTitleEl = document.getElementById("learn-intro-title");
  introCardsEl = document.getElementById("learn-intro-cards");
  startBtn = document.getElementById("learn-start-btn");

  practiceView = document.getElementById("learn-practice");
  progressEl = document.getElementById("learn-progress");
  questionEl = document.getElementById("learn-question");
  feedbackEl = document.getElementById("learn-feedback");

  completeView = document.getElementById("learn-complete");
  completeTitleEl = document.getElementById("learn-complete-title");
  completeCopyEl = document.getElementById("learn-complete-copy");
  completeMascotEl = document.getElementById("learn-complete-mascot");
  nextLessonBtn = document.getElementById("learn-next-btn");

  views = { picker: pickerView, intro: introView, practice: practiceView, complete: completeView };

  startBtn.addEventListener("click", startPractice);
  for (const btn of document.querySelectorAll('#screen-learn [data-learn-back="picker"]')) {
    btn.addEventListener("click", goToPicker);
  }

  renderPicker();
  showView("picker");
}

// Called by app.js whenever the outer router navigates to the Learn screen
// — always land on the lesson picker (with freshly reloaded stars) rather
// than wherever a previous visit left off, and make sure any in-progress
// practice question's keyer/audio is torn down.
export function onLearnShow() {
  goToPicker();
}
