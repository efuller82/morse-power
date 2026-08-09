// Telegraph-keyer timing brain — pure ESM, no DOM, no Node-only APIs.
// Timestamps are passed in as arguments; the browser layer owns real timers.
//
// Standard Morse unit model: dit = 1 unit, dah = 3 units, gap between
// elements = 1 unit, gap between letters = 3 units, gap between words = 7
// units.

export const SPEEDS = { slow: 150, medium: 120, fast: 90 };

export const DOT_MAX_UNITS = 2;
export const LETTER_GAP_UNITS = 3;
export const WORD_GAP_UNITS = 7;

export function classifyPress(durationMs, unitMs) {
  return durationMs < DOT_MAX_UNITS * unitMs ? "." : "-";
}

export function letterGapMs(unitMs) {
  return LETTER_GAP_UNITS * unitMs;
}

export function parseTaps(taps, unitMs) {
  if (!Array.isArray(taps) || taps.length === 0) return [];

  const letters = [];
  let current = "";

  for (let i = 0; i < taps.length; i++) {
    const { down, up } = taps[i];
    current += classifyPress(up - down, unitMs);

    const next = taps[i + 1];
    if (next) {
      const gap = next.down - up;
      if (gap >= letterGapMs(unitMs)) {
        letters.push(current);
        current = "";
      }
    }
  }

  letters.push(current);
  return letters;
}
