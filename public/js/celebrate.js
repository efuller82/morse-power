// Reusable CSS-driven celebration bursts. Each call spawns a handful of
// absolutely-positioned <span>/<svg> pieces styled by randomized CSS custom
// properties, animates them with a CSS keyframe, and removes the whole
// burst once its animation finishes. No canvas, no external assets.
//
// confettiBurst() is the big "you did it!" celebration (lesson complete,
// landing on the top-10 board). sparklePop() is a much smaller, quieter
// pop used right next to inline feedback (a correct answer in Learn) —
// a nudge, not a party.
//
// Both no-op under prefers-reduced-motion: a burst of motion is exactly
// what that preference asks games to skip, and there's nothing useful to
// replace it with here (unlike, say, a progress bar), so it's simply
// skipped rather than shown as a static flash.

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const CONFETTI_COLORS = ["confetti-teal", "confetti-yellow", "confetti-coral", "confetti-white"];
const CONFETTI_COUNT = 18;
const CONFETTI_LIFETIME_MS = 1500;

const SPARKLE_GLYPHS = ["✦", "✧", "✱"]; // ✦ ✧ ✱
const SPARKLE_COUNT = 4;
const SPARKLE_LIFETIME_MS = 700;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(REDUCED_MOTION_QUERY).matches
  );
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// Positions a zero-size host at the anchor element's center (or the upper
// half of the viewport if no anchor is given) — every piece inside is then
// placed with a `translate()` offset from that single point.
function positionHost(host, anchor) {
  host.style.position = "fixed";
  host.style.left = "0";
  host.style.top = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "80";

  let x = window.innerWidth / 2;
  let y = window.innerHeight * 0.3;
  if (anchor && typeof anchor.getBoundingClientRect === "function") {
    const rect = anchor.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top + rect.height / 2;
  }
  host.style.transform = `translate(${x}px, ${y}px)`;
}

function spawnBurst({ className, count, lifetimeMs, anchor, makePiece }) {
  if (prefersReducedMotion()) return;
  if (typeof document === "undefined") return;

  const host = document.createElement("div");
  host.className = "celebration-host";
  positionHost(host, anchor);

  for (let i = 0; i < count; i++) {
    const el = document.createElement("span");
    el.className = className;
    makePiece(el);
    host.appendChild(el);
  }

  document.body.appendChild(host);
  setTimeout(() => host.remove(), lifetimeMs + 200);
}

// A burst of small colored shapes flying outward and fading. Anchor it near
// whatever just made the player proud (a mascot, a rank readout) — omit the
// anchor for a generic burst from the upper-middle of the screen.
export function confettiBurst(anchor) {
  spawnBurst({
    className: "confetti-piece",
    count: CONFETTI_COUNT,
    lifetimeMs: CONFETTI_LIFETIME_MS,
    anchor,
    makePiece: (el) => {
      el.classList.add(pick(CONFETTI_COLORS));
      if (Math.random() < 0.4) el.classList.add("confetti-round");
      el.style.setProperty("--confetti-x", `${randomBetween(-160, 160)}px`);
      el.style.setProperty("--confetti-y", `${randomBetween(-210, -30)}px`);
      el.style.setProperty("--confetti-rotate", `${randomBetween(-540, 540)}deg`);
      el.style.setProperty("--confetti-delay", `${randomBetween(0, 150)}ms`);
      el.style.setProperty("--confetti-duration", `${randomBetween(1100, 1500)}ms`);
    },
  });
}

// A quick, quiet star/sparkle pop — for "correct!" feedback, not a full
// celebration.
export function sparklePop(anchor) {
  spawnBurst({
    className: "sparkle-piece",
    count: SPARKLE_COUNT,
    lifetimeMs: SPARKLE_LIFETIME_MS,
    anchor,
    makePiece: (el) => {
      el.textContent = pick(SPARKLE_GLYPHS);
      el.style.setProperty("--sparkle-x", `${randomBetween(-40, 40)}px`);
      el.style.setProperty("--sparkle-y", `${randomBetween(-34, -6)}px`);
      el.style.setProperty("--sparkle-delay", `${randomBetween(0, 90)}ms`);
    },
  });
}
