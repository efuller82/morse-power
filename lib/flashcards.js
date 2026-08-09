// Flashcard-deck logic for Learn mode's three-phase flashcard system —
// pure ESM, no DOM, no Node-only APIs. Imported by both the browser
// (served at /lib/) and node:test.

// All 36 characters, in the fixed order every phase teaches them:
// A-Z, then 0-9.
export const DECK = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

// deck order preserved, minus whatever's in doneChars.
export function remaining(deck, doneChars) {
  const done = new Set(doneChars);
  return deck.filter((char) => !done.has(char));
}

// Fisher-Yates shuffle with an injectable rng so callers (and tests) can
// get deterministic output. Does not mutate the input array.
export function shuffled(chars, rng = Math.random) {
  const result = chars.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// Re-insert a missed card so it comes back later rather than immediately:
// `gap` positions after the front of the queue, or at the end if the
// queue is shorter than that — but never at index 0 (the very next card
// must be a different one than the one just missed). Returns a new array;
// does not mutate `queue`.
//
// When an rng is supplied, the insertion point is jittered by up to ±1
// position (e.g. 3-5 cards later for the default gap of 4) so repeats
// don't fall into a perfectly predictable rhythm. Omit rng (as the
// default requeue(queue, card) call does) for an exact, deterministic
// gap — that's what callers/tests rely on.
export function requeue(queue, card, gap = 4, rng) {
  const result = queue.slice();
  if (result.length === 0) {
    result.push(card);
    return result;
  }
  let effectiveGap = gap;
  if (typeof rng === "function") {
    effectiveGap = gap + Math.floor(rng() * 3) - 1; // gap-1 .. gap+1
  }
  const index = Math.min(Math.max(effectiveGap, 1), result.length);
  result.splice(index, 0, card);
  return result;
}

// Answer options for a Phase 3 "Listen" question: the correct character
// plus `count - 1` distinct random distractors drawn from the full deck,
// shuffled together. Always returns `count` distinct characters (assuming
// the deck has that many).
export function pickListenChoices(correctChar, count = 4, rng = Math.random) {
  const pool = DECK.filter((char) => char !== correctChar);
  const distractors = shuffled(pool, rng).slice(0, count - 1);
  return shuffled([correctChar, ...distractors], rng);
}
