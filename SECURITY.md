# Security

The single source for this repository's security posture. Read it before
touching authentication, user data, credentials, infrastructure, deployment,
or external input. Security-review outcomes are recorded as comments on the
feature's GitHub issue, not as new markdown files.

## Invariants — these must always hold

1. Players are children and the repository is public. The only player data
   collected is a self-chosen short leaderboard name (max 10 characters),
   stored solely in `data/scores.json`, which is gitignored. Player data
   never appears in code, fixtures, tests, logs, or commits. No analytics,
   no telemetry.
2. `main` changes only via pull request with green checks.
3. No credentials in the repository, in config files, or in workflows.
   CI authenticates to nothing: the gate runs `node --test` offline with no
   secrets and no cloud access.
4. External downloads and GitHub Actions are pinned (SHA-256 / commit SHA).
5. No external network calls: the app loads no CDN assets, fonts, or
   third-party scripts, and phones home to nothing. Everything is served by
   the local Node server. This is deliberate — it is a kids' app.
6. Leaderboard names are sanitized server-side (length cap, control and
   markup characters stripped) and rendered on the client with
   `textContent`, never `innerHTML`.

## When a dedicated security session is mandatory

Before enabling any new surface that accepts external input or widens who
can see what: authentication, user-generated content, third-party APIs,
email/notification sending, payments. The session works from this file and
the diff under review; its outcome is recorded on the feature's issue.

## Known gaps

Solo-built MVP; no independent security review has happened yet. The scores
API accepts input from anything that can reach the local server — fine for
localhost use, but revisit invariant 6 and add rate limiting before ever
exposing the server beyond the local machine.
