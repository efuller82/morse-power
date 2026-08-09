// App shell: tiny screen router + shared settings (speed).
// Entry point loaded by index.html as a module script.

import { SPEEDS } from "/lib/keyer.js";
import { setSoundOn } from "./audio.js";
import { initTutorial } from "./tutorial.js";
import { initLearn, onLearnShow } from "./learn.js";
import { initPlay, onPlayShow } from "./play.js";
import { initScores, onScoresShow } from "./scores.js";

const SPEED_STORAGE_KEY = "morse-power.speed";
const SOUND_STORAGE_KEY = "morse-power.sound";
const DEFAULT_SPEED = "medium";
const SCREEN_NAMES = ["home", "tutorial", "learn", "play", "scores"];

let speed = loadSpeed();

function loadSpeed() {
  try {
    const saved = localStorage.getItem(SPEED_STORAGE_KEY);
    if (saved && SPEEDS[saved]) return saved;
  } catch {
    // localStorage unavailable (privacy mode, etc.) — fall back to default.
  }
  return DEFAULT_SPEED;
}

function saveSpeed(value) {
  try {
    localStorage.setItem(SPEED_STORAGE_KEY, value);
  } catch {
    // Ignore — speed just won't persist across reloads.
  }
}

// Exposed for other modules (keyerui, tutorial, later learn/play).
export function getUnitMs() {
  return SPEEDS[speed] ?? SPEEDS[DEFAULT_SPEED];
}

export function getSpeed() {
  return speed;
}

function setSpeed(value) {
  if (!SPEEDS[value] || value === speed) return;
  speed = value;
  saveSpeed(value);
  syncSpeedButtons();
}

export function showScreen(name) {
  const target = SCREEN_NAMES.includes(name) ? name : "home";
  for (const section of document.querySelectorAll("main > section[data-screen]")) {
    section.hidden = section.dataset.screen !== target;
  }
  // Learn keeps its own picker/intro/practice/complete sub-views; make sure
  // arriving here always starts at the (freshly starred) picker.
  if (target === "learn") onLearnShow();
  // Same idea for Play: always land on the direction choice, and tear down
  // any round left running in the background.
  if (target === "play") onPlayShow();
  // High Scores always refetches on show, so it never displays stale data.
  if (target === "scores") onScoresShow();
}

function syncSpeedButtons() {
  for (const btn of document.querySelectorAll("#speed-picker [data-speed]")) {
    btn.setAttribute("aria-pressed", String(btn.dataset.speed === speed));
  }
}

function initRouter() {
  for (const btn of document.querySelectorAll("[data-goto]")) {
    btn.addEventListener("click", () => showScreen(btn.dataset.goto));
  }
  showScreen("home");
}

function initSoundToggle() {
  const btn = document.getElementById("sound-toggle");
  const icon = document.getElementById("sound-icon");
  let on = true;
  try {
    on = localStorage.getItem(SOUND_STORAGE_KEY) !== "off";
  } catch {
    // localStorage unavailable — default to sound on.
  }

  function apply() {
    setSoundOn(on);
    btn.setAttribute("aria-pressed", String(on));
    icon.textContent = on ? "🔊" : "🔇";
    btn.classList.toggle("sound-off", !on);
  }

  btn.addEventListener("click", () => {
    on = !on;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, on ? "on" : "off");
    } catch {
      // Ignore — the choice just won't persist.
    }
    apply();
  });

  apply();
}

function initSpeedPicker() {
  for (const btn of document.querySelectorAll("#speed-picker [data-speed]")) {
    btn.addEventListener("click", () => setSpeed(btn.dataset.speed));
  }
  syncSpeedButtons();
}

function init() {
  initRouter();
  initSpeedPicker();
  initSoundToggle();
  initTutorial();
  initLearn();
  initPlay();
  initScores();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
