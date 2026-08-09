// Shared Morse code engine — pure ESM, no DOM, no Node-only APIs.
// Imported by both the browser (served at /lib/) and node:test.

export const MORSE = {
  A: ".-",
  B: "-...",
  C: "-.-.",
  D: "-..",
  E: ".",
  F: "..-.",
  G: "--.",
  H: "....",
  I: "..",
  J: ".---",
  K: "-.-",
  L: ".-..",
  M: "--",
  N: "-.",
  O: "---",
  P: ".--.",
  Q: "--.-",
  R: ".-.",
  S: "...",
  T: "-",
  U: "..-",
  V: "...-",
  W: ".--",
  X: "-..-",
  Y: "-.--",
  Z: "--..",
  0: "-----",
  1: ".----",
  2: "..---",
  3: "...--",
  4: "....-",
  5: ".....",
  6: "-....",
  7: "--...",
  8: "---..",
  9: "----.",
};

export const CODE_TO_CHAR = Object.fromEntries(
  Object.entries(MORSE).map(([char, code]) => [code, char])
);

export function toCode(char) {
  if (typeof char !== "string") return null;
  const code = MORSE[char.toUpperCase()];
  return code ?? null;
}

export function fromCode(code) {
  if (typeof code !== "string") return null;
  const char = CODE_TO_CHAR[code];
  return char ?? null;
}

export function encode(text) {
  return text
    .split(" ")
    .map((word) =>
      Array.from(word)
        .map((char) => toCode(char))
        .filter((code) => code !== null)
        .join(" ")
    )
    .join(" / ");
}

export function decode(code) {
  return code
    .trim()
    .split("/")
    .map((word) =>
      word
        .trim()
        .split(/\s+/)
        .filter((group) => group.length > 0)
        .map((group) => fromCode(group) ?? "?")
        .join("")
    )
    .join(" ");
}
