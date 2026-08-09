// Learn-mode lesson plan + practice-queue logic — pure ESM, no DOM, no
// Node-only APIs. Imported by both the browser (served at /lib/) and
// node:test.
//
// Lessons are ordered by code simplicity so kids meet the shortest, least
// ambiguous codes first. Together they cover all 36 characters exactly once
// as "new" material; earlier lessons' characters become review fodder for
// later ones.

export const LESSONS = [
  { id: "dit-dah", title: "Dit & Dah", chars: ["E", "T"] },
  { id: "two-beeps", title: "Two Beeps", chars: ["A", "I", "M", "N"] },
  {
    id: "threes-company",
    title: "Three's Company",
    chars: ["S", "U", "R", "W", "D", "K", "G", "O"],
  },
  { id: "getting-fancy", title: "Getting Fancy", chars: ["H", "V", "F", "L", "P", "J"] },
  { id: "tricky-bunch", title: "The Tricky Bunch", chars: ["B", "X", "C", "Y", "Z", "Q"] },
  { id: "numbers-1-5", title: "Numbers 1-5", chars: ["1", "2", "3", "4", "5"] },
  { id: "numbers-6-0", title: "Numbers 6-0", chars: ["6", "7", "8", "9", "0"] },
];

// Every character across every lesson, in lesson order — used as the last
// fallback pool for pickChoices.
const ALL_CHARS = LESSONS.flatMap((lesson) => lesson.chars);

// How many review questions to mix into a lesson's practice queue (when the
// lesson has any earlier lessons to review at all).
const REVIEW_QUESTION_COUNT = 4;

// Fisher-Yates shuffle with an injected rng so callers (and tests) can get
// deterministic output. Does not mutate the input array.
function shuffle(items, rng) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// All characters taught in lessons before lessonIndex — the pool of
// already-learned characters available for review questions.
export function reviewPool(lessonIndex) {
  const pool = [];
  for (let i = 0; i < lessonIndex && i < LESSONS.length; i++) {
    pool.push(...LESSONS[i].chars);
  }
  return pool;
}

// Build the practice queue for a lesson: two questions (one "key", one
// "hear") per new character, plus up to REVIEW_QUESTION_COUNT review
// questions drawn from earlier lessons, shuffled — with the first two
// questions guaranteed to be new-character questions so kids meet the new
// material before any review.
export function buildQueue(lessonIndex, rng = Math.random) {
  const lesson = LESSONS[lessonIndex];
  if (!lesson) return [];

  const newChars = new Set(lesson.chars);

  const newQuestions = [];
  for (const char of lesson.chars) {
    newQuestions.push({ char, direction: "key" });
    newQuestions.push({ char, direction: "hear" });
  }

  const pool = reviewPool(lessonIndex);
  const reviewQuestions = [];
  if (pool.length > 0) {
    for (let i = 0; i < REVIEW_QUESTION_COUNT; i++) {
      const char = pool[Math.floor(rng() * pool.length)];
      const direction = rng() < 0.5 ? "key" : "hear";
      reviewQuestions.push({ char, direction });
    }
  }

  const shuffled = shuffle([...newQuestions, ...reviewQuestions], rng);
  return frontLoadNewQuestions(shuffled, newChars);
}

// Reorder so the first two entries are new-character questions (there are
// always at least two — every lesson has at least two new characters —
// while keeping the relative order of everything else untouched.
function frontLoadNewQuestions(queue, newChars) {
  const front = [];
  const rest = [];
  for (const question of queue) {
    if (front.length < 2 && newChars.has(question.char)) {
      front.push(question);
    } else {
      rest.push(question);
    }
  }
  return [...front, ...rest];
}

// Answer options for a "hear" question: the correct character plus
// `count - 1` distractors, preferring the same lesson's new characters,
// then the review pool, then anything from the full 36-character set.
// Always returns `count` distinct characters (assuming the alphabet has
// that many), shuffled.
export function pickChoices(correctChar, lessonIndex, count = 4, rng = Math.random) {
  const lesson = LESSONS[lessonIndex];
  const newChars = lesson ? lesson.chars.filter((c) => c !== correctChar) : [];
  const pool = reviewPool(lessonIndex).filter((c) => c !== correctChar);
  const everything = ALL_CHARS.filter((c) => c !== correctChar);

  const used = new Set([correctChar]);
  const distractors = [];

  function drawFrom(source) {
    if (distractors.length >= count - 1) return;
    for (const char of shuffle(source, rng)) {
      if (distractors.length >= count - 1) break;
      if (used.has(char)) continue;
      used.add(char);
      distractors.push(char);
    }
  }

  drawFrom(newChars);
  drawFrom(pool);
  drawFrom(everything);

  return shuffle([correctChar, ...distractors], rng);
}
