# Status

Replace this file's contents at the end of each working session. Do not append.

- **Updated:** 2026-11-11 (HOST setting for packaged builds)

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
- **HOST setting** — `HOST=127.0.0.1 node server.js` listens on this
  computer only. Unset
  (the default) it still listens on every interface, so phones on the
  same Wi-Fi can play. Packaged builds always set it.

Gate: `node --test` — 90 tests, green in CI. Branch protection on `main`
requires both CI checks.

## This session did and learned

- Morse Power will ship inside Know It All as a package built by the new
  `app-packages` tool (its own local repo next to this one, outside this
  repo). The package carries its own Node runtime, pinned by SHA-256 per
  SECURITY.md invariant 4, and is built only from committed files, so
  `data/scores.json` can never be in it.
- The server listened on every interface, so the packaged `node.exe`
  would have raised a Windows Firewall prompt and exposed the scores API
  to the home network. The `HOST` env var fixes that without changing
  local play. A new test starts the real server with `HOST` and `PORT`
  set and loads the page from 127.0.0.1.
- A dry-run package of this branch passed: 90 tests, 33.5 MB zip, and
  the unzipped package answered `/`, `/api/scores` and `/lib/morse.js`
  while listening on 127.0.0.1 only.
- Releasing a version from now on: in `app-packages`, run
  `.\release.ps1 morse-power <version>`. It tests, packages, smoke-tests,
  tags `v<version>` and attaches the zip to a GitHub release here.

## Next

1. If this repo's GitHub Releases page has no `v1.0.0` yet, release the
   first package from `main`: `.\release.ps1 morse-power 1.0.0` in
   `app-packages`.
2. Playtest with the kids and turn their feedback into new feature issues
   on the board (owner action — the fun kind).
3. Future feature candidates, if wanted: whole-word receive rounds at true
   letter spacing, per-player profiles, adjustable round length, a
   Koch-style speed-building mode. Each would be a new issue.

## Blockers

None.
