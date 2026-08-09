// High Scores screen: fetches the shared top-10 leaderboards (one per Play
// direction) and renders them read-only. Also exports the fetch/render
// building blocks that play.js's results sub-view reuses, so the mini
// leaderboard shown right after a round and the full High Scores screen
// stay pixel-for-pixel consistent.
//
// Score entries carry a player-chosen name — the only user data in this
// app (see SECURITY.md invariant 6). It is always rendered with
// textContent, never innerHTML, and never logged.

import { topScores } from "/lib/scores.js";

let statusEl;
let listEls = {};

// Throws on a network/HTTP failure — callers decide how to degrade.
export async function fetchScores() {
  const res = await fetch("/api/scores");
  if (!res.ok) throw new Error(`scores request failed: ${res.status}`);
  const body = await res.json();
  return Array.isArray(body.scores) ? body.scores : [];
}

// Renders one mode's top-10 list into listEl. If highlightRank is given,
// that row gets a "you" highlight and a "#N!" badge.
export function renderBoard(listEl, scores, mode, highlightRank) {
  listEl.innerHTML = "";
  const top = topScores(scores, mode);

  if (top.length === 0) {
    const li = document.createElement("li");
    li.className = "scores-empty";
    li.textContent = "No scores yet — be the first!";
    listEl.appendChild(li);
    return;
  }

  top.forEach((entry, index) => {
    const rank = index + 1;
    const li = document.createElement("li");
    li.className = "scores-row" + (rank === highlightRank ? " scores-row-you" : "");

    const rankEl = document.createElement("span");
    rankEl.className = "scores-rank";
    rankEl.textContent = rank === highlightRank ? `#${rank}!` : `#${rank}`;

    const nameEl = document.createElement("span");
    nameEl.className = "scores-name";
    nameEl.textContent = entry.name;

    const wpmEl = document.createElement("span");
    wpmEl.className = "scores-wpm";
    wpmEl.textContent = `${entry.wpm} WPM`;

    const correctEl = document.createElement("span");
    correctEl.className = "scores-correct";
    correctEl.textContent = `${entry.correct} correct`;

    li.append(rankEl, nameEl, wpmEl, correctEl);
    listEl.appendChild(li);
  });
}

async function refresh() {
  statusEl.textContent = "";
  try {
    const scores = await fetchScores();
    for (const mode of Object.keys(listEls)) {
      renderBoard(listEls[mode], scores, mode);
    }
  } catch {
    for (const mode of Object.keys(listEls)) {
      listEls[mode].innerHTML = "";
    }
    statusEl.textContent = "Scoreboard is napping. Try again soon.";
  }
}

export function initScores() {
  statusEl = document.getElementById("scores-status");
  listEls = {
    send: document.getElementById("scores-list-send"),
    catch: document.getElementById("scores-list-catch"),
  };
}

// Called by app.js whenever the outer router navigates to the High Scores
// screen — always refetch, so the board never shows stale data.
export function onScoresShow() {
  refresh();
}
