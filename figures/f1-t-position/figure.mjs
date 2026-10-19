// F1 · T-position weathervane. A board floats in a wide pool, its rig lying flat on the water, joined at
// the mast foot. The wind from the fan swings the rig downwind about the mast foot like a weathervane,
// so the only start that stays put is the board across the wind with the rig downwind, square to it.
import { k, G } from "../../packages/windsurf/kit.mjs";
import { floatInfo } from "../../packages/windsurf/physics/rig-water.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { uphaulPosture } from "../../packages/windsurf/physics/sailor.mjs";
import { skeleton, poseUphaul, drawMannequin } from "../../packages/windsurf/mannequin.mjs";
import { MAST_FOOT } from "../../packages/windsurf/physics/sail.mjs";
import { makeBoard, drawRig, assemble, boardProjection } from "../../packages/windsurf/rig.mjs";
import { makeTank, makeFan, makeTelltale, makeConsole, bench } from "../../packages/windsurf/bench.mjs";

export const WIDTH = 640, HEIGHT = 450;
export const WIND_TO = 0;                                           // the wind blows along +x: across the view
export const WIND = [1, 0, 0];
export const TANK = makeTank({ R: 272, Zr: 18, Zw: 16.6, wall: 5, ring: true });
export const BOARD = makeBoard({ Zw: TANK.Zw });
export const FAN = makeFan({ C: [-TANK.R - 22, -TANK.R + 64, 58], dir: WIND, r: 34 });
export const TELL = makeTelltale({ at: [TANK.R - 4, -TANK.R + 8], top: 74, dir: WIND });
export const PLATE = { x: -TANK.R - 52, y: -TANK.R - 24, w: 2 * TANK.R + 78, d: 2 * TANK.R + 48, r: 14 };
export const CONSOLE = makeConsole({
  plan: { x: TANK.R - 48, y: TANK.R - 34, w: 58, d: 26, r: 4 },
  h: 10,
  knobs: [{ c: [TANK.R - 34, TANK.R - 21], r: 6 }, { c: [TANK.R - 6, TANK.R - 21], r: 6 }],
});
export const ELEVATION = 40;
export const yawOf = (heading) => WIND_TO + 180 + heading;
export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), [FAN.C[0], FAN.C[1], FAN.C[2] + FAN.r + 6], [0, 0, 60]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: 45, elevation: ELEVATION },
);
const FOOT = [MAST_FOOT, 0, 0];
export const boardP = (heading) => boardProjection(P, yawOf(heading), FOOT, [0, 0, 0]);

export function staticBack() {
  return [bench(P, PLATE, { label: { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 50, w: 40, d: 20, r: 2 } }), FAN.stand(P), FAN.housing(P, { side: "back" })].join("");
}
export function staticMid() {
  return [FAN.housing(P, { side: "front" }), TANK.back(P), TANK.rimRing(P, [-1, 0, 0])].join("");
}
export function staticFront() {
  return [TANK.front(P), TELL.post(P), CONSOLE.body(P)].join("");
}

// The board and the floating rig. heading: degrees off the wind; rho: the rig's angle from downwind.
// The sailor squats at the mast foot, facing the rig, holding the uphaul ready to lift: F2's starting
// posture (legs bent, back straight, arms long along the line), turned to wherever the rig lies.
export function scene(heading, rho, rate = 0) {
  const Pb = boardP(heading);
  const info = floatInfo(heading, rho, rate);
  const m = info.frame.m, flat = Math.hypot(m[0], m[1]);
  const d = [m[0] / flat, m[1] / flat, 0];                         // the way the rig lies, level
  const attach = [C.uphaulAt * Math.cos(info.slope), C.uphaulAt * Math.sin(info.slope)];
  const pose = poseUphaul(uphaulPosture("legs", 0, attach), d, BOARD);
  const rig = drawRig(Pb, info.frame, BOARD, { camber: 0, water: TANK.Zw, litCe: false, uphaul: { hands: pose.grip } });
  const items = drawMannequin(Pb, skeleton(pose.spec), { board: BOARD });
  return { svg: assemble(Pb, BOARD, rig, items, { straps: true }), info };
}

// Screen point → world point on the water (z = Zw).
export function toWater([sx, sy]) {
  const a = (45 * Math.PI) / 180, e = (ELEVATION * Math.PI) / 180;
  const kk = P.scale * Math.sqrt(1.6);
  const A = (sx - P.origin[0]) / kk, B = ((sy - P.origin[1]) / kk + TANK.Zw * Math.cos(e)) / Math.sin(e);
  return [A * Math.sin(a) + B * Math.cos(a), -A * Math.cos(a) + B * Math.sin(a)];
}

// A band on the rim at a world angle (degrees from +x): the target of a challenge.
export function rimMark(angle, span = 10) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const a = ((angle - span / 2 + (span * i) / 16) * Math.PI) / 180;
    pts.push(k.iso([Math.cos(a) * (TANK.R - 2), Math.sin(a) * (TANK.R - 2), TANK.Zr], P));
  }
  return k.pathOf(pts);
}
