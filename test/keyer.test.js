import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SPEEDS,
  DOT_MAX_UNITS,
  LETTER_GAP_UNITS,
  WORD_GAP_UNITS,
  classifyPress,
  letterGapMs,
  parseTaps,
} from "../lib/keyer.js";

test("SPEEDS presets", () => {
  assert.deepEqual(SPEEDS, { slow: 150, medium: 120, fast: 90 });
});

test("unit constants", () => {
  assert.equal(DOT_MAX_UNITS, 2);
  assert.equal(LETTER_GAP_UNITS, 3);
  assert.equal(WORD_GAP_UNITS, 7);
});

test("classifyPress edges at unitMs=120", () => {
  assert.equal(classifyPress(239, 120), ".");
  assert.equal(classifyPress(240, 120), "-");
  assert.equal(classifyPress(100, 120), ".");
  assert.equal(classifyPress(400, 120), "-");
});

test("letterGapMs scales with unitMs", () => {
  assert.equal(letterGapMs(120), 360);
  assert.equal(letterGapMs(150), 450);
});

test("parseTaps: dot, dash, then a letter-ending gap", () => {
  const taps = [
    { down: 0, up: 100 },
    { down: 220, up: 520 },
    { down: 1000, up: 1080 },
  ];
  assert.deepEqual(parseTaps(taps, 120), [".-", "."]);
});

test("parseTaps: exact-boundary gap starts a new letter", () => {
  const unitMs = 120;
  const gap = LETTER_GAP_UNITS * unitMs; // exactly 3 units
  const taps = [
    { down: 0, up: 50 },
    { down: 50 + gap, up: 50 + gap + 50 },
  ];
  assert.deepEqual(parseTaps(taps, unitMs), [".", "."]);
});

test("parseTaps: all taps within letter gaps form a single letter", () => {
  const unitMs = 120;
  const taps = [
    { down: 0, up: 50 },
    { down: 100, up: 400 },
    { down: 500, up: 550 },
  ];
  assert.deepEqual(parseTaps(taps, unitMs), [".-."]);
});

test("parseTaps: empty array returns []", () => {
  assert.deepEqual(parseTaps([], 120), []);
});

test("parseTaps: multi-letter sequence spelling SOS", () => {
  const unitMs = 120;
  const dot = (t) => ({ down: t, up: t + 50 });
  const dash = (t) => ({ down: t, up: t + 400 });
  const letterGap = letterGapMs(unitMs); // 360

  let t = 0;
  const taps = [];

  // S = ...
  taps.push(dot(t)); t = taps.at(-1).up + 50;
  taps.push(dot(t)); t = taps.at(-1).up + 50;
  taps.push(dot(t)); t = taps.at(-1).up + letterGap;

  // O = ---
  taps.push(dash(t)); t = taps.at(-1).up + 50;
  taps.push(dash(t)); t = taps.at(-1).up + 50;
  taps.push(dash(t)); t = taps.at(-1).up + letterGap;

  // S = ...
  taps.push(dot(t)); t = taps.at(-1).up + 50;
  taps.push(dot(t)); t = taps.at(-1).up + 50;
  taps.push(dot(t));

  assert.deepEqual(parseTaps(taps, unitMs), ["...", "---", "..."]);
});

test("parseTaps works with the slow preset (unitMs=150)", () => {
  const unitMs = SPEEDS.slow;
  const letterGap = letterGapMs(unitMs); // 450
  const taps = [
    { down: 0, up: 100 }, // 100ms dot (< 300 threshold)
    { down: 100 + letterGap, up: 100 + letterGap + 500 }, // 500ms dash (>= 300 threshold)
  ];
  assert.deepEqual(parseTaps(taps, unitMs), [".", "-"]);
});
