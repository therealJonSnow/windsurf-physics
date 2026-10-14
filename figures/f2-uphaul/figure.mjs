// F2 · Uphaul load. The board lies across the wind in a pool; the mannequin stands either side of the
// mast foot and pulls the rig up by the uphaul, with a newton meter spliced into the line and a chart
// recorder on the bench tracing the tension against the mast angle.
import { k, G } from "../../packages/windsurf/kit.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { BASE_ANGLE, uphaulLoad } from "../../packages/windsurf/physics/rig-water.mjs";
import { MAST_FOOT, UNIT_M, frameFrom } from "../../packages/windsurf/physics/sail.mjs";
import { makeBoard, drawRig, assemble, boardProjection } from "../../packages/windsurf/rig.mjs";
import { makeTank, makeFan, makeTelltale, makeRecorder, bench, newtonMeter } from "../../packages/windsurf/bench.mjs";
import { skeleton, poseUphaul, drawMannequin } from "../../packages/windsurf/mannequin.mjs";

export const WIDTH = 640, HEIGHT = 400;
export const WIND_TO = 0;
export const WIND = [1, 0, 0];
export const HEADING = 90;                                           // the board lies across the wind
export const FOOT_AT = [-62, 0, 0];                                  // where the mast foot sits in the pool
export const TANK = makeTank({ R: 212, Zr: 18, Zw: 16.6, wall: 5, ring: true });
export const BOARD = makeBoard({ Zw: TANK.Zw });
export const FAN = makeFan({ C: [-TANK.R - 20, -TANK.R + 70, 58], dir: WIND, r: 34 });
export const TELL = makeTelltale({ at: [TANK.R - 6, -TANK.R + 10], top: 74, dir: WIND });
export const PLATE = { x: -TANK.R - 52, y: -TANK.R - 24, w: 2 * TANK.R + 80, d: 2 * TANK.R + 104, r: 14 };
export const RECORDER = makeRecorder({ plan: { x: -40, y: TANK.R + 10, w: 150, d: 50, r: 3 }, xMax: 70, yMax: 600, target: C.uphaulTarget });
export const METER_MAX = 600;
export const AZIMUTH = 58;
export const yawOf = (heading) => WIND_TO + 180 + heading;
export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), [FAN.C[0], FAN.C[1], FAN.C[2] + FAN.r + 6], [FOOT_AT[0] + 251 * Math.cos((BASE_ANGLE * Math.PI) / 180), 0, BOARD.ZF + 251 * Math.sin((BASE_ANGLE * Math.PI) / 180) + 6]],
  WIDTH,
  HEIGHT,
  { pad: 20, azimuth: AZIMUTH, elevation: 28 },
);
export const Pb = boardProjection(P, yawOf(HEADING), [MAST_FOOT, 0, 0], FOOT_AT);
export const D = [0, 1, 0];                                          // downwind in the board frame at 90°

export function staticBack() {
  return [bench(P, PLATE, { label: { x: PLATE.x + 16, y: PLATE.y + PLATE.d - 50, w: 40, d: 20, r: 2 } }), FAN.stand(P), FAN.housing(P, { side: "back" })].join("");
}
export function staticMid() {
  return [FAN.housing(P, { side: "front" }), TANK.back(P), TANK.rimRing(P, [-1, 0, 0])].join("");
}
export function staticFront() {
  return [TANK.front(P), TELL.post(P), RECORDER.body(P)].join("");
}

// The rig at mast angle theta: the mast rises in the plane of the wind; the sail turns about the mast
// from lying flat (boom toward the tail) to hanging downwind, square to the mast, as it comes clear.
export function uphaulFrame(theta) {
  const th = (theta * Math.PI) / 180;
  const q = Math.min(1, Math.max(0, theta / BASE_ANGLE));
  const psi = (Math.PI / 2) * q * q * (3 - 2 * q);
  const m = [0, Math.cos(th), Math.sin(th)];
  const b = [-Math.cos(psi), Math.sin(psi) * Math.sin(th), -Math.sin(psi) * Math.cos(th)];
  return frameFrom(m, b, { theta });
}

// Rising-plane metres (x downwind of the foot, z up from the joint) to the board frame.
export const plane = ([x, z], s = 0) => [MAST_FOOT + s, x / UNIT_M, BOARD.ZF + z / UNIT_M];

// The whole moving scene: board, rig, sailor, meter and the lever from the lower back.
export function scene({ theta, water, tension, style, lever = false, litLever = false }) {
  const load = uphaulLoad({ theta, water, style });
  const posture = load.posture;
  const pose = poseUphaul(posture, D, BOARD);
  const sk = skeleton(pose.spec);
  const frame = uphaulFrame(theta);
  const meter = (a, b, P) => newtonMeter(a, b, P, { force: tension, max: METER_MAX });
  const rig = drawRig(Pb, frame, BOARD, { camber: 0, water: TANK.Zw, uphaul: { hands: pose.grip }, meter, wet: water / C.waterLoad, litCe: false });
  const items = drawMannequin(Pb, sk, { board: BOARD });
  if (lever) {
    // the lever about the lower back: from the lower back square to the line of pull
    const { lumbar, hands, dir } = posture;
    const t = (lumbar[0] - hands[0]) * dir[0] + (lumbar[1] - hands[1]) * dir[1];
    const foot = [hands[0] + dir[0] * t, hands[1] + dir[1] * t];
    const a = plane(lumbar), b = plane(foot);
    const tone = litLever ? "lit" : "mid";
    items.push({ mid: G.add3(G.lerp3(a, b, 0.5), [0, 0, 0]), bias: 8, front: true, svg: `<path class="iso-line ws-lever" data-tone="${tone}" d="${k.pathOf([k.iso(a, Pb), k.iso(b, Pb)])}"/>` + k.dotsSvg([k.iso(a, Pb), k.iso(b, Pb)], { size: 0.8, tone: litLever ? "hi" : "mid" }) });
  }
  return { svg: assemble(Pb, BOARD, rig, items), load, skeleton: sk };
}
