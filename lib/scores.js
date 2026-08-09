// Shared leaderboard logic — pure ESM, no DOM, no Node-only APIs. Imported
// by both the browser (served at /lib/) and node:test, and by server.js.
// The server owns file I/O (data/scores.json); everything here just
// validates, sanitizes, ranks, and queries plain score-entry objects.

export const MODES = ["send", "catch"];
export const MAX_NAME_LENGTH = 10;
export const TOP_N = 10;

// Leaderboard names are the only player data this app collects, and the
// repo is public — sanitize hard. Strip control characters and anything
// that could be used to break out of textContent-safe rendering
// (< > & " ' `), collapse whitespace runs, trim, and cap the length. Never
// returns an empty string — a submitted-but-unnamed score still gets a
// display name.
export function sanitizeName(raw) {
  const str = typeof raw === "string" ? raw : String(raw ?? "");
  const withoutControls = str.replace(/[\x00-\x1f\x7f-\x9f]/g, "");
  const withoutMarkup = withoutControls.replace(/[<>&"'`]/g, "");
  const collapsed = withoutMarkup.replace(/\s+/g, " ").trim();
  const capped = collapsed.slice(0, MAX_NAME_LENGTH);
  return capped.length > 0 ? capped : "MYSTERY";
}

function isValidWpm(n) {
  return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 300;
}

function isValidCount(n) {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 2000;
}

// Returns a clean { name, mode, wpm, correct, missed } or null. `name` is
// always sanitized (never rejects on a bad/missing name — it just becomes
// "MYSTERY"); every other field is required and range-checked.
export function validateEntry(body) {
  if (!body || typeof body !== "object") return null;
  if (!MODES.includes(body.mode)) return null;
  if (!isValidWpm(body.wpm)) return null;
  if (!isValidCount(body.correct)) return null;
  if (!isValidCount(body.missed)) return null;

  return {
    name: sanitizeName(body.name),
    mode: body.mode,
    wpm: body.wpm,
    correct: body.correct,
    missed: body.missed,
  };
}

// Leaderboard sort: wpm desc, then correct desc, then date asc (earlier
// submission wins a full tie).
function compareEntries(a, b) {
  if (b.wpm !== a.wpm) return b.wpm - a.wpm;
  if (b.correct !== a.correct) return b.correct - a.correct;
  if (a.date < b.date) return -1;
  if (a.date > b.date) return 1;
  return 0;
}

// That mode's entries, sorted best-first.
export function topScores(scores, mode) {
  return scores.filter((s) => s.mode === mode).sort(compareEntries);
}

// Appends entry (stamped with dateIso) to scores, keeps only the top TOP_N
// entries for that entry's mode (the other mode's entries are untouched),
// and returns { scores, rank } — rank is the new entry's 1-based position
// in its mode, or null if it didn't make the cut.
export function addScore(scores, entry, dateIso) {
  const stamped = { ...entry, date: dateIso };
  const others = scores.filter((s) => s.mode !== entry.mode);
  const modeEntries = scores.filter((s) => s.mode === entry.mode);
  modeEntries.push(stamped);
  modeEntries.sort(compareEntries);
  const kept = modeEntries.slice(0, TOP_N);
  const index = kept.indexOf(stamped);

  return {
    scores: [...others, ...kept],
    rank: index === -1 ? null : index + 1,
  };
}

// Would a new entry with this wpm/correct make the TOP_N cut for mode?
// Mirrors addScore's ranking rules exactly (a brand-new entry can never
// have an earlier date than an existing one, so an exact tie with the
// current last place does not qualify).
export function qualifies(scores, mode, wpm, correct) {
  const current = topScores(scores, mode);
  if (current.length < TOP_N) return true;
  const last = current[TOP_N - 1];
  if (wpm !== last.wpm) return wpm > last.wpm;
  return correct > last.correct;
}
