// The sailor: an artist's jointed wooden mannequin at the model's scale (1:1.8).
// Pure part: a small forward-kinematics skeleton with two-bone IK for knees and elbows, poses for the
// pilot page, and the centre of gravity from segment masses. Draw part: turned segments and ball joints,
// each returned as an item with its own depth so limbs pass in front of and behind the mast and boom.
// Board frame, model units (x forward from the CLR, y to port, z up).
import { k, G } from "./kit.mjs";
import { LEN, MASS_SHARE, MASS } from "./physics/sailor.mjs";
import { UNIT_M, MAST_FOOT } from "./physics/sail.mjs";
import { halfWidth } from "./physics/hull.mjs";

const U = (m) => m / UNIT_M;                      // metres to model units
const add = G.add3, sub = G.sub3, mul = G.mul3, dot = G.dot3, unit = G.unit3, cross = G.cross3, len = G.len3;
const UP = [0, 0, 1];

export const SIZE = {
  upperArm: U(LEN.upperArm), forearm: U(LEN.forearm), hand: U(LEN.hand),
  thigh: U(LEN.thigh), shank: U(LEN.shank), footH: U(LEN.footH), foot: U(LEN.foot),
  torso: U(LEN.torso), neck: U(LEN.neck), head: U(LEN.head),
  hipHalf: U(0.055 * 1.75), shoulderHalf: U(0.1 * 1.75),
};

// Two-bone IK: from root a toward target t with bone lengths l1, l2, bending toward `pole`.
export function twoBone(a, t, l1, l2, pole) {
  const to = sub(t, a);
  const d0 = len(to);
  const dir = d0 > 1e-6 ? mul(to, 1 / d0) : [0, 0, -1];
  const d = Math.min(l1 + l2 - 1e-3, Math.max(Math.abs(l1 - l2) + 1e-3, d0));
  const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  let pp = sub(pole, mul(dir, dot(pole, dir)));
  pp = len(pp) < 1e-6 ? unit(cross(dir, [0, 1, 0])) : unit(pp);
  const mid = add(a, add(mul(dir, l1 * cosA), mul(pp, l1 * sinA)));
  return { mid, end: add(a, mul(dir, d)), reached: d0 <= l1 + l2 };
}

// A skeleton from a posture spec:
//   pelvis   hip centre; torso: unit vector from the hip centre to the shoulder centre
//   facing   horizontal unit vector the chest faces; feet: [{ at, dir }] foot plate centres and directions
//   hands    [left, right] grip targets; look: optional point the head turns toward
export function skeleton({ pelvis, torso, facing, feet, hands, look = null }) {
  const side = unit(cross(UP, facing));                 // to the sailor's left
  const hip = [add(pelvis, mul(side, SIZE.hipHalf)), add(pelvis, mul(side, -SIZE.hipHalf))];
  const chestTop = add(pelvis, mul(torso, SIZE.torso));
  const shoulder = [add(chestTop, mul(side, SIZE.shoulderHalf)), add(chestTop, mul(side, -SIZE.shoulderHalf))];
  const waist = add(pelvis, mul(torso, 0.3 * SIZE.torso));
  const neck = add(chestTop, mul(torso, 0.04 * SIZE.torso));
  let headDir = unit(add(torso, mul(UP, 0.6)));
  if (look) headDir = unit(add(mul(headDir, 2.2), unit(sub(look, neck))));
  const head = add(neck, mul(headDir, SIZE.neck + 0.45 * SIZE.head));
  const ankle = feet.map(({ at, dir }) => add(add(at, mul(dir, -0.22 * SIZE.foot)), [0, 0, SIZE.footH]));
  const toe = feet.map(({ at, dir }, i) => add(ankle[i], add(mul(dir, 0.72 * SIZE.foot), [0, 0, -0.55 * SIZE.footH])));
  const legs = [0, 1].map((i) => twoBone(hip[i], ankle[i], SIZE.thigh, SIZE.shank, add(facing, mul(UP, 0.1))));
  const arms = [0, 1].map((i) => twoBone(shoulder[i], hands[i], SIZE.upperArm, SIZE.forearm + 0.45 * SIZE.hand, add(mul(UP, -1), mul(facing, -0.5))));
  const wrist = arms.map((a, i) => {
    const d = unit(sub(a.end, a.mid));
    return sub(a.end, mul(d, 0.45 * SIZE.hand));
  });
  const handTip = arms.map((a, i) => add(wrist[i], mul(unit(sub(a.end, a.mid)), SIZE.hand)));
  return {
    side, facing, torso, pelvis, hip, waist, chestTop, neck, head, headDir, shoulder,
    knee: legs.map((l) => l.mid), ankle: legs.map((l) => l.end), toe, feet,
    elbow: arms.map((a) => a.mid), wrist, handTip, grip: arms.map((a) => a.end),
    reached: arms.every((a) => a.reached),
  };
}

// Centre of gravity from segment masses (Winter's fractions), board frame.
export function cgOf(s) {
  const mid = (a, b) => G.lerp3(a, b, 0.5);
  const parts = [
    [MASS_SHARE.head, s.head],
    [MASS_SHARE.trunk, G.lerp3(s.pelvis, s.chestTop, 0.45)],
    ...[0, 1].flatMap((i) => [
      [MASS_SHARE.upperArm, mid(s.shoulder[i], s.elbow[i])],
      [MASS_SHARE.forearm, mid(s.elbow[i], s.wrist[i])],
      [MASS_SHARE.hand, mid(s.wrist[i], s.handTip[i])],
      [MASS_SHARE.thigh, G.lerp3(s.hip[i], s.knee[i], 0.43)],
      [MASS_SHARE.shank, G.lerp3(s.knee[i], s.ankle[i], 0.43)],
      [MASS_SHARE.foot, mid(s.ankle[i], s.toe[i])],
    ]),
  ];
  const total = parts.reduce((a, [w]) => a + w, 0);
  return parts.reduce((acc, [w, p]) => add(acc, mul(p, w / total)), [0, 0, 0]);
}
export const BODY_MASS = MASS;

// ---- poses ----
// Place a foot plate on the deck: keep it inside the deck outline.
function onDeck([x, y], Zd, margin = 4.5) {
  const w = Math.max(0, halfWidth(x) - margin);
  return [x, Math.max(-w, Math.min(w, y)), Zd];
}

// Uphauling: from the physics posture (rising plane, metres, x downwind from the mast foot, z up from
// the joint). d: the downwind direction in the board frame (horizontal unit). Feet either side of the
// mast foot, along the board.
export function poseUphaul(posture, d, board) {
  const o = [MAST_FOOT, 0, board.ZF];
  const along = unit(cross(UP, d));                     // horizontal, square to the rising plane
  const P2 = ([x, z], s = 0) => add(o, add(add(mul(d, U(x)), mul(UP, U(z))), mul(along, s)));
  const pelvis = P2(posture.hip);
  const torso = unit(sub(P2(posture.shoulder), pelvis));
  const feet = [1, -1].map((sgn) => {
    const c = P2([posture.feet[0], 0], sgn * U(0.2));
    return { at: onDeck([c[0], c[1]], board.Zd), dir: unit(add(d, mul(along, sgn * 0.35))) };
  });
  const grip = P2(posture.hands);
  const lineDir = unit(add(mul(d, posture.dir[0]), mul(UP, posture.dir[1])));
  const hands = [add(add(grip, mul(lineDir, 2.2)), mul(along, 0.9)), add(add(grip, mul(lineDir, -2.2)), mul(along, -0.9))];
  return { spec: { pelvis, torso, facing: d, feet, hands, look: P2(posture.hands) }, grip };
}

// Base position: standing upwind of the mast foot, facing the rig, both hands on the mast below the boom,
// arms long, leaning back a little against the rig. d: downwind (board frame); rig: the base frame.
// The sailor steps toward the side the rig is tilted to, then finds the most upright lean and the grip
// on the mast (nearest a comfortable height) that both hands can reach.
export function poseBase(d, rig, board) {
  const foot = [MAST_FOOT, 0, board.ZF];
  const across = unit(cross(UP, d));
  const mast = (u) => add(rig.at(u, 0, 0), [0, 0, board.ZF]);
  const shift = Math.max(-U(0.3), Math.min(U(0.3), dot(sub(mast(62), foot), across)));
  const centre = [foot[0] - U(0.27) * d[0] + shift * across[0], foot[1] - U(0.27) * d[1] + shift * across[1]];
  const feet = [1, -1].map((sgn) => {
    const at = onDeck([centre[0] + sgn * U(0.19) * across[0], centre[1] + sgn * U(0.19) * across[1]], board.Zd);
    return { at, dir: unit(add(d, mul(across, sgn * 0.25))) };
  });
  const mid = [(feet[0].at[0] + feet[1].at[0]) / 2, (feet[0].at[1] + feet[1].at[1]) / 2];
  const reach = 0.97 * (SIZE.upperArm + SIZE.forearm + 0.45 * SIZE.hand);
  let best = null;
  for (let l = -8; l <= 40 && !best; l += 2) {
    const r = (l * Math.PI) / 180;
    const torso = unit(add(mul(d, Math.sin(r)), mul(UP, Math.cos(r))));
    const pelvis = [mid[0] - Math.sin(r) * 5 * d[0], mid[1] - Math.sin(r) * 5 * d[1], board.Zd + U(0.88) - Math.max(0, l - 10) * 0.25];
    const shoulders = [1, -1].map((sgn) => add(add(pelvis, mul(torso, SIZE.torso)), mul(unit(cross(UP, d)), sgn * SIZE.shoulderHalf)));
    const fits = (u, i) => len(sub(mast(u), shoulders[i])) <= reach;
    let pick = null;
    for (const u of [60, 56, 64, 52, 68, 48, 44, 40]) if (fits(u + 6, 0) && fits(u - 6, 1)) { pick = u; break; }
    if (pick != null) best = { pelvis, torso, facing: d, feet, hands: [mast(pick + 6), mast(pick - 6)], look: mast(pick + 20) };
  }
  if (!best) {
    const torso = unit(add(mul(d, 0.64), mul(UP, 0.77)));
    best = { pelvis: [mid[0], mid[1], board.Zd + U(0.8)], torso, facing: d, feet, hands: [mast(58), mast(46)], look: mast(70) };
  }
  return { spec: best };
}

// ---- drawing ----
const S = (paths, style) => k.solidSvg(paths, style);

// A tapered limb from a to b with radii r0, r1, shortened to leave room for the balls at its ends.
function limb(a, b, r0, r1, P, gap0, gap1, tone = "mid") {
  const L = len(sub(b, a));
  const F = G.frameAlong(a, unit(sub(b, a)));
  const s0 = gap0, s1 = Math.max(gap0 + 1, L - gap1);
  const prof = [[s0, r0 * 0.78], [s0 + 0.12 * (s1 - s0), r0, 1], [s0 + 0.5 * (s1 - s0), (r0 + r1) / 2 + 0.25, 1], [s1 - 0.12 * (s1 - s0), r1, 1], [s1, r1 * 0.78]];
  return S(G.solidOf(prof, F, P, { steps: 24, rims: "ends" }), { tone, crease: "none" });
}
const ball = (c, r, P, tone = "lo") => S(G.sphereOf(c, r, P, { steps: 24 }), { tone });

// Items for the painter: each segment and joint with its centre. `extra` styles: { lit: [names] }.
export function drawMannequin(P, s, { plates = true, board = null, cg = false } = {}) {
  const items = [];
  const put = (mid, svg, bias = 0) => items.push({ mid, svg, bias });
  const r = { thigh: 3.3, knee: 2.7, shank: 2.5, ankle: 1.9, upper: 2.3, elbow: 1.9, fore: 1.8, wrist: 1.4 };
  // foot plates on the deck: placement reads from above
  if (plates && board) {
    s.feet.forEach(({ at, dir }) => {
      const side = [-dir[1], dir[0]];
      const ring = [];
      const Lf = SIZE.foot * 0.62, Wf = 4.2;
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2;
        const x = Math.cos(a) * Lf, y = Math.sin(a) * Wf;
        ring.push([at[0] + dir[0] * x + side[0] * y + dir[0] * 2, at[1] + dir[1] * x + side[1] * y + dir[1] * 2]);
      }
      put([at[0], at[1], board.Zd], S(k.extrude(ring, board.Zd, 0.35, P), { tone: "lo", crease: "none" }), -40);
    });
  }
  for (const i of [0, 1]) {
    // leg: foot, ankle, shank, knee, thigh, hip
    const footDir = unit(sub(s.toe[i], s.ankle[i]));
    put(G.lerp3(s.ankle[i], s.toe[i], 0.5), S(G.solidOf([[0, 1.6], [2, 2.4, 1], [SIZE.foot * 0.55, 2.2, 1], [SIZE.foot * 0.78, 1.2]], G.frameAlong(sub(s.ankle[i], mul(footDir, 2.2)), footDir), P, { steps: 20 }), { tone: "mid", crease: "none" }));
    put(s.ankle[i], ball(s.ankle[i], r.ankle, P), 0.2);
    put(G.lerp3(s.knee[i], s.ankle[i], 0.5), limb(s.knee[i], s.ankle[i], r.shank, 1.8, P, r.knee * 0.7, r.ankle * 0.7));
    put(s.knee[i], ball(s.knee[i], r.knee, P), 0.2);
    put(G.lerp3(s.hip[i], s.knee[i], 0.5), limb(s.hip[i], s.knee[i], r.thigh, 2.6, P, 1.5, r.knee * 0.7));
    // arm: shoulder, upper arm, elbow, forearm, wrist, hand
    put(G.lerp3(s.shoulder[i], s.elbow[i], 0.5), limb(s.shoulder[i], s.elbow[i], r.upper, 1.9, P, 2.2, r.elbow * 0.7));
    put(s.elbow[i], ball(s.elbow[i], r.elbow, P), 0.2);
    put(G.lerp3(s.elbow[i], s.wrist[i], 0.5), limb(s.elbow[i], s.wrist[i], r.fore, 1.4, P, r.elbow * 0.7, r.wrist * 0.7));
    put(s.wrist[i], ball(s.wrist[i], r.wrist, P), 0.2);
    const hd = unit(sub(s.handTip[i], s.wrist[i]));
    put(G.lerp3(s.wrist[i], s.handTip[i], 0.5), S(G.solidOf([[0, 1.2], [1.5, 1.9, 1], [SIZE.hand * 0.55, 2.0, 1], [SIZE.hand * 0.85, 1.4, 1], [SIZE.hand, 0.6]], G.frameAlong(add(s.wrist[i], mul(hd, 0.8)), hd), P, { steps: 18 }), { tone: "mid", crease: "none" }));
    put(s.shoulder[i], ball(s.shoulder[i], 2.8, P), 0.3);
  }
  // pelvis, waist ball, chest, neck, head
  const Ft = G.frameAlong(s.pelvis, s.torso);
  put(add(s.pelvis, mul(s.torso, -1)), S(G.solidOf([[-5.5, 2.5], [-4.6, 6.2, 1], [-1.5, 7.6, 1], [1.6, 7.0, 1], [3.6, 5.2]], Ft, P, { steps: 32 }), { tone: "mid", crease: "none" }), 0.4);
  put(s.waist, ball(s.waist, 4.6, P), 0.5);
  const Lc = SIZE.torso;
  put(G.lerp3(s.waist, s.chestTop, 0.55), S(G.solidOf([[0.34 * Lc, 5.0], [0.42 * Lc, 7.4, 1], [0.66 * Lc, 9.2, 1], [0.86 * Lc, 8.6, 1], [0.98 * Lc, 6.0, 1], [1.04 * Lc, 3.0]], Ft, P, { steps: 36 }), { tone: "mid", crease: "none" }), 0.6);
  const neckBase = add(s.chestTop, mul(s.torso, 1.2));
  put(add(neckBase, mul(s.headDir, 2.5)), S(G.solidOf([[0, 2.0], [SIZE.neck + 1.5, 1.8]], G.frameAlong(neckBase, s.headDir), P, { steps: 18 }), { tone: "mid", crease: "none" }), 0.7);
  const Fh = G.frameAlong(add(s.head, mul(s.headDir, -0.5 * SIZE.head)), s.headDir);
  put(s.head, S(G.solidOf([[0, 1.6], [0.8, 3.6, 1], [0.28 * SIZE.head, 5.0, 1], [0.6 * SIZE.head, 5.6, 1], [0.86 * SIZE.head, 4.4, 1], [SIZE.head, 1.2]], Fh, P, { steps: 32 }), { tone: "mid", crease: "none" }), 0.8);
  if (cg) {
    const c = cgOf(s);
    put(c, `<path class="iso-line ws-plumb" data-tone="lit" d="${k.pathOf([k.iso(c, P), k.iso([c[0], c[1], board.Zd + 0.4], P)])}"/>` + k.dotsSvg([k.iso(c, P)], { size: 0.9, tone: "hi" }), 5);
  }
  return items;
}
