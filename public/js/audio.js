// Shared Web Audio module. Browser-only (uses window.AudioContext) — reused
// by Tutorial now, and later by Learn/Play.

import { LETTER_GAP_UNITS, WORD_GAP_UNITS } from "/lib/keyer.js";

const TONE_HZ = 600;
const TONE_GAIN = 0.3;
const RAMP_S = 0.008;

const DOT_UNITS = 1;
const DASH_UNITS = 3;
const ELEMENT_GAP_UNITS = 1;

let audioCtx = null;

// Global sound switch — when off, tones are skipped entirely but playCode's
// lamp callbacks still fire, so the game stays playable as silent
// dot-and-dash (light) mode.
let soundOn = true;

export function setSoundOn(value) {
  soundOn = Boolean(value);
  if (!soundOn) stopTone();
}

export function isSoundOn() {
  return soundOn;
}

// Lazily create (or resume) the shared AudioContext. Must be called from a
// user-gesture handler the first time, per browser autoplay policy. Returns
// null if audio is unavailable/blocked — callers must degrade gracefully.
function ensureContext() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

let toneOsc = null;
let toneGain = null;

// Continuous tone for while the telegraph key is held.
export function startTone() {
  stopTone();
  if (!soundOn) return;
  const ctx = ensureContext();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = TONE_HZ;
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(TONE_GAIN, now + RAMP_S);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    toneOsc = osc;
    toneGain = gain;
  } catch {
    toneOsc = null;
    toneGain = null;
  }
}

export function stopTone() {
  if (!toneOsc || !toneGain || !audioCtx) return;
  const osc = toneOsc;
  const gain = toneGain;
  toneOsc = null;
  toneGain = null;
  try {
    const now = audioCtx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + RAMP_S);
    osc.stop(now + RAMP_S + 0.005);
  } catch {
    // Already stopped/disconnected — nothing to do.
  }
}

// Build a flat timeline of on/off events (in ms, relative to "now") for a
// code string. Letters are separated by whitespace; "/" is a word gap.
// Matches lib/morse.js's encode() output format (e.g. ".... .. / ..-").
function buildEvents(code, unitMs) {
  const events = [];
  let t = 0;
  let prevWasLetter = false;

  const tokens = String(code).trim().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    if (token === "/") {
      t += WORD_GAP_UNITS * unitMs;
      prevWasLetter = false;
      continue;
    }
    if (prevWasLetter) {
      t += LETTER_GAP_UNITS * unitMs;
    }
    const symbols = Array.from(token);
    symbols.forEach((sym, i) => {
      if (i > 0) t += ELEMENT_GAP_UNITS * unitMs;
      const dur = (sym === "." ? DOT_UNITS : DASH_UNITS) * unitMs;
      events.push({ start: t, dur });
      t += dur;
    });
    prevWasLetter = true;
  }

  return events;
}

// Play a dots/dashes code string with correct unit timing. Fires onOn/onOff
// callbacks in sync (via timers on the same schedule) so the UI can flash a
// lamp even if audio itself is blocked or muted. Returns { done, cancel }.
export function playCode(code, unitMs, { onOn, onOff } = {}) {
  const ctx = ensureContext();
  const events = buildEvents(code, unitMs);
  const timers = [];
  const nodes = [];
  let cancelled = false;
  let resolveDone;
  const done = new Promise((resolve) => {
    resolveDone = resolve;
  });

  const startTime = ctx ? ctx.currentTime : 0;

  for (const ev of events) {
    if (ctx && soundOn) {
      try {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = TONE_HZ;
        const t0 = startTime + ev.start / 1000;
        const t1 = t0 + ev.dur / 1000;
        const rampEnd = Math.min(t0 + RAMP_S, t1);
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(TONE_GAIN, rampEnd);
        gain.gain.setValueAtTime(TONE_GAIN, Math.max(rampEnd, t1 - RAMP_S));
        gain.gain.linearRampToValueAtTime(0, t1);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t1 + 0.01);
        nodes.push(osc);
      } catch {
        // Skip audio for this element; lamp callbacks still fire below.
      }
    }

    if (onOn) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) onOn();
        }, ev.start)
      );
    }
    if (onOff) {
      timers.push(
        setTimeout(() => {
          if (!cancelled) onOff();
        }, ev.start + ev.dur)
      );
    }
  }

  const totalMs = events.length ? events[events.length - 1].start + events[events.length - 1].dur : 0;
  timers.push(
    setTimeout(() => {
      if (!cancelled) {
        cancelled = true;
        resolveDone();
      }
    }, totalMs)
  );

  function cancel() {
    if (cancelled) return;
    cancelled = true;
    for (const timer of timers) clearTimeout(timer);
    for (const osc of nodes) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      try {
        osc.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    resolveDone();
  }

  return { done, cancel };
}
