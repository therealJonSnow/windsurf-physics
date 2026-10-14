// F3 · Base position steering. The board floats in a round tank on a pivot at its centreboard (the CLR),
// the rig is up with the sail flagging downwind, the sailor holds the mast. Tilting the rig toward the
// nose or the tail moves the sail's push ahead of or behind the centreboard and turns the board.
// Shared by the build (static art) and the page (moving parts).
import { k, G } from "../../packages/windsurf/kit.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { baseSolve, baseFrame, downwind } from "../../packages/windsurf/physics/rig-water.mjs";
import { makeBoard, drawRig, assemble, boardProjection } from "../../packages/windsurf/rig.mjs";
import { makeTank, makeFan, makeTelltale, makeConsole, bench } from "../../packages/windsurf/bench.mjs";
import { skeleton, poseBase, drawMannequin } from "../../packages/windsurf/mannequin.mjs";

export const WIDTH = 640, HEIGHT = 560;
export const WIND_TO = 0;                                           // world direction the wind blows toward: across the view at 45°, so both the
                                                                    // flagging sail and the board's fore-and-aft tilt read
export const WIND = [Math.cos((WIND_TO * Math.PI) / 180), Math.sin((WIND_TO * Math.PI) / 180), 0];
export const TANK = makeTank({ R: 112, Zr: 18, Zw: 16.6, wall: 4, ring: true });
export const BOARD = makeBoard({ Zw: TANK.Zw });
export const FAN = makeFan({ C: [-(TANK.R + 44) * WIND[0], -(TANK.R + 44) * WIND[1] - 40, 58], dir: WIND, r: 34 });
export const TELL = makeTelltale({ at: [-128, 112], top: 74, dir: WIND });
export const CONSOLE = makeConsole({
  plan: { x: 50, y: 108, w: 74, d: 26, r: 5 },
  h: 12,
  knobs: [{ c: [106, 121], r: 6.4 }],
  gauge: { c: [74, 121], r: 11.5, z: 20 },
});
export const PLATE = { x: -205, y: -150, w: 345, d: 300, r: 12 };
export const MOMENT_MAX = 15;                                       // N·m at full gauge swing
export const TILT_MAX = C.tiltMax;
export const yawOf = (heading) => WIND_TO + 180 + heading;           // board yaw for a heading off the wind

// every place the mast top and clew can reach, in world coordinates, as the board turns and the rig tilts
const reach = [];
for (let h = 0; h < 360; h += 15)
  for (const tilt of [-C.tiltMax, 0, C.tiltMax]) {
    const f = baseFrame(h, tilt), a = ((WIND_TO + 180 + h) * Math.PI) / 180;
    for (const [u, v] of [[255, 0], [72, 104]]) {
      const [x, y, z] = f.at(u, v, 0);
      reach.push([x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z + BOARD.ZF]);
    }
  }
export const P = k.fitProjection(
  [...k.boxCorners(PLATE, -17, 0), ...reach, [FAN.C[0], FAN.C[1], FAN.C[2] + FAN.r + 6]],
  WIDTH,
  HEIGHT,
  { pad: 22, azimuth: 45, elevation: 30 },
);

export function staticBack() {
  return [
    bench(P, PLATE, { label: { x: -188, y: 70, w: 40, d: 20, r: 2 } }),
    FAN.stand(P),
    FAN.housing(P, { side: "back" }),
  ].join("");
}
export function staticMid() {
  return [FAN.housing(P, { side: "front" }), TANK.back(P), TANK.rimRing(P, G.mul3(WIND, -1))].join("");
}
export function staticFront() {
  return [TANK.front(P), TELL.post(P), CONSOLE.body(P)].join("");
}

// The board, rig and sailor at a heading and tilt.
export function scene(heading, tilt) {
  const Pb = boardProjection(P, yawOf(heading));
  const s = baseSolve(heading, tilt);
  const rig = drawRig(Pb, s.rig, BOARD, { camber: 0, plumb: TANK.Zw + 4, water: TANK.Zw });
  const pose = poseBase(downwind(heading), s.rig, BOARD);
  const sk = skeleton(pose.spec);
  const items = drawMannequin(Pb, sk, { board: BOARD });
  return { svg: assemble(Pb, BOARD, rig, items), solve: s, skeleton: sk };
}

// A band on the rim ring at a heading: the target of a challenge.
export function targetMark(heading) {
  const a0 = ((WIND_TO + 180 + heading) * Math.PI) / 180;
  // the board's nose points along yaw; mark where the nose points on the rim
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = a0 + ((-4 + (8 * i) / 12) * Math.PI) / 180;
    pts.push(k.iso([Math.cos(a) * (TANK.R - 1.6), Math.sin(a) * (TANK.R - 1.6), TANK.Zr], P));
  }
  return k.pathOf(pts);
}
