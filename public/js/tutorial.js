// Tutorial screen: teaches what Morse code is, how timing works, every
// character, lets kids try the key, then explains Learn/Play.
// Static HTML lives in index.html; this module fills in the generated bits
// (timing diagram, alphabet grid) and wires up audio + the keyer.

import { MORSE, toCode, encode } from "/lib/morse.js";
import { playCode } from "./audio.js";
import { createKeyer } from "./keyerui.js";
import { mascotSvg } from "./mascot.js";
import { getUnitMs } from "./app.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");

function codeSymbols(code) {
  return Array.from(code)
    .map((s) => (s === "." ? "●" : "▬"))
    .join(" ");
}

function describeCode(code) {
  return Array.from(code)
    .map((s) => (s === "." ? "dit" : "dah"))
    .join(" ");
}

// Turn a run of letters (e.g. ["M", "E"]) into labeled groups of 1-unit
// blocks for the timing diagram: on = sound, off = silence.
function codeToTimingGroups(letters) {
  const groups = [];
  letters.forEach((char, i) => {
    const code = toCode(char);
    const blocks = [];
    Array.from(code).forEach((sym, si) => {
      const width = sym === "." ? 1 : 3;
      for (let u = 0; u < width; u++) blocks.push(true);
      if (si < code.length - 1) blocks.push(false); // 1-unit gap inside a letter
    });
    groups.push({ label: `${char} — ${describeCode(code)}`, blocks });
    if (i < letters.length - 1) {
      groups.push({ label: "gap (3 units)", blocks: [false, false, false], isGap: true });
    }
  });
  return groups;
}

function renderTimingDiagram(container, letters) {
  container.innerHTML = "";
  for (const group of codeToTimingGroups(letters)) {
    const col = document.createElement("div");
    col.className = "timing-group" + (group.isGap ? " timing-gap" : "");

    const row = document.createElement("div");
    row.className = "timing-row";
    for (const on of group.blocks) {
      const block = document.createElement("span");
      block.className = "timing-block " + (on ? "on" : "off");
      row.appendChild(block);
    }

    const label = document.createElement("div");
    label.className = "timing-label";
    label.textContent = group.label;

    col.append(row, label);
    container.appendChild(col);
  }
}

export function initTutorial() {
  const lamp = document.getElementById("tut-lamp");

  // Only one code should ever be playing at a time; a new play cancels the
  // last one so lamp/audio don't overlap.
  let currentPlayback = null;

  function playAndFlash(code, { onDone } = {}) {
    if (currentPlayback) {
      currentPlayback.cancel();
      currentPlayback = null;
    }
    const controller = playCode(code, getUnitMs(), {
      onOn: () => lamp.classList.add("lit"),
      onOff: () => lamp.classList.remove("lit"),
    });
    currentPlayback = controller;
    controller.done.then(() => {
      if (currentPlayback === controller) currentPlayback = null;
      if (onDone) onDone();
    });
    return controller;
  }

  // --- Section 2: timing ---

  renderTimingDiagram(document.getElementById("tut-timing-diagram"), ["M", "E"]);

  const playCodes = {
    dot: ".",
    dash: "-",
    m: toCode("M"),
    me: encode("ME"),
  };

  for (const btn of document.querySelectorAll("[data-tut-play]")) {
    btn.addEventListener("click", () => {
      playAndFlash(playCodes[btn.dataset.tutPlay]);
    });
  }

  // --- Section 3: alphabet grid ---

  const grid = document.getElementById("tut-grid");
  for (const char of ALPHABET) {
    const code = MORSE[char];
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "tut-cell";

    const charEl = document.createElement("span");
    charEl.className = "tut-cell-char";
    charEl.textContent = char;

    const codeEl = document.createElement("span");
    codeEl.className = "tut-cell-code";
    codeEl.textContent = codeSymbols(code);

    cell.append(charEl, codeEl);
    cell.addEventListener("click", () => {
      cell.classList.add("playing");
      playAndFlash(code, { onDone: () => cell.classList.remove("playing") });
    });
    grid.appendChild(cell);
  }

  // --- Section 4: try the key ---

  document.getElementById("tut-key-mascot").innerHTML = mascotSvg("think", { size: 64 });

  const committedEl = document.getElementById("tut-committed");
  const keyerMount = document.getElementById("tut-keyer");
  let keyedSoFar = "";

  createKeyer(keyerMount, {
    // First press stops the "press me!" idle pulse for good — once they've
    // found the key, the hint has done its job.
    onElement: () => keyerMount.classList.add("tut-keyer-used"),
    onLetter: (code, char) => {
      keyedSoFar += char;
      committedEl.textContent = keyedSoFar;
    },
  });
}
