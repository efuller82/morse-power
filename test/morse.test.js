import { test } from "node:test";
import assert from "node:assert/strict";
import { MORSE, CODE_TO_CHAR, toCode, fromCode, encode, decode } from "../lib/morse.js";

test("MORSE has exactly 36 entries", () => {
  assert.equal(Object.keys(MORSE).length, 36);
});

test("every code is only dots and dashes", () => {
  for (const code of Object.values(MORSE)) {
    assert.match(code, /^[.-]+$/);
  }
});

test("no duplicate codes", () => {
  const codes = Object.values(MORSE);
  assert.equal(new Set(codes).size, codes.length);
});

test("CODE_TO_CHAR round-trips every char in MORSE", () => {
  for (const char of Object.keys(MORSE)) {
    assert.equal(fromCode(toCode(char)), char);
  }
});

test("CODE_TO_CHAR is derived from MORSE", () => {
  for (const [char, code] of Object.entries(MORSE)) {
    assert.equal(CODE_TO_CHAR[code], char);
  }
});

test("spot-checks known codes", () => {
  assert.equal(MORSE.E, ".");
  assert.equal(MORSE.T, "-");
  assert.equal(MORSE.S, "...");
  assert.equal(MORSE.O, "---");
  assert.equal(MORSE.A, ".-");
  assert.equal(MORSE.N, "-.");
  assert.equal(MORSE[0], "-----");
  assert.equal(MORSE[9], "----.");
});

test("encode joins letters with spaces and words with slashes", () => {
  assert.equal(encode("hi u"), ".... .. / ..-");
});

test("decode is the inverse of encode", () => {
  assert.equal(decode(encode("SOS SOS")), "SOS SOS");
});

test("decode returns ? for an unknown code group", () => {
  assert.equal(decode(".-.-.-"), "?");
});

test("toCode is case-insensitive", () => {
  assert.equal(toCode("a"), ".-");
  assert.equal(toCode("A"), ".-");
});

test("encode skips unknown characters", () => {
  assert.equal(encode("hi!"), ".... ..");
});

test("toCode and fromCode return null for unknown input", () => {
  assert.equal(toCode("!"), null);
  assert.equal(fromCode("......."), null);
});
