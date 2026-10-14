// Pure model of the sail: outline, centre of effort, lift and drag, and the rig's frame in the board.
// From the steering demo's model.mjs. No DOM.
// Model units (the drawing): 1 unit = 1/0.56 cm of the full-size board, so a 250 cm board is 140 units
// and the model stands at about 1:1.8. Forces and moments are computed at full size.
import { C } from "./constants.mjs";

export const UNIT_CM = 1 / 0.56;
export const UNIT_M = UNIT_CM / 100;
export const toM = (units) => units * UNIT_M;
export const toUnits = (metres) => metres / UNIT_M;

export const BOARD = { tail: -46, nose: 94, width: 42, thick: 6.4 };   // x along the board from the CLR
export const MAST_FOOT = 30;            // mast foot, units ahead of the CLR
export const BOOM_U = 78;               // boom height along the mast
export const BOOM_END = 110;            // boom length from the mast

// Sail outline in the sail plane: u along the mast from the foot, v aft along the boom.
export const SAIL = [
  [14, 0], [18, 18], [26, 40], [40, 64], [56, 86], [72, 104],          // tack, curved foot, clew
  [104, 96], [136, 84], [168, 68], [198, 50], [226, 30], [249, 12],    // roach leech to head
  [251, 0],                                                            // head
];
export const CLEW = SAIL[5];
export const MAST_TOP = SAIL[SAIL.length - 1][0];

export function areaCentroid(poly) {
  let a = 0, cu = 0, cv = 0;
  for (let i = 0; i < poly.length; i++) {
    const [u0, v0] = poly[i], [u1, v1] = poly[(i + 1) % poly.length];
    const c = u0 * v1 - u1 * v0;
    a += c; cu += (u0 + u1) * c; cv += (v0 + v1) * c;
  }
  a /= 2;
  return { area: Math.abs(a), u: cu / (6 * a), v: cv / (6 * a) };
}
export const CE = areaCentroid(SAIL);
export const AREA_M2 = CE.area * UNIT_CM * UNIT_CM / 1e4;

export const R = Math.PI / 180;
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const SHEET = [6, 88];           // boom angle off the centreline, degrees
export const TRIM = [-25, 30];          // sheet trim off the ideal, degrees: - sheeted in, + eased out

// Lift and drag of a soft sail against angle of attack (degrees).
export function coefficients(alpha) {
  const a = Math.abs(alpha) * R;
  const lift = alpha <= 0 ? 0 : 1.35 * Math.sin(2 * Math.min(a, 25 * R) * 1.8) * (a > 25 * R ? Math.max(0.55, Math.cos((a - 25 * R) * 1.4)) : 1);
  const drag = 0.06 + 1.15 * Math.sin(a) ** 2;
  return { lift, drag };
}

// Dynamic pressure of the wind on the whole sail, N.
export const sailPressure = (speed = C.wind) => 0.5 * C.rho * speed * speed * AREA_M2;

const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// A rig frame from a mast direction m and a boom direction b (made square to m), in board coordinates
// (x forward from the CLR, y to port, z up, units). `at(u, v, w)` is a point of the sail plane.
export function frameFrom(m, b, extra = {}) {
  m = unit(m);
  const d = b[0] * m[0] + b[1] * m[1] + b[2] * m[2];
  b = unit([b[0] - m[0] * d, b[1] - m[1] * d, b[2] - m[2] * d]);
  const n = cross(m, b);
  const foot = [MAST_FOOT, 0, 0];
  const at = (u, v, w = 0) => [0, 1, 2].map((i) => foot[i] + m[i] * u + b[i] * v + n[i] * w);
  return { m, b, n, foot, at, ...extra };
}

// The sailing rig. rake (degrees, +) tips the mast toward the front of the sail, in the sail's own plane.
// sheet: boom angle off the centreline (rig to port). heel (degrees, +) leans the whole rig to windward.
export function rigFrame(rake, sheet, heel = 0) {
  const r = rake * R, d = sheet * R, h = heel * R;
  const bh = [-Math.cos(d), Math.sin(d), 0];
  const up = [0, 0, 1];
  const m0 = [0, 1, 2].map((i) => up[i] * Math.cos(r) - bh[i] * Math.sin(r));
  const b0 = [0, 1, 2].map((i) => bh[i] * Math.cos(r) + up[i] * Math.sin(r));
  const tilt = (v) => [v[0], v[1] * Math.cos(h) - v[2] * Math.sin(h), v[2] * Math.cos(h) + v[1] * Math.sin(h)];
  return frameFrom(tilt(m0), tilt(b0), { rake, sheet, heel });
}

// The lean to windward a sailor holds with the rig upright, so the CE sits over the centreline.
export function heelFor(sheet) {
  const d = sheet * R;
  return clamp(Math.atan2(CE.v * Math.sin(d), CE.u) / R, 0, C.heelMax);
}
