// Pure model of the sailor: body proportions, segment masses, and the posture the uphaul figure uses,
// with the moments it puts on the lower back. No DOM. Metres and newtons.
// Lengths are fractions of standing height (Drillis and Contini); masses are fractions of body mass (Winter).
import { C } from "./constants.mjs";

export const H = C.sailorHeight;
export const MASS = C.sailorMass;

export const LEN = {
  upperArm: 0.186 * H,
  forearm: 0.146 * H,
  hand: 0.108 * H,
  thigh: 0.245 * H,
  shank: 0.246 * H,
  footH: 0.039 * H,          // ankle height
  foot: 0.152 * H,           // foot length
  torso: 0.288 * H,          // hip joint to shoulder joint
  pelvis: 0.191 * H,         // hip joint width
  shoulders: 0.259 * H,      // shoulder joint width
  neck: 0.052 * H,
  head: 0.130 * H,
};

export const MASS_SHARE = { head: 0.081, trunk: 0.497, upperArm: 0.028, forearm: 0.016, hand: 0.006, thigh: 0.1, shank: 0.0465, foot: 0.0145 };
// The mass above the lower back: head, trunk above the pelvis (thorax and abdomen, 0.355) and both arms.
export const UPPER_SHARE = MASS_SHARE.head + 0.355 + 2 * (MASS_SHARE.upperArm + MASS_SHARE.forearm + MASS_SHARE.hand);

export const ARM = LEN.upperArm + LEN.forearm + 0.5 * LEN.hand;   // shoulder to grip
export const LEG = LEN.thigh + LEN.shank;

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const R = Math.PI / 180;

// Posture while uphauling, in the rising plane of the rig: x toward the rig (downwind) from the mast foot,
// z up from the universal joint. `style` is "legs" (back straight, knees and hips drive the pull) or
// "back" (legs straight, bent at the waist). p runs from 0 (start) to 1 (base position).
// `attach` is the uphaul's tie point on the mast; the arms stay straight along the line to it.
export const DECK_Z = -0.089;           // the deck top, below the joint
export const FOOT_X = -0.2;             // both feet stand this far upwind of the mast foot, either side of it

export function uphaulPosture(style, p, attach) {
  const q = ease(Math.min(1, Math.max(0, p)));
  const legs = style !== "back";
  const hipZ = legs ? lerp(0.5, 0.83, q) : lerp(0.76, 0.83, q);
  const hipX = legs ? FOOT_X - lerp(0.2, 0.06, q) : FOOT_X - lerp(0.1, 0.06, q);
  const lean = legs ? lerp(-18, -6, q) : lerp(68, 2, q);           // torso from vertical, + toward the rig
  const torso = [Math.sin(lean * R), Math.cos(lean * R)];
  const hip = [hipX, hipZ];
  const shoulder = [hip[0] + LEN.torso * torso[0], hip[1] + LEN.torso * torso[1]];
  const lumbar = [hip[0] + 0.1 * torso[0], hip[1] + 0.1 * torso[1]];
  const to = [attach[0] - shoulder[0], attach[1] - shoulder[1]];
  const span = Math.hypot(to[0], to[1]);
  const reach = Math.min(0.94 * ARM, span - 0.05);
  const dir = [to[0] / span, to[1] / span];
  const hands = [shoulder[0] + reach * dir[0], shoulder[1] + reach * dir[1]];
  // the upper body's centre of gravity, about 0.45 of the way from the lower back to the shoulders
  const upper = [lumbar[0] + 0.45 * (shoulder[0] - lumbar[0]), lumbar[1] + 0.45 * (shoulder[1] - lumbar[1])];
  return { style: legs ? "legs" : "back", p, hip, lumbar, shoulder, hands, dir, upper, lean, feet: [FOOT_X, DECK_Z] };
}

// Moment on the lower back, N·m: the line pulling the hands toward the rig, and the upper body's own
// weight, both about the lower back. Leaning back with a straight back puts the weight behind the lower
// back, where it balances the line; bending forward puts it in front, where it adds to the line.
export function backMoment(posture, tension) {
  const { lumbar, hands, dir, upper } = posture;
  const cross = (r, f) => r[0] * f[1] - r[1] * f[0];
  const line = cross([hands[0] - lumbar[0], hands[1] - lumbar[1]], [tension * dir[0], tension * dir[1]]);
  const weight = cross([upper[0] - lumbar[0], upper[1] - lumbar[1]], [0, -UPPER_SHARE * MASS * C.g]);
  const rx = lumbar[0] - hands[0], rz = lumbar[1] - hands[1];
  return { moment: Math.abs(line + weight), line, weight, lineArm: Math.abs(rx * dir[1] - rz * dir[0]), weightArm: upper[0] - lumbar[0] };
}
