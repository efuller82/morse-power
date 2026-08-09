import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server.js";

async function withServer(fn) {
  const server = createApp();
  await new Promise((res) => server.listen(0, res));
  const base = `http://localhost:${server.address().port}`;
  try {
    await fn(base);
  } finally {
    await new Promise((res) => server.close(res));
  }
}

test("serves the index page at /", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(await res.text(), /Morse Power/);
  });
});

test("returns 404 for unknown paths", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/no-such-file.html`);
    assert.equal(res.status, 404);
  });
});

test("blocks path traversal outside public/", async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/%2e%2e/server.js`);
    assert.equal(res.status, 404);
  });
});
