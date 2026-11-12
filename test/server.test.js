import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
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

async function freePort() {
  const probe = createNetServer();
  await new Promise((res) => probe.listen(0, "127.0.0.1", res));
  const { port } = probe.address();
  await new Promise((res) => probe.close(res));
  return port;
}

test("node server.js honours HOST and PORT (packaged builds bind to 127.0.0.1)", async () => {
  const port = await freePort();
  const dataDir = mkdtempSync(join(tmpdir(), "morse-host-"));
  const child = spawn(process.execPath, [fileURLToPath(new URL("../server.js", import.meta.url))], {
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port), MORSE_DATA_DIR: dataDir },
    stdio: ["ignore", "pipe", "inherit"],
  });
  try {
    const ready = await new Promise((res, rej) => {
      let out = "";
      const timer = setTimeout(() => rej(new Error(`no ready line; got: ${out}`)), 10000);
      child.stdout.on("data", (chunk) => {
        out += chunk;
        if (out.includes("ready at")) {
          clearTimeout(timer);
          res(out.trim());
        }
      });
      child.on("exit", (code) => rej(new Error(`server exited early (${code})`)));
    });
    assert.equal(ready, `Morse Power ready at http://127.0.0.1:${port}`);
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
  } finally {
    child.kill();
    rmSync(dataDir, { recursive: true, force: true });
  }
});
