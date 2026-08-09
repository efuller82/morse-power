import { test } from "node:test";
import assert from "node:assert/strict";
import { WORDS, wordStream, wpm } from "../lib/words.js";

// Deterministic seeded PRNG (mulberry32) so "same seed in → same output"
// tests don't depend on Math.random. Matches test/lessons.test.js.
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

test("WORDS has at least 150 entries", () => {
  assert.ok(WORDS.length >= 150, `expected >= 150, got ${WORDS.length}`);
});

test("every word is uppercase A-Z only, 2-7 letters", () => {
  for (const word of WORDS) {
    assert.match(word, /^[A-Z]{2,7}$/, `"${word}" should match /^[A-Z]{2,7}$/`);
  }
});

test("WORDS has no duplicates", () => {
  assert.equal(new Set(WORDS).size, WORDS.length);
});

test("wordStream draws only from WORDS", () => {
  const stream = wordStream(mulberry32(1));
  const wordSet = new Set(WORDS);
  for (let i = 0; i < 200; i++) {
    assert.ok(wordSet.has(stream.next()));
  }
});

test("wordStream never repeats a word immediately, across a 200-draw sequence", () => {
  const stream = wordStream(mulberry32(2));
  const draws = [];
  for (let i = 0; i < 200; i++) draws.push(stream.next());
  for (let i = 1; i < draws.length; i++) {
    assert.notEqual(draws[i], draws[i - 1], `repeat at index ${i}: ${draws[i]}`);
  }
});

test("wordStream honors the last-10 no-repeat guard across a 200-draw sequence", () => {
  const stream = wordStream(mulberry32(3));
  const draws = [];
  for (let i = 0; i < 200; i++) draws.push(stream.next());
  for (let i = 10; i < draws.length; i++) {
    const last10 = draws.slice(i - 10, i);
    assert.ok(!last10.includes(draws[i]), `index ${i} (${draws[i]}) repeats within the last 10`);
  }
});

test("wordStream is deterministic for a given rng seed", () => {
  const streamA = wordStream(mulberry32(42));
  const streamB = wordStream(mulberry32(42));
  const drawsA = Array.from({ length: 50 }, () => streamA.next());
  const drawsB = Array.from({ length: 50 }, () => streamB.next());
  assert.deepEqual(drawsA, drawsB);
});

test("wordStream defaults to Math.random and still returns valid words", () => {
  const stream = wordStream();
  const word = stream.next();
  assert.ok(WORDS.includes(word));
});

test("wpm(0) is 0", () => {
  assert.equal(wpm(0), 0);
});

test("wpm(37) is 7.4", () => {
  assert.equal(wpm(37), 7.4);
});

test("wpm rounds to 1 decimal place", () => {
  assert.equal(wpm(1), 0.2);
  assert.equal(wpm(11), 2.2);
  assert.equal(wpm(13), 2.6);
  assert.equal(wpm(100), 20);
});
