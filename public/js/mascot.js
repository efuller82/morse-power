// Morse Power's mascot: a round telegraph-bug critter with an antenna that
// lights up like a lamp. Built once, here, as a plain function returning
// inline SVG markup — no external assets (no images, no icon fonts).
// Poses (normal, wave, cheer, think) swap a handful of path fragments
// (legs, eyes, mouth, sparkles) on the same shared body/antenna template.
// All coloring lives in style.css (.mascot-* classes) so the mascot always
// matches the current theme palette.

const POSES = ["normal", "wave", "cheer", "think"];

function normalizePose(pose) {
  return POSES.includes(pose) ? pose : "normal";
}

function legsMarkup(pose) {
  if (pose === "wave") {
    return `
      <path class="mascot-arm-wave" d="M22 70 Q10 58 5 44" />
      <path d="M26 82 Q20 92 14 100" />
      <path d="M78 70 Q86 78 90 88" />
      <path d="M74 82 Q80 92 86 100" />
    `;
  }
  if (pose === "cheer") {
    return `
      <path d="M22 70 Q10 54 4 38" />
      <path d="M26 84 Q20 94 14 100" />
      <path d="M78 70 Q90 54 96 38" />
      <path d="M74 84 Q80 94 86 100" />
    `;
  }
  if (pose === "think") {
    return `
      <path d="M22 70 Q14 78 10 88" />
      <path d="M26 82 Q20 92 14 100" />
      <path d="M78 70 Q74 58 62 53" />
      <path d="M74 84 Q80 94 86 100" />
    `;
  }
  return `
    <path d="M22 70 Q14 78 10 88" />
    <path d="M26 82 Q20 92 14 100" />
    <path d="M78 70 Q86 78 90 88" />
    <path d="M74 82 Q80 92 86 100" />
  `;
}

function eyesMarkup(pose) {
  if (pose === "cheer") {
    return `
      <circle class="mascot-eye-white" cx="39" cy="52" r="10" />
      <circle class="mascot-eye-white" cx="61" cy="52" r="10" />
      <path class="mascot-eye-happy" d="M33 53 Q39 45 45 53" />
      <path class="mascot-eye-happy" d="M55 53 Q61 45 67 53" />
    `;
  }
  if (pose === "think") {
    return `
      <circle class="mascot-eye-white" cx="39" cy="52" r="10" />
      <circle class="mascot-eye-white" cx="61" cy="52" r="10" />
      <circle class="mascot-pupil" cx="43" cy="48" r="4.5" />
      <circle class="mascot-pupil" cx="65" cy="48" r="4.5" />
      <circle class="mascot-eye-glint" cx="41.5" cy="46.5" r="1.4" />
      <circle class="mascot-eye-glint" cx="63.5" cy="46.5" r="1.4" />
    `;
  }
  return `
    <circle class="mascot-eye-white" cx="39" cy="52" r="10" />
    <circle class="mascot-eye-white" cx="61" cy="52" r="10" />
    <circle class="mascot-pupil" cx="40" cy="53" r="4.5" />
    <circle class="mascot-pupil" cx="62" cy="53" r="4.5" />
    <circle class="mascot-eye-glint" cx="38.5" cy="51.5" r="1.4" />
    <circle class="mascot-eye-glint" cx="60.5" cy="51.5" r="1.4" />
  `;
}

function mouthMarkup(pose) {
  if (pose === "cheer") {
    return `<path class="mascot-mouth-open" d="M40 64 Q50 79 60 64 Q50 70 40 64 Z" />`;
  }
  if (pose === "think") {
    return `<path class="mascot-mouth-line" d="M44 68 Q50 65.5 56 68" />`;
  }
  return `<path class="mascot-mouth-line" d="M42 66 Q50 73 58 66" />`;
}

function sparklesMarkup(pose) {
  if (pose !== "cheer") return "";
  return `
    <path class="mascot-sparkle mascot-sparkle-a" d="M12 22 L14 27 19 29 14 31 12 36 10 31 5 29 10 27 Z" />
    <path class="mascot-sparkle mascot-sparkle-b" d="M90 26 L91.6 30 95.6 31.6 91.6 33.2 90 37.2 88.4 33.2 84.4 31.6 88.4 30 Z" />
  `;
}

// mascotSvg(pose, { size }) → inline SVG markup string. Assign it with
// `container.innerHTML = mascotSvg(...)`. There's nothing to tear down (no
// listeners, no timers), so callers can just overwrite it again whenever
// the pose should change.
export function mascotSvg(pose = "normal", { size = 110 } = {}) {
  const p = normalizePose(pose);
  return `
    <svg
      class="mascot mascot-${p}"
      width="${size}"
      height="${size}"
      viewBox="0 0 100 106"
      aria-hidden="true"
      focusable="false"
    >
      <g class="mascot-legs">${legsMarkup(p)}</g>
      <path class="mascot-antenna" d="M50 24 Q58 10 66 6" />
      <circle class="mascot-antenna-glow" cx="66" cy="6" r="9" />
      <circle class="mascot-antenna-bulb" cx="66" cy="6" r="4.5" />
      <circle class="mascot-body" cx="50" cy="58" r="34" />
      <path class="mascot-shell-seam" d="M50 25 Q45 58 50 91" />
      <circle class="mascot-cheek" cx="30" cy="64" r="4" />
      <circle class="mascot-cheek" cx="70" cy="64" r="4" />
      ${eyesMarkup(p)}
      ${mouthMarkup(p)}
      ${sparklesMarkup(p)}
    </svg>
  `;
}
