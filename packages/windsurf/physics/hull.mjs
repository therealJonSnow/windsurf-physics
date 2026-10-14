// The board's plan shape and heights, in model units (x forward from the CLR, y to port).
// Shared by the physics (where the rig rests on the deck) and the drawing.
import { BOARD } from "./sail.mjs";

// Heights above the water line, in model units.
export const HEIGHTS = { deck: BOARD.thick, joint: BOARD.thick + 5 };   // deck top, and the universal joint (the rig's pivot)

// Half-width of the hull at x.
export function halfWidth(x) {
  if (x < BOARD.tail || x > BOARD.nose) return 0;
  const t = (x - BOARD.tail) / (BOARD.nose - BOARD.tail);
  if (t >= 0.44) {
    const q = (t - 0.44) / 0.56;
    return 21 * Math.pow(Math.max(0, 1 - Math.pow(q, 2.1)), 0.55);
  }
  return 13.5 + 7.5 * Math.pow(Math.sin((Math.PI / 2) * (t / 0.44)), 0.85);
}

export const onHull = ([x, y], margin = 0) => Math.abs(y) < halfWidth(x) - margin;

// The hull outline, inset by `inset`, as a closed ring of [x, y] points.
export function hullRing(inset = 0, from = BOARD.tail, to = BOARD.nose) {
  const n = 52;
  const tipR = 3.2;
  const side = [];
  const end = to - inset - tipR * 0.6;
  for (let i = 0; i <= n; i++) {
    const x = from + inset + ((end - from - inset) * (1 - Math.cos((Math.PI / 2) * (i / n) * 2))) / 2;
    side.push([x, Math.max(0.01, halfWidth(x) - inset)]);
  }
  const [ex, ey] = side[side.length - 1];
  const cap = [];
  for (let i = 1; i < 8; i++) {
    const a = Math.PI / 2 - (Math.PI / 2) * (i / 8);
    cap.push([ex + (to - inset - ex) * Math.cos(a), ey * Math.sin(a)]);
  }
  const starboard = [...side, ...cap].map(([x, y]) => [x, -y]);
  const port = [...side, ...cap].map(([x, y]) => [x, y]).reverse();
  return [...starboard, [to - inset, 0], ...port].filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.05);
}
