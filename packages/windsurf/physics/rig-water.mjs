// Pure models of the rig on and over the water, for the pilot page:
//   F1  the rig floating flat, joined at the mast foot, swinging downwind like a weathervane;
//   F2  the uphaul load as the mast rises and the water drains off the sail;
//   F3  the flagging sail in the base position, steering the drifting board by rig tilt.
// No DOM. Angles in degrees at the interface, SI inside; geometry in model units where it meets the drawing.
import { C } from "./constants.mjs";
import { R, clamp, CE, CLEW, MAST_FOOT, MAST_TOP, SAIL, AREA_M2, UNIT_M, frameFrom } from "./sail.mjs";
import { HEIGHTS, onHull } from "./hull.mjs";
import { yaw } from "./board.mjs";
import { uphaulPosture, backMoment } from "./sailor.mjs";

export const wrap = (a) => ((((a + 180) % 360) + 360) % 360) - 180;
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

// Heading h: degrees off the true wind, 0 = nose into the wind, 90 = across it with the wind on the
// starboard side, 180 = nose downwind, 270 = across it on the other side. In board axes the wind blows along
export const downwind = (h) => [-Math.cos(h * R), Math.sin(h * R), 0];
// and downwind lies at this angle from the nose (+ toward port):
export const downwindAngle = (h) => wrap(180 - h);
export const windPressure = () => 0.5 * C.rho * C.wind * C.wind;

// ----------------------------------------------------------------------------------------------------
// F1 · the rig floating flat
// The rig is a rigid flat body hinged at the mast foot. rho is the mast's direction measured from
// straight downwind (world frame, + turning toward the board's port side when the board heads 90°).
// The wind's drag on the parts it can reach acts along the mast and turns the rig downwind; the water
// damps the swing. Where the rig would cross the hull it rests on the deck, tipped up, and the wet
// sail's friction on the deck can hold it there.

export const T_BAND = 10;               // degrees either side of square that count as the T-position

// The angle of the rig's mast from the nose, given the board heading and rho.
export const rigToBoard = (h, rho) => wrap(downwindAngle(h) + rho);

// The rig frame lying flat at board angle phi (degrees from the nose, + to port), tipped down toward
// its tip by `slope` (radians, negative = tip lower). The sail lies on the side the boom points to:
// square to the mast, a quarter turn anticlockwise seen from above (toward the tail in the T-position).
export function flatFrame(phi, slope) {
  const a = phi * R;
  const m = [Math.cos(a) * Math.cos(slope), Math.sin(a) * Math.cos(slope), Math.sin(slope)];
  const b = [-Math.sin(a), Math.cos(a), 0];
  return frameFrom(m, b, { phi, slope, lift: HEIGHTS.joint });
}

// Points of the sail and mast to test against the hull: a grid inside the outline and along the mast.
const GRID = (() => {
  const pts = [];
  for (let u = 8; u <= MAST_TOP; u += 4) pts.push([u, 0, 1.6]);
  const vAt = (u) => {
    let best = 0;
    for (let i = 0; i < SAIL.length - 1; i++) {
      const [u0, v0] = SAIL[i], [u1, v1] = SAIL[i + 1];
      if ((u - u0) * (u - u1) <= 0 && u1 !== u0) best = Math.max(best, v0 + ((v1 - v0) * (u - u0)) / (u1 - u0));
    }
    return best;
  };
  for (let u = SAIL[0][0]; u <= MAST_TOP; u += 4) for (let v = 4; v < vAt(u); v += 5) pts.push([u, v, 0.6]);
  return pts;
})();

// How the rig lies at board angle phi: the slope that keeps every part above the deck where it is over
// the hull, and above the water elsewhere (the tip rests on the water when nothing holds it up).
function lieAt(phi) {
  const rest = Math.asin(-HEIGHTS.joint / MAST_TOP);
  let need = rest, contact = 0;
  const a = phi * R, c = Math.cos(a), s = Math.sin(a);
  for (const [u, v, clear] of GRID) {
    const x = MAST_FOOT + u * c - v * s, y = u * s + v * c;
    if (!onHull([x, y])) continue;
    const z = HEIGHTS.deck + clear - HEIGHTS.joint;            // the most this point may drop below the joint
    const e = Math.asin(clamp(z / u, -1, 1));
    if (e > need) { need = e; contact = u; }
  }
  return { slope: need, onDeck: need > rest + 1e-4, contact };
}
const LIE = Array.from({ length: 361 }, (_, i) => lieAt(i - 180));
export function rigLie(phi) {
  const x = wrap(phi) + 180, i = Math.floor(x), t = x - i;
  const A = LIE[i], B = LIE[Math.min(360, i + 1)];
  return { slope: A.slope + (B.slope - A.slope) * t, onDeck: t < 0.5 ? A.onDeck : B.onDeck, contact: t < 0.5 ? A.contact : B.contact };
}

// Wind moment turning the floating rig toward downwind, N·m (+ increases rho).
export const floatTorque = (rho) => -windPressure() * C.floatDragArea * C.floatDragLever * Math.sin(rho * R);
// The most friction the deck can hold the rig with, N·m.
export const deckHold = (contact) => C.deckFriction * C.rigMass * C.g * C.deckShare * Math.max(0.3, contact * UNIT_M);

export function floatInfo(h, rho, rate = 0) {
  const phi = rigToBoard(h, rho);
  const lie = rigLie(phi);
  const wind = floatTorque(rho);
  const hold = lie.onDeck ? deckHold(lie.contact) : 0;
  const stuck = lie.onDeck && Math.abs(rate) < 1e-3 && Math.abs(wind) <= hold;
  const board = Math.abs(wrap(h));                              // 0 nose to wind … 180 nose downwind
  const across = Math.abs(90 - board);
  const square = Math.abs(90 - Math.abs(phi));
  const t = across <= T_BAND && square <= T_BAND && Math.abs(rho) <= 2 * T_BAND;
  return { phi, rho, ...lie, wind, hold, stuck, board, across, square, tPosition: t, frame: flatFrame(phi, lie.slope) };
}

// One step of the floating rig. state: { heading, rho, rate (rad/s) }. Held rigs don't swing.
export function floatStep(state, dt, { held = false } = {}) {
  if (held) { state.rate = 0; return floatInfo(state.heading, state.rho, 0); }
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  for (let i = 0; i < n; i++) {
    const info = floatInfo(state.heading, state.rho, state.rate);
    let torque = info.wind - C.floatDamping * state.rate;
    if (info.onDeck) {
      if (Math.abs(state.rate) < 1e-3 && Math.abs(info.wind) <= info.hold) { state.rate = 0; continue; }
      torque -= Math.sign(state.rate || info.wind) * info.hold;
    }
    const before = state.rate;
    state.rate += (torque / C.floatInertia) * h;
    if (info.onDeck && before !== 0 && Math.sign(before) !== Math.sign(state.rate)) state.rate = 0;   // friction stops, never reverses
    state.rho = wrap(state.rho + (state.rate / R) * h);
  }
  return floatInfo(state.heading, state.rho, state.rate);
}

// ----------------------------------------------------------------------------------------------------
// F2 · uphaul load
// Moments about the mast foot in the rig's rising plane (x downwind from the foot, z up from the joint).
// The sailor drives the mast angle along a smooth (minimum-jerk) profile in the time the pull speed sets;
// the uphaul tension is what it takes: weight of the rig and of the water on the sail, both on their lever
// times cos θ, what the water still carries taken off, the rig's inertia, and the suction of the water.

export const BASE_ANGLE = C.baseMastAngle;
export const PULLS = { slow: C.pullSlow, steady: C.pullSteady, snatch: C.pullSnatch };

export const floatShare = (theta) => (theta < C.floatAngle ? (1 - theta / C.floatAngle) ** 2 : 0);   // carried by the water
export const wetShare = (theta) => Math.max(0, 1 - theta / C.dryAngle);                               // sail still in the water
export const attachAt = (theta) => [C.uphaulAt * Math.cos(theta * R), C.uphaulAt * Math.sin(theta * R)];

export function minJerk(t, T) {
  const x = clamp(t / T, 0, 1);
  return {
    s: x ** 3 * (10 - 15 * x + 6 * x * x),
    v: x >= 1 || x <= 0 ? 0 : (30 * x * x * (1 - x) ** 2) / T,
    a: x >= 1 || x <= 0 ? 0 : (60 * x * (1 - x) * (1 - 2 * x)) / (T * T),
  };
}

// The load at one instant. theta in degrees, omega and alpha in rad/s and rad/s², water in kg.
export function uphaulLoad({ theta, omega = 0, alpha = 0, water = C.waterLoad, style = "legs" }) {
  const g = C.g, th = theta * R;
  const lifted = 1 - floatShare(theta);
  const rig = C.rigMass * g * C.rigCg * Math.cos(th) * lifted;
  const wet = water * g * C.waterLever * Math.cos(th) * lifted;
  const inertia = (C.rigMass * (1.15 * C.rigCg) ** 2 + water * C.waterLever ** 2) * alpha;
  const suction = C.suction * Math.max(0, omega) * wetShare(theta);
  const moment = Math.max(0, rig + wet + inertia + suction);
  const A = attachAt(theta);
  const posture = uphaulPosture(style, theta / BASE_ANGLE, A);
  const m = [Math.cos(th), Math.sin(th)];
  const sinLine = Math.abs(m[0] * posture.dir[1] - m[1] * posture.dir[0]);
  const lever = C.uphaulAt * sinLine;                                   // the line's lever about the foot
  const tension = moment / Math.max(0.05, lever);
  const back = backMoment(posture, tension);
  return { theta, moment, parts: { rig, wet, inertia, suction }, lever, sinLine, tension, posture, back, attach: A };
}

export function uphaulStart({ style = "legs", pull = "slow" } = {}) {
  return { style, pull, t: 0, theta: 0, omega: 0, alpha: 0, water: C.waterLoad, tension: 0, peak: 0, peakAt: 0, backPeak: 0, done: false, trace: [] };
}

// Advance a pull by dt seconds; records a trace of [theta, tension] for the chart recorder.
export function uphaulStep(state, dt) {
  if (state.done) return state.load;
  const T = PULLS[state.pull] ?? PULLS.steady;
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  let load;
  for (let i = 0; i < n; i++) {
    state.t += h;
    const mj = minJerk(state.t, T);
    state.theta = BASE_ANGLE * mj.s;
    state.omega = BASE_ANGLE * R * mj.v;
    state.alpha = BASE_ANGLE * R * mj.a;
    state.water = Math.min(state.water * Math.exp(-h / C.drainTime), C.waterLoad * wetShare(state.theta));
    load = uphaulLoad(state);
    state.tension = load.tension;
    if (load.tension > state.peak) { state.peak = load.tension; state.peakAt = state.theta; }
    state.backPeak = Math.max(state.backPeak, load.back.moment);
    const last = state.trace[state.trace.length - 1];
    if (!last || state.theta - last[0] >= 0.5 || Math.abs(load.tension - last[1]) > 6) state.trace.push([state.theta, load.tension]);
    if (state.t >= T) { state.done = true; break; }
  }
  state.load = load;
  return load;
}

// The whole pull at once (for tests and the build).
export function uphaulRun(options, dt = 1 / 120) {
  const s = uphaulStart(options);
  while (!s.done) uphaulStep(s, dt);
  return s;
}

// ----------------------------------------------------------------------------------------------------
// F3 · base position: the sail flagging downwind, steering by tilt
// The mast leans downwind at BASE_ANGLE above the water; tilt (degrees, + toward the nose) leans it
// fore or aft. The flagging sail lines up with the wind, so its drag acts downwind at its centre of
// effort, and turns the board about the centreboard (the CLR) by its lever across the wind.

export function baseFrame(h, tilt) {
  const d = downwind(h);
  const e = BASE_ANGLE * R, t = Math.sin(clamp(tilt, -90, 90) * R);
  const m = unit([Math.cos(e) * d[0] + t, Math.cos(e) * d[1], Math.sin(e)]);
  const dm = d[0] * m[0] + d[1] * m[1];
  const b = unit([d[0] - dm * m[0], d[1] - dm * m[1], -dm * m[2]]);   // the boom hangs downwind, square to the mast
  return frameFrom(m, b, { tilt, heading: h, lift: HEIGHTS.joint });
}

export const flagDrag = () => windPressure() * AREA_M2 * C.flagDrag;

// Height of the clew above the water in the base position, model units (negative = in the water).
export function clewHeight(h = 90, tilt = 0) {
  const f = baseFrame(h, tilt);
  return f.at(CLEW[0], CLEW[1])[2] + HEIGHTS.joint;
}

export function baseSolve(h, tilt) {
  const rig = baseFrame(h, tilt);
  const ce = rig.at(CE.u, CE.v);                 // model units from the CLR
  const d = downwind(h);
  const drag = flagDrag();
  const F = [drag * d[0], drag * d[1]];
  const rx = ce[0] * UNIT_M, ry = ce[1] * UNIT_M;
  const torque = rx * F[1] - ry * F[0];         // + turns the nose to port
  // the lever: how far the line of the push passes ahead of the CLR, measured across the wind
  const lever = rx * d[1] - ry * d[0];
  const clew = clewHeight(h, tilt);
  return { heading: h, tilt, rig, ce, drag, F, torque, lever, clew, clewWet: clew <= 0 };
}

// Turning toward the nose (bearing away when the board is across the wind) is a rate of heading change
// whose sign depends on the side: report it as "away from the wind" (+) or "toward it" (-).
export const awayFromWind = (h, rate) => (Math.sin(h * R) >= 0 ? rate : -rate);

export function baseStep(state, tilt, dt) {
  return yaw(
    state,
    (heading) => baseSolve(heading, tilt),
    (_, s) => C.driftDamping + (s.clewWet ? C.clewDamping : 0),
    C.baseInertia,
    dt,
  );
}
