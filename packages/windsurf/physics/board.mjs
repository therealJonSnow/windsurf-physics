// Pure model of the board: non-planing speed by heading, the sailing solve, and yaw about the CLR.
// From the steering demo's model.mjs. No DOM.
import { C } from "./constants.mjs";
import { R, clamp, CE, UNIT_CM, AREA_M2, SHEET, coefficients, rigFrame, heelFor } from "./sail.mjs";

// Board speed through the water as a share of the wind speed, by heading off the true wind
// (displacement speed, about 2 m/s on a reach in 8 knots).
export function speedShare(heading) {
  const t = clamp((heading - 22) / 26, 0, 1);
  return (0.24 + 0.28 * Math.sin(heading * R)) * t * t * (3 - 2 * t);
}

// heading: degrees off the true wind (0 head to wind, 180 dead run), starboard tack
// (wind over the starboard side, rig to port). rake: degrees, + forward. trim: degrees off the ideal sheet.
export function solve(heading, rake, trim = 0) {
  const W = C.wind;
  const th = heading * R;
  const share = speedShare(heading);
  const air = [-Math.cos(th) * W - share * W, Math.sin(th) * W];        // air relative to the board
  const speed = Math.hypot(air[0], air[1]);
  const flow = [air[0] / speed, air[1] / speed];
  const apparent = Math.atan2(flow[1], -flow[0]) / R;
  const sheet = clamp(apparent - C.alphaTrim + trim, SHEET[0], SHEET[1]);
  const heel = heelFor(sheet);
  const rig = rigFrame(rake, sheet, heel);
  const ce = rig.at(CE.u, CE.v);
  const bh = [rig.b[0], rig.b[1]], bl = Math.hypot(bh[0], bh[1]);
  const chord = [bh[0] / bl, bh[1] / bl];
  const cr = flow[0] * chord[1] - flow[1] * chord[0];
  const alpha = Math.acos(clamp(flow[0] * chord[0] + flow[1] * chord[1], -1, 1)) / R;
  const { lift, drag } = coefficients(alpha);
  const q = 0.5 * C.rho * speed * speed * AREA_M2 * Math.cos(rake * R) * Math.cos(heel * R);
  const liftDir = [flow[1] * Math.sign(cr || 1), -flow[0] * Math.sign(cr || 1)];
  const F = [q * (lift * liftDir[0] + drag * flow[0]), q * (lift * liftDir[1] + drag * flow[1])];
  const rx = (ce[0] / 100) * UNIT_CM, ry = (ce[1] / 100) * UNIT_CM;   // metres from the CLR
  const torque = rx * F[1] - ry * F[0];                                // + turns the nose to port: bearing away
  const reach = speedShare(90) * W;
  return { heading, rake, trim, sheet, heel, alpha, apparent, speed, boat: share * W, reach, F, side: F[1], drive: F[0], lever: rx, torque, ce, rig, flow };
}

export const STOPS = [28, 172];         // the steering demo's pivot end stops, degrees off the wind

// Yaw about the CLR: I·ψ'' = torque − damping·ψ', sub-stepped at 240 Hz. Mutates `state` {heading, rate}.
export function yaw(state, torqueOf, dampingOf, inertia, dt) {
  const n = Math.max(1, Math.ceil(dt / (1 / 240)));
  const h = dt / n;
  let last;
  for (let i = 0; i < n; i++) {
    last = torqueOf(state.heading);
    const torque = typeof last === "number" ? last : last.torque;
    const damping = dampingOf(state.heading, last);
    state.rate += (torque / inertia - (damping / inertia) * state.rate) * h;
    state.heading += (state.rate / R) * h;
  }
  return last;
}

// The steering demo's step: sailing, with rubber end stops.
export function step(state, rake, dt, trim = 0) {
  return yaw(
    state,
    (heading) => {
      const s = solve(heading, rake, trim);
      const over = heading < STOPS[0] ? STOPS[0] - heading : heading > STOPS[1] ? STOPS[1] - heading : 0;
      return { ...s, torque: s.torque + over * 60 };
    },
    (_, s) => C.yawDamping * (0.25 + 0.75 * s.boat / s.reach),
    C.sailInertia,
    dt,
  );
}
