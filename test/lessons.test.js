import { test } from "node:test";
import assert from "node:assert/strict";
import { MORSE } from "../lib/morse.js";
import { LESSONS, reviewPool, buildQueue, pickChoices } from "../lib/lessons.js";

// Deterministic seeded PRNG (mulberry32) so "same seed in → same output"
// tests don't depend on Math.random.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EXPECTED_TITLES = [
  "Dit & Dah",
  "Two Beeps",
  "Three's Company",
  "Getting Fancy",
  "The Tricky Bunch",
  "Numbers 1-5",
  "Numbers 6-0",
];

test("LESSONS has 7 lessons in the expected order", () => {
  assert.equal(LESSONS.length, 7);
  assert.deepEqual(
    LESSONS.map((l) => l.title),
    EXPECTED_TITLES
  );
});

test("LESSONS covers all 36 characters exactly once, no duplicates", () => {
  const allChars = LESSONS.flatMap((l) => l.chars);
  assert.equal(allChars.length, 36);
  assert.equal(new Set(allChars).size, 36);
  assert.deepEqual(new Set(allChars), new Set(Object.keys(MORSE)));
});

test("every lesson has a unique id and non-empty title/chars", () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const lesson of LESSONS) {
    assert.ok(lesson.title.length > 0);
    assert.ok(lesson.chars.length > 0);
  }
});

test("reviewPool(0) is empty", () => {
  assert.deepEqual(reviewPool(0), []);
});

test("reviewPool(n) is exactly the concatenation of earlier lessons' chars", () => {
  assert.deepEqual(reviewPool(1), ["E", "T"]);
  assert.deepEqual(reviewPool(2), ["E", "T", "A", "I", "M", "N"]);
  assert.deepEqual(
    reviewPool(6),
    LESSONS.slice(0, 6).flatMap((l) => l.chars)
  );
});

test("buildQueue: every new char appears exactly once in each direction", () => {
  for (let idx = 0; idx < LESSONS.length; idx++) {
    const lesson = LESSONS[idx];
    const newChars = new Set(lesson.chars);
    const queue = buildQueue(idx, mulberry32(1));
    for (const char of lesson.chars) {
      const entries = queue.filter((q) => q.char === char && newChars.has(q.char));
      const directions = entries.map((q) => q.direction).sort();
      assert.deepEqual(
        directions,
        ["hear", "key"],
        `char ${char} in lesson ${idx} should appear once as "key" and once as "hear"`
      );
    }
  }
});

test("buildQueue: first two questions are always new-char questions", () => {
  for (let idx = 0; idx < LESSONS.length; idx++) {
    const lesson = LESSONS[idx];
    const newChars = new Set(lesson.chars);
    // Try a handful of seeds so this isn't a fluke of one particular shuffle.
    for (let seed = 0; seed < 5; seed++) {
      const queue = buildQueue(idx, mulberry32(seed * 97 + 3));
      assert.ok(newChars.has(queue[0].char), `lesson ${idx} seed ${seed}: queue[0]`);
      assert.ok(newChars.has(queue[1].char), `lesson ${idx} seed ${seed}: queue[1]`);
    }
  }
});

test("buildQueue: lesson 0 has no review questions (empty pool)", () => {
  const queue = buildQueue(0, mulberry32(7));
  assert.equal(queue.length, LESSONS[0].chars.length * 2);
});

test("buildQueue: later lessons mix in up to 4 review questions from earlier lessons only", () => {
  for (let idx = 1; idx < LESSONS.length; idx++) {
    const lesson = LESSONS[idx];
    const newChars = new Set(lesson.chars);
    const pool = new Set(reviewPool(idx));
    const queue = buildQueue(idx, mulberry32(idx * 13 + 1));

    const reviewEntries = queue.filter((q) => !newChars.has(q.char));
    assert.ok(reviewEntries.length <= 4, `lesson ${idx} should have at most 4 review questions`);
    for (const entry of reviewEntries) {
      assert.ok(pool.has(entry.char), `review char ${entry.char} should come from an earlier lesson`);
      assert.ok(["key", "hear"].includes(entry.direction));
    }

    const newEntries = queue.filter((q) => newChars.has(q.char));
    assert.equal(newEntries.length, lesson.chars.length * 2);
    assert.equal(queue.length, newEntries.length + reviewEntries.length);
  }
});

test("buildQueue is deterministic for a given rng seed", () => {
  for (let idx = 0; idx < LESSONS.length; idx++) {
    const queueA = buildQueue(idx, mulberry32(42));
    const queueB = buildQueue(idx, mulberry32(42));
    assert.deepEqual(queueA, queueB);
  }
});

test("buildQueue returns [] for an out-of-range lesson index", () => {
  assert.deepEqual(buildQueue(99, mulberry32(1)), []);
});

test("pickChoices always contains the correct char, has the right length, all distinct", () => {
  for (let idx = 0; idx < LESSONS.length; idx++) {
    for (const char of LESSONS[idx].chars) {
      const choices = pickChoices(char, idx, 4, mulberry32(idx * 11 + char.charCodeAt(0)));
      assert.equal(choices.length, 4);
      assert.equal(new Set(choices).size, 4);
      assert.ok(choices.includes(char));
    }
  }
});

test("pickChoices works for lesson 0 (tiny pool) via fallback to the full alphabet", () => {
  const choices = pickChoices("E", 0, 4, mulberry32(5));
  assert.equal(choices.length, 4);
  assert.equal(new Set(choices).size, 4);
  assert.ok(choices.includes("E"));
  // Lesson 0 only has one other new char (T) and an empty review pool, so
  // two of the four choices must have come from the full-alphabet fallback.
  assert.ok(choices.includes("T"));
});

test("pickChoices respects a custom count", () => {
  const choices = pickChoices("O", 2, 6, mulberry32(9));
  assert.equal(choices.length, 6);
  assert.equal(new Set(choices).size, 6);
  assert.ok(choices.includes("O"));
});

test("pickChoices prefers same-lesson chars, then review pool, before the full alphabet", () => {
  // Lesson 2 ("Three's Company") has 8 chars — plenty for 4 choices without
  // ever touching the review pool or the full-alphabet fallback.
  const lesson = LESSONS[2];
  const choices = pickChoices(lesson.chars[0], 2, 4, mulberry32(3));
  for (const choice of choices) {
    assert.ok(
      choice === lesson.chars[0] || lesson.chars.includes(choice),
      `${choice} should be drawn from lesson 2's own characters first`
    );
  }
});
