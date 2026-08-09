// App shell: tiny screen router + shared settings (speed).
// Entry point loaded by index.html as a module script.

import { SPEEDS } from "/lib/keyer.js";
import { initTutorial } from "./tutorial.js";

const SPEED_STORAGE_KEY = "morse-power.speed";
const DEFAULT_SPEED = "medium";
const SCREEN_NAMES = ["home", "tutorial", "learn", "play"];

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

function initSpeedPicker() {
  for (const btn of document.querySelectorAll("#speed-picker [data-speed]")) {
    btn.addEventListener("click", () => setSpeed(btn.dataset.speed));
  }
  syncSpeedButtons();
}

function init() {
  initRouter();
  initSpeedPicker();
  initTutorial();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
