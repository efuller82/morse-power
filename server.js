import { createServer } from "node:http";
import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { validateEntry, addScore } from "./lib/scores.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = resolve(ROOT, "public");
const LIB_DIR = resolve(ROOT, "lib");

// Max size for a POST /api/scores body. Generous for a { name, mode, wpm,
// correct, missed } payload; small enough to reject anything abusive.
const MAX_SCORE_BODY_BYTES = 4096;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function notFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

function methodNotAllowed(res) {
  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

// Read fresh from process.env on every call (rather than caching at module
// scope) so tests can point MORSE_DATA_DIR at a fresh temp dir per run.
function dataDir() {
  return process.env.MORSE_DATA_DIR ?? resolve(ROOT, "data");
}

function scoresFilePath() {
  return resolve(dataDir(), "scores.json");
}

// Never throws: a missing file, unreadable JSON, or a JSON shape without a
// `scores` array is all treated as "no scores yet" rather than a crash —
// and never logs the file's content (it may hold player names).
async function readScores() {
  try {
    const raw = await readFile(scoresFilePath(), "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.scores) ? parsed.scores : [];
  } catch {
    return [];
  }
}

// Write-then-rename so a reader never observes a half-written file.
async function writeScores(scores) {
  const file = scoresFilePath();
  await mkdir(dataDir(), { recursive: true });
  const tmpFile = `${file}.tmp`;
  await writeFile(tmpFile, JSON.stringify({ scores }), "utf8");
  await rename(tmpFile, file);
}

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function handleScoresApi(req, res) {
  if (req.method === "GET") {
    return sendJson(res, 200, { scores: await readScores() });
  }

  if (req.method === "POST") {
    const bodyBuf = await readRequestBody(req);
    if (bodyBuf.length > MAX_SCORE_BODY_BYTES) {
      return sendJson(res, 413, { error: "Payload too large" });
    }

    let body;
    try {
      body = JSON.parse(bodyBuf.toString("utf8"));
    } catch {
      return sendJson(res, 400, { error: "Invalid JSON" });
    }

    const entry = validateEntry(body);
    if (!entry) {
      return sendJson(res, 400, { error: "Invalid score" });
    }

    const scores = await readScores();
    const result = addScore(scores, entry, new Date().toISOString());
    await writeScores(result.scores);
    return sendJson(res, 200, { scores: result.scores, rank: result.rank });
  }

  return methodNotAllowed(res);
}

async function serveFile(res, baseDir, relativePath) {
  const filePath = resolve(baseDir, "." + relativePath.replaceAll("/", sep));
  if (filePath !== baseDir && !filePath.startsWith(baseDir + sep)) {
    return notFound(res);
  }
  try {
    const body = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    res.end(body);
  } catch {
    notFound(res);
  }
}

export function createApp() {
  return createServer(async (req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    } catch {
      return notFound(res);
    }
    if (pathname === "/api/scores") {
      return handleScoresApi(req, res);
    }

    if (req.method !== "GET") {
      return methodNotAllowed(res);
    }
    if (pathname === "/") pathname = "/index.html";
    if (pathname.startsWith("/lib/")) {
      return serveFile(res, LIB_DIR, pathname.slice("/lib".length));
    }
    return serveFile(res, PUBLIC_DIR, pathname);
  });
}

const isMain =
  process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => {
    console.log(`Morse Power ready at http://localhost:${port}`);
  });
}
