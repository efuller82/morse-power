# Agent guidance

Morse Power — a browser game that teaches kids Morse code with a real
telegraph-key feel (hold to key: short press = dot, long press = dash).
Three modes: Tutorial (how Morse timing works), Learn (progressive lessons,
both char→code and code→char), Play (60-second scored rounds with a local
top-10 leaderboard). Vanilla HTML/CSS/JS served by a dependency-free Node
server; the MVP is being built out — STATUS.md and the board say what is live.

## Start every session

1. Read `STATUS.md` — what is live, where work left off, the exact next
   action. Trust its "Next" list unless the owner's prompt overrides it.
2. Feature status lives **only** on the GitHub Projects board and its issues
   (`gh issue list`; board: "Morse Power"). There is no markdown status
   mirror. Do not create one.
3. Before touching auth, user data, credentials, infrastructure, deployment,
   or external input: read `SECURITY.md`.

## Layout

| Path | What it is |
| --- | --- |
| `server.js` | Dependency-free `node:http` server: static files plus `/api/scores` → `data/scores.json`. No npm dependencies may be added. |
| `lib/` | Shared ESM modules (Morse table, keyer logic, score logic) imported by both the browser and tests. Keep them pure — no DOM, no Node-only APIs. |
| `public/` | The game UI (HTML/CSS/JS). Browser-only code lives here. |
| `test/` | `node:test` suites — this is what the CI gate runs. |
| `data/` | Runtime-only, gitignored. Holds `scores.json` with kids' chosen names. Never commit anything here. |
| `.github/` | CI workflow (the gate) and issue/PR templates. |

## Commands

- `node --test` — the full gate CI runs. Green here means safe to merge.
- `node server.js` — run the game locally, then open http://localhost:3000.

## Rules

- One GitHub issue and board card per feature. One branch
  (`feature/<issue>-<short-name>`) from a current `main`.
  **One pull request.** Merge only on green checks. Never commit to
  `main` directly.
- Work the board top-down: take the highest-priority item that is not
  blocked. If the owner's prompt names a task, that wins. Move the card as
  the work moves (In progress when you branch, Done when the PR merges).
- No deployment. The game runs locally via `node server.js`. If hosting
  ever comes up, it is a new feature issue that requires a security review
  first.
- Zero-budget project: nothing may add recurring cost. Ask the owner before
  any action that costs money.
- Players are children and the repo is public. The only player data is a
  self-chosen short name (max 10 chars) in gitignored `data/scores.json`.
  Real names, ages, or any other PII must never appear in code, fixtures,
  tests, logs, or commits.
- The owner prefers implementation work delegated to cheaper-model
  subagents to keep token usage down; the main session specs, reviews, and
  merges.
- Keep documentation minimal: this file, `STATUS.md`, `SECURITY.md`, and
  code-adjacent docs the owner asks for. Do not add new doc files, plan
  documents, session logs, or validation machinery unless the owner asks.
  Design discussion belongs on the feature's GitHub issue.

## End every session (the handoff)

Do this after each completed task, and always before stopping:

1. **Replace** the contents of `STATUS.md` (never append) with: what is live,
   what this session did and learned, a numbered "Next" list with the exact
   next action first, and any blockers that are owner actions.
2. Make the board and issues reflect reality — close what shipped, comment
   decisions and review outcomes on the issue they belong to.
3. End your final message with a **handoff prompt**: one copy-paste line the
   owner can open the next session with, naming the next task, written in
   plain language the owner can read cold (issue numbers only as
   parenthetical references). Example:
   `Continue Morse Power: Next item 1 in STATUS.md — <task>.`
