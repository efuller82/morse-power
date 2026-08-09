import { test } from "node:test";
import assert from "node:assert/strict";
import { MORSE } from "../lib/morse.js";
import { DECK, remaining, shuffled, requeue, pickListenChoices } from "../lib/flashcards.js";

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

test("DECK has 36 characters, A-Z then 0-9, no duplicates", () => {
  assert.equal(DECK.length, 36);
  assert.deepEqual(DECK, [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"]);
  assert.equal(new Set(DECK).size, 36);
});

test("DECK matches the full Morse character set", () => {
  assert.deepEqual(new Set(DECK), new Set(Object.keys(MORSE)));
});

test("remaining preserves deck order and filters out done characters", () => {
  assert.deepEqual(remaining(["A", "B", "C", "D"], ["B", "D"]), ["A", "C"]);
});

test("remaining returns the whole deck when nothing is done", () => {
  assert.deepEqual(remaining(DECK, []), DECK);
});

test("remaining does not mutate its inputs", () => {
  const deck = ["A", "B", "C"];
  const done = ["B"];
  remaining(deck, done);
  assert.deepEqual(deck, ["A", "B", "C"]);
  assert.deepEqual(done, ["B"]);
});

test("shuffled returns exactly the same members, just reordered", () => {
  const result = shuffled(DECK, mulberry32(1));
  assert.equal(result.length, DECK.length);
  assert.deepEqual([...result].sort(), [...DECK].sort());
});

test("shuffled is deterministic for a given rng seed", () => {
  const a = shuffled(DECK, mulberry32(7));
  const b = shuffled(DECK, mulberry32(7));
  assert.deepEqual(a, b);
});

test("shuffled actually reorders for at least one seed", () => {
  const result = shuffled(DECK, mulberry32(2));
  assert.notDeepEqual(result, DECK);
});

test("shuffled does not mutate its input", () => {
  const input = [...DECK];
  shuffled(input, mulberry32(3));
  assert.deepEqual(input, DECK);
});

test("requeue inserts the card 4 positions after the front by default", () => {
  const queue = ["B", "C", "D", "E", "F", "G"];
  const result = requeue(queue, "A");
  assert.equal(result.indexOf("A"), 4);
  assert.equal(result.length, queue.length + 1);
});

test("requeue never places the card at index 0 for a non-empty queue", () => {
  for (let gap = 0; gap <= 5; gap++) {
    const result = requeue(["X"], "A", gap);
    assert.notEqual(result[0], "A");
  }
});

test("requeue appends at the end when the queue is shorter than the gap", () => {
  const result = requeue(["X", "Y"], "A", 4);
  assert.deepEqual(result, ["X", "Y", "A"]);
});

test("requeue on an empty queue just returns [card]", () => {
  assert.deepEqual(requeue([], "A"), ["A"]);
});

test("requeue does not mutate the original queue", () => {
  const queue = ["B", "C", "D", "E", "F"];
  const copy = [...queue];
  requeue(queue, "A");
  assert.deepEqual(queue, copy);
});

test("requeue with an rng jitters the gap within 3-5 positions for the default gap", () => {
  const queue = ["B", "C", "D", "E", "F", "G", "H", "I"];
  for (let seed = 0; seed < 10; seed++) {
    const result = requeue(queue, "A", 4, mulberry32(seed * 31 + 1));
    const index = result.indexOf("A");
    assert.ok(index >= 3 && index <= 5, `expected index 3-5, got ${index}`);
  }
});

test("pickListenChoices includes the correct char with distinct choices of the right count", () => {
  for (const char of DECK) {
    const choices = pickListenChoices(char, 4, mulberry32(char.charCodeAt(0)));
    assert.equal(choices.length, 4);
    assert.equal(new Set(choices).size, 4);
    assert.ok(choices.includes(char));
  }
});

test("pickListenChoices respects a custom count", () => {
  const choices = pickListenChoices("Q", 6, mulberry32(9));
  assert.equal(choices.length, 6);
  assert.equal(new Set(choices).size, 6);
  assert.ok(choices.includes("Q"));
});

test("pickListenChoices is deterministic for a given rng seed", () => {
  const a = pickListenChoices("M", 4, mulberry32(42));
  const b = pickListenChoices("M", 4, mulberry32(42));
  assert.deepEqual(a, b);
});
