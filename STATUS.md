# Status

Replace this file's contents at the end of each working session. Do not append.

- **Updated:** 2026-08-09 (bootstrap + full MVP + first playtest fixes)

## Live

The complete MVP. `node server.js` → http://localhost:3000:

- **Tutorial** — what Morse is, extensive unit-timing teaching with a
  visual diagram and hear-it buttons, full A–Z 0–9 chart with audio + lamp
  playback, live practice telegraph key (mouse/touch/spacebar).
- **Learn** — four-phase flashcards over all 36 characters: Practice
  (code showing, same card until keyed right), Test (no code; a miss
  reveals the answer and the card comes back later), Listen (hear the
  code, pick the letter), and Streak (strict A→9 order, one miss reveals
  the answer and restarts the run at A; best streak is banked as you go).
  Per-phase progress persists in localStorage.
- **Play** — 60-second scored rounds, "Send it!" (key the shown character)
  or "Catch it!" (hear/watch code, answer by keyboard or letter grid);
  prompts come from an endless random word stream so rounds can't be
  memorized; results show correct/missed/WPM.
- **Leaderboard** — top 10 per direction in gitignored `data/scores.json`
  via `GET/POST /api/scores` (names sanitized server-side, textContent
  rendering); High Scores screen; name entry only when a score qualifies.
- **Extras** — sound on/off toggle (fully playable as silent light mode),
  speed presets, Sparky the mascot, confetti/sparkle celebrations,
  success/error blips, responsive from phone to desktop.

Gate: `node --test` — 86 tests, green in CI. Branch protection on `main`
requires both CI checks.

## This session did and learned

- Bootstrapped the scaffold into public repo `efuller82/morse-power` with
  board "Morse Power" (project 5), seven feature issues — all shipped
  (PRs #7, #8, #9, #11, #12, #13, #14) and closed.
- Owner requests honored mid-session: anti-memorization random word stream
  in Play (issue #4 comment), sound toggle for silent play (issue #10).
- Implementation was delegated to cheaper-model subagents; the main session
  spec'd, reviewed, and merged. This worked well and is now an AGENTS.md rule.
- Gotcha: `gh` initially lacked the `workflow` OAuth scope, so the first
  push (containing `ci.yml`) was rejected until the owner refreshed auth.
- Security review of the leaderboard (the only feature touching player
  data) is recorded on issue #5.
- First live playtest feedback landed the same session: the flashing lamp
  now stays in view while scrolling Tutorial/Learn (#16), and Learn
  practice shows a cheat-sheet key (characters + codes) beside the
  telegraph key on key-questions, with a compact practice layout so both
  fit on screen at once (#18), the Tutorial's "Try the key!" block shows
  the full 36-character reference key beside the telegraph key (#20), and
  a Clear button resets the Tutorial's "You keyed:" line (#22).
- Owner then replaced the lesson-based Learn mode wholesale with the
  three-phase flashcard system (#24) — the #18 cheat sheet went with it
  (phase 1 shows the code on the card itself) — and added a fourth
  Streak phase (#26): climb the deck in order, a miss restarts the run,
  best streak persisted.

## Next

1. Playtest with the kids and turn their feedback into new feature issues
   on the board (owner action — the fun kind).
2. Future feature candidates, if wanted: whole-word receive rounds at true
   letter spacing, per-player profiles, adjustable round length, a
   Koch-style speed-building mode. Each would be a new issue.

## Blockers

None.
