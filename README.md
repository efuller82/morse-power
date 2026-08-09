# Morse Power

A browser game that teaches kids Morse code — with a real telegraph-key
feel. Hold the key: a short press is a dot, a long press is a dash.

## Play

```
node server.js
```

Then open http://localhost:3000. No dependencies, no build step — you just
need [Node.js](https://nodejs.org) 20 or newer.

- **Tutorial** — what Morse code is, how the timing works (dits, dahs, and
  the gaps between them), and how to work the key.
- **Learn** — lessons that introduce the letters and numbers a few at a
  time, practicing both directions: key the code for a letter, and hear
  code and name the letter.
- **Play** — a one-minute scored round, your choice of direction. Fastest
  fingers make the top-10 leaderboard.

High scores live in `data/scores.json` on your machine. Nothing leaves
your computer — no accounts, no tracking, no network calls.

## Develop

```
node --test
```

This repo is run session-by-session with an LLM agent; `AGENTS.md` is the
operating manual and `STATUS.md` is the handoff between sessions.
