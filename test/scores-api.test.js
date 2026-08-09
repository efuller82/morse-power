// API tests for /api/scores. Each test points MORSE_DATA_DIR at a fresh
// mkdtempSync() temp dir so the real (gitignored) data/ in the repo is
// never touched, and so tests don't see each other's scores.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../server.js";

async function withTempServer(fn) {
  const dir = mkdtempSync(join(tmpdir(), "morse-power-scores-"));
  const previous = process.env.MORSE_DATA_DIR;
  process.env.MORSE_DATA_DIR = dir;
  const server = createApp();
  await new Promise((res) => server.listen(0, res));
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base, dir);
  } finally {
    await new Promise((res) => server.close(res));
    if (previous === undefined) delete process.env.MORSE_DATA_DIR;
    else process.env.MORSE_DATA_DIR = previous;
    rmSync(dir, { recursive: true, force: true });
  }
}

function postScore(base, payload) {
  return fetch(`${base}/api/scores`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

test("GET /api/scores on a fresh store returns an empty list", async () => {
  await withTempServer(async (base) => {
    const res = await fetch(`${base}/api/scores`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { scores: [] });
  });
});

test("POST a valid score returns rank 1 and is persisted", async () => {
  await withTempServer(async (base) => {
    const res = await postScore(base, { name: "ZIPPY", mode: "send", wpm: 12, correct: 60, missed: 2 });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.rank, 1);
    assert.equal(body.scores.length, 1);

    const getRes = await fetch(`${base}/api/scores`);
    const getBody = await getRes.json();
    assert.equal(getBody.scores.length, 1);
    assert.equal(getBody.scores[0].name, "ZIPPY");
  });
});

test("POST sanitizes the submitted name server-side", async () => {
  await withTempServer(async (base) => {
    const res = await postScore(base, {
      name: "<b>Kid</b>123456789",
      mode: "catch",
      wpm: 5,
      correct: 5,
      missed: 0,
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    const saved = body.scores.find((s) => s.mode === "catch");
    assert.ok(saved);
    assert.ok(saved.name.length <= 10, `name too long: ${saved.name.length}`);
    assert.ok(!/[<>]/.test(saved.name));
  });
});

test("POST with an invalid mode is rejected with 400", async () => {
  await withTempServer(async (base) => {
    const res = await postScore(base, { name: "DOT", mode: "bogus", wpm: 5, correct: 5, missed: 0 });
    assert.equal(res.status, 400);
  });
});

test("POST with invalid JSON is rejected with 400", async () => {
  await withTempServer(async (base) => {
    const res = await fetch(`${base}/api/scores`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ this is not json",
    });
    assert.equal(res.status, 400);
  });
});

test("POST with a body over 4096 bytes is rejected with 413", async () => {
  await withTempServer(async (base) => {
    const res = await postScore(base, {
      name: "A".repeat(5000),
      mode: "send",
      wpm: 5,
      correct: 5,
      missed: 0,
    });
    assert.equal(res.status, 413);
  });
});

test("non-GET/POST methods on /api/scores are rejected with 405", async () => {
  await withTempServer(async (base) => {
    const res = await fetch(`${base}/api/scores`, { method: "DELETE" });
    assert.equal(res.status, 405);
  });
});

test("a corrupt scores.json is treated as empty, and POST recovers it", async () => {
  await withTempServer(async (base, dir) => {
    writeFileSync(join(dir, "scores.json"), "{ not valid json at all", "utf8");

    const getRes = await fetch(`${base}/api/scores`);
    assert.equal(getRes.status, 200);
    assert.deepEqual(await getRes.json(), { scores: [] });

    const postRes = await postScore(base, { name: "DOT", mode: "send", wpm: 5, correct: 5, missed: 0 });
    assert.equal(postRes.status, 200);
    const body = await postRes.json();
    assert.equal(body.rank, 1);
    assert.equal(body.scores.length, 1);
  });
});

test("only the top 10 scores per mode are kept after 11 POSTs", async () => {
  await withTempServer(async (base) => {
    for (let i = 0; i < 11; i++) {
      const res = await postScore(base, { name: `P${i}`, mode: "send", wpm: i + 1, correct: 10, missed: 0 });
      assert.equal(res.status, 200);
    }
    const res = await fetch(`${base}/api/scores`);
    const body = await res.json();
    assert.equal(body.scores.length, 10);
    // The lowest-wpm entry (P0, wpm 1) should have fallen off.
    assert.ok(!body.scores.some((s) => s.name === "P0"));
  });
});
