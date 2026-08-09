// Reusable telegraph-key component. Tutorial uses it for free play now;
// Learn/Play will reuse it later for scored/targeted keying.

import { classifyPress, letterGapMs, DOT_MAX_UNITS } from "/lib/keyer.js";
import { fromCode } from "/lib/morse.js";
import { startTone, stopTone } from "./audio.js";
import { getUnitMs } from "./app.js";

// Visual fill scale: the dash-zone threshold (DOT_MAX_UNITS) always lands at
// 50% fill height, regardless of speed, so the CSS zone line stays accurate.
const FILL_SCALE = 2;

function elementSymbol(el) {
  return el === "." ? "●" : "▬"; // ● / ▬
}

// createKeyer(container, { onLetter, onElement }) → { destroy, reset }
// Renders a big round key into `container`. Repeated calls are safe — each
// call tears down and rebuilds its own instance.
export function createKeyer(container, { onLetter, onElement } = {}) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.className = "keyer";

  const key = document.createElement("button");
  key.type = "button";
  key.className = "keyer-key";
  key.setAttribute("aria-label", "Telegraph key — hold to key dots and dashes");

  const fill = document.createElement("div");
  fill.className = "keyer-fill";

  const zoneLine = document.createElement("div");
  zoneLine.className = "keyer-zone-line";

  const zoneLabel = document.createElement("div");
  zoneLabel.className = "keyer-zone-label";

  key.append(fill, zoneLine, zoneLabel);

  const readout = document.createElement("div");
  readout.className = "keyer-readout";
  readout.setAttribute("aria-live", "polite");

  const readoutLabel = document.createElement("span");
  readoutLabel.className = "keyer-readout-label";
  readoutLabel.textContent = "Keying:";

  const readoutValue = document.createElement("span");
  readoutValue.className = "keyer-readout-value";

  readout.append(readoutLabel, readoutValue);
  wrap.append(key, readout);
  container.appendChild(wrap);

  let pressStart = null;
  let unitMsAtPress = getUnitMs();
  let currentCode = "";
  let letterTimer = null;
  let rafId = null;
  let activePointerId = null;
  let destroyed = false;

  function isVisible() {
    return key.offsetParent !== null;
  }

  function renderReadout() {
    readoutValue.textContent = Array.from(currentCode).map(elementSymbol).join(" ");
  }

  function clearLetterTimer() {
    if (letterTimer !== null) {
      clearTimeout(letterTimer);
      letterTimer = null;
    }
  }

  function scheduleCommit() {
    clearLetterTimer();
    letterTimer = setTimeout(commitLetter, letterGapMs(unitMsAtPress));
  }

  function commitLetter() {
    letterTimer = null;
    if (!currentCode) return;
    const code = currentCode;
    currentCode = "";
    renderReadout();
    const char = fromCode(code) ?? "?";
    if (onLetter) onLetter(code, char);
  }

  function tickFill() {
    if (pressStart === null) return;
    const elapsed = performance.now() - pressStart;
    const dashThreshold = DOT_MAX_UNITS * unitMsAtPress;
    const pct = Math.min(100, (elapsed / (dashThreshold * FILL_SCALE)) * 100);
    fill.style.height = pct + "%";
    const inDash = elapsed >= dashThreshold;
    key.classList.toggle("in-dash-zone", inDash);
    zoneLabel.textContent = inDash ? "dah" : "dit";
    rafId = requestAnimationFrame(tickFill);
  }

  function press() {
    if (pressStart !== null || destroyed) return;
    clearLetterTimer();
    unitMsAtPress = getUnitMs();
    pressStart = performance.now();
    key.classList.add("active");
    zoneLabel.textContent = "dit";
    startTone();
    rafId = requestAnimationFrame(tickFill);
  }

  function release() {
    if (pressStart === null) return;
    const duration = performance.now() - pressStart;
    pressStart = null;
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    key.classList.remove("active", "in-dash-zone");
    fill.style.height = "0%";
    zoneLabel.textContent = "";
    stopTone();

    const el = classifyPress(duration, unitMsAtPress);
    currentCode += el;
    renderReadout();
    if (onElement) onElement(el);
    scheduleCommit();
  }

  function onPointerDown(e) {
    if (destroyed) return;
    e.preventDefault();
    activePointerId = e.pointerId;
    try {
      key.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture is best-effort.
    }
    press();
  }

  function onPointerUp(e) {
    if (activePointerId !== null && e.pointerId !== activePointerId) return;
    activePointerId = null;
    release();
  }

  function onPointerLeave() {
    if (pressStart !== null) release();
  }

  function onKeyDown(e) {
    if (e.code !== "Space" || e.repeat || destroyed || !isVisible()) return;
    e.preventDefault();
    press();
  }

  function onKeyUp(e) {
    if (e.code !== "Space" || destroyed || !isVisible()) return;
    e.preventDefault();
    release();
  }

  key.addEventListener("pointerdown", onPointerDown);
  key.addEventListener("pointerup", onPointerUp);
  key.addEventListener("pointercancel", onPointerUp);
  key.addEventListener("pointerleave", onPointerLeave);
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  function reset() {
    clearLetterTimer();
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    pressStart = null;
    currentCode = "";
    renderReadout();
    key.classList.remove("active", "in-dash-zone");
    fill.style.height = "0%";
    zoneLabel.textContent = "";
    stopTone();
  }

  function destroy() {
    if (destroyed) return;
    destroyed = true;
    reset();
    key.removeEventListener("pointerdown", onPointerDown);
    key.removeEventListener("pointerup", onPointerUp);
    key.removeEventListener("pointercancel", onPointerUp);
    key.removeEventListener("pointerleave", onPointerLeave);
    window.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("keyup", onKeyUp);
    container.innerHTML = "";
  }

  return { destroy, reset };
}
