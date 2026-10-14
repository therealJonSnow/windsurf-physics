// The shared world: a bench plate on feet, a round tank of water, a fan behind it, a telltale on a post,
// a console with knobs and a dial gauge, a newton meter and a chart recorder. World frame, model units,
// z up from the bench top. Static parts return SVG strings at build time; the few moving parts (fan
// blades, pennant, needle, pointer, recorder pen and trace, meter slider) have their own functions so the
// page redraws only those.
import { k, G } from "./kit.mjs";

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
// The audit: when a recorder is set (build.mjs --audit), every static solid also records its true shape.
let REC = null;
export const recordInto = (rec) => { REC = rec; };
function Sx(paths, style, name, at, shape) {
  const svg = S(paths, style);
  if (REC) REC.R.put({ at, name: REC.R.nameFor(name), svg, shapes: [REC.R.solid(shape(REC.A))] });
  return svg;
}
const byDepth = (points, P) => [...points].sort((a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P));

// ---- bench plate on feet, with groove, screws, a ruler strip and a label plate ----
export function bench(P, PLATE, { label = null, H = 12, FOOT = 5 } = {}) {
  const at = (p) => k.iso(p, P);
  const out = [`<path class="iso-halo" d="${k.haloOf(PLATE, -H - FOOT, H, P)}"/>`];
  for (const [x, y] of byDepth(k.corners(PLATE, 26), P)) {
    out.push(Sx(k.cylinder(x, y, 8, -H - FOOT, 1.6, P, 28), { tone: "lo" }, "stand.foot", [x, y, -H - FOOT], (A) => A.cylinder(x, y, 8, -H - FOOT, 1.6, { name: "stand.foot" })));
    out.push(Sx(k.cylinder(x, y, 6.2, -H - FOOT + 1.6, FOOT - 1.6, P, 28), { tone: "mid" }, "stand.leg", [x, y, -H - 2], (A) => A.cylinder(x, y, 6.2, -H - FOOT + 1.6, FOOT - 1.6, { name: "stand.leg" })));
  }
  out.push(Sx(k.slabOf(PLATE, -H, H, P, 8, 1.6), { tone: "mid", inner: Ln(k.sideSeam(PLATE, -H + 3.2, P, 8), { tone: "faint" }) }, "bench.plate", [PLATE.x + PLATE.w / 2, PLATE.y + PLATE.d / 2, -H / 2], (A) => A.slab(PLATE, -H, H, { name: "bench.plate" })));
  out.push(Ln(k.planOutline(k.insetPlan(PLATE, 6), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 12);
  out.push(Ln(screws.map(([x, y]) => k.ring(x, y, 2.4, 0, P, 16)).join(""), { tone: "lo" }));
  out.push(Dt(screws.map(([x, y]) => at([x, y, 0])), { size: 0.5 }));
  // ruler strip along the near edge (toward the viewer)
  const strip = { x: PLATE.x + 30, y: PLATE.y + PLATE.d - 14, w: PLATE.w - 60, d: 6, r: 1 };
  out.push(Sx(k.slabOf(strip, 0, 0.6, P, 3), { tone: "lo", crease: "none" }, "bench.ruler", [strip.x + strip.w / 2, strip.y + strip.d / 2, 0.3], (A) => A.slab(strip, 0, 0.6, { name: "bench.ruler" }, 3)));
  const ticks = k.topTicks(strip.x + 4, strip.x + strip.w - 4, 5, 5, strip.y + 0.8, 0.6, [2, 3.4], P);
  out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
  out.push(Dt([at([strip.x + 2, strip.y + 3, 0.6]), at([strip.x + strip.w - 2, strip.y + 3, 0.6])], { size: 0.45 }));
  if (label) out.push(labelPlate(P, label));
  return out.join("");
}

export function labelPlate(P, plan, z = 0) {
  const at = (p) => k.iso(p, P);
  const out = [Sx(k.slabOf(plan, z, 0.8, P, 4), { tone: "mid", crease: "faint" }, "bench.label", [plan.x + plan.w / 2, plan.y + plan.d / 2, z], (A) => A.slab(plan, z, 0.8, { name: "bench.label" }, 4))];
  out.push(Ln(k.planOutline(k.insetPlan(plan, 1.6), z + 0.8, P, 4), { tone: "faint" }));
  const x0 = plan.x + 4, yMid = plan.y + plan.d / 2;
  [[0.7, -2.6], [0.5, 0], [0.62, 2.6]].forEach(([share, dy]) => out.push(Ln(k.lineOnTop([x0, yMid + dy], [x0 + (plan.w - 8) * share, yMid + dy], z + 0.8, P), { tone: "lo", free: true })));
  out.push(Dt([at([plan.x + plan.w - 3, plan.y + 3, z + 0.8]), at([plan.x + plan.w - 3, plan.y + plan.d - 3, z + 0.8])], { size: 0.45 }));
  return out.join("");
}

// ---- round tank of water ----
// R: outer radius; Zb: base height; Zr: rim; Zw: water. Back half (with water) and front lip separately,
// so the board can float between them. The rim carries a degree ring (0 straight upwind).
export function makeTank({ R, Zb = 0, Zr, Zw, wall = 4, ring = null }) {
  const F = G.frameOf([0, 0, 0], [0, 0, 1], [1, 0, 0], [0, 1, 0]);
  function back(P) {
    const at = (p) => k.iso(p, P);
    const out = [];
    out.push(`<path class="iso-halo" d="${S(k.cylinder(0, 0, R + 2, Zb, 2, P, 96), {}).match(/class="iso-fill" d="([^"]+)"/)[1]}"/>`);
    // plinth, wall, and a band near the top
    out.push(Sx(k.cylinder(0, 0, R + 3, Zb, 3, P, 120, 0.6), { tone: "lo" }, "tank.plinth", [0, 0, Zb], (A) => A.cylinder(0, 0, R + 3, Zb, 3, { name: "tank.plinth" })));
    out.push(Sx(k.cylinder(0, 0, R, Zb + 3, Zr - Zb - 3, P, 120, 0.8), { tone: "mid", inner: Ln(k.sideArc(0, 0, R, Zr - 4, P, 96), { tone: "faint" }) + Ln(k.sideArc(0, 0, R, Zb + 7, P, 96), { tone: "faint" }) }, "tank.wall", [0, 0, Zb + 3], (A) => A.cylinder(0, 0, R, Zb + 3, Zr - Zb - 3, { name: "tank.wall" })));
    // the inside: the far inner wall above the water, then the water
    const inner = R - wall;
    out.push(`<path class="ws-inner" d="${k.pathOf(k.circleRing(0, 0, inner, 120).map(([x, y]) => at([x, y, Zr])), true)}"/>`);
    out.push(`<path class="ws-water" d="${k.pathOf(k.circleRing(0, 0, inner, 120).map(([x, y]) => at([x, y, Zw])), true)}"/>`);
    out.push(Ln(k.ring(0, 0, inner, Zw, P, 120), { tone: "faint" }));
    out.push(Ln(k.ring(0, 0, inner, Zr, P, 120), { tone: "lo" }));
    // bolts round the rim
    const bolts = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2 + 0.13;
      bolts.push(at([Math.cos(a) * (R - wall / 2), Math.sin(a) * (R - wall / 2), Zr]));
    }
    out.push(Dt(bolts, { size: 0.45, tone: "mid" }));
    // a drain valve on the side, toward the viewer
    return out.join("");
  }
  // degree ring on the rim: ticks every 10°, majors every 30°, zero where the wind comes from
  function rimRing(P, windFrom) {
    if (!ring) return "";
    const inner = R - wall;
    const from = Math.atan2(windFrom[0], -windFrom[1]);   // radialTicks: angle 0 points to -y, clockwise
    const t = k.radialTicks(0, 0, R - 0.4, 36, 3, Zr, [1.4, 2.6], P, from);
    return Ln(t.minor, { tone: "lo" }) + Ln(t.major, { tone: "mid" }) + Ln(k.ring(0, 0, inner + 0.6, Zr, P, 120), { tone: "faint" });
  }
  // front lip: the near half of the wall between the water and the rim, drawn after what floats
  function front(P) {
    const V = G.viewOf(P);
    const inner = R - wall;
    const a0 = Math.atan2(V[1], V[0]);
    const arc = [];
    for (let i = 0; i <= 64; i++) {
      const a = a0 - Math.PI / 2 + (Math.PI * i) / 64;
      arc.push([Math.cos(a), Math.sin(a)]);
    }
    const at = (p) => k.iso(p, P);
    const top = arc.map(([c, s]) => at([c * R, s * R, Zr]));
    const topIn = arc.map(([c, s]) => at([c * inner, s * inner, Zr]));
    const waterIn = arc.map(([c, s]) => at([c * inner, s * inner, Zw]));
    const out = [];
    // the inner face of the near wall is hidden by the water; only the rim top shows over what floats
    out.push(`<path class="iso-top" d="${k.pathOf([...top, ...topIn.slice().reverse()], true)}"/>`);
    out.push(`<path class="iso-shade" data-shade="1" d="${k.pathOf([...topIn, ...waterIn.slice().reverse()], true)}" style="opacity:0"/>`);
    out.push(Ln(k.pathOf(topIn), { tone: "lo" }));
    out.push(Ln(k.pathOf(top), { tone: "mid" }));
    return out.join("");
  }
  return { R, Zb, Zr, Zw, back, front, rimRing, inner: R - wall };
}

// ---- the fan: housing, guard, motor, stand; blades turn ----
// C: centre of the rotor, dir: the way it blows (unit, horizontal), r: rotor radius.
export function makeFan({ C, dir, r = 37, floor = 0 }) {
  const perp = [-dir[1], dir[0], 0];
  const FF = G.frameOf(C, dir, perp, [0, 0, 1]);
  function stand(P) {
    const at = (p) => k.iso(p, P);
    const out = [];
    const base = { x: C[0] - 16, y: C[1] - 16, w: 32, d: 32, r: 6 };
    out.push(Sx(k.cylinder(C[0], C[1], 18, floor, 3, P, 48, 0.6), { tone: "lo" }, "fan.base", [C[0], C[1], floor], (A) => A.cylinder(C[0], C[1], 18, floor, 3, { name: "fan.base" })));
    out.push(Sx(k.cylinder(C[0], C[1], 6, floor + 3, 2.2, P, 32), { tone: "mid" }, "fan.collar", [C[0], C[1], floor + 3], (A) => A.cylinder(C[0], C[1], 6, floor + 3, 2.2, { name: "fan.collar" })));
    out.push(Sx(k.cylinder(C[0], C[1], 2.6, floor + 5.2, C[2] - r - 6 - floor - 5.2, P, 24), { tone: "mid", crease: "none" }, "fan.post", [C[0], C[1], (floor + C[2] - r) / 2], (A) => A.cylinder(C[0], C[1], 2.6, floor + 5.2, C[2] - r - 6 - floor - 5.2, { name: "fan.post" })));
    out.push(Dt(k.corners({ x: C[0] - 12, y: C[1] - 12, w: 24, d: 24 }, 0).map(([x, y]) => at([x, y, floor + 3])), { size: 0.45 }));
    // yoke under the housing
    const yoke = G.frameAlong([C[0], C[1], C[2] - r - 6], [0, 0, 1]);
    out.push(Sx(G.disc(0, 1.5, 4.2, yoke, P), { tone: "mid", crease: "lo" }, "fan.yoke", yoke.o, (A) => A.disc(yoke, 0, 1.5, 4.2, { name: "fan.yoke" })));
    return out.join("");
  }
  function housing(P, { side = "back" } = {}) {
    const out = [];
    // back guard and motor pod (behind the blades), or front guard (in front)
    if (side === "back") {
      // the guard's spokes run from inside the motor pod (which hides their roots) to the housing ring
      out.push(Sx(G.ringBand(-7, 6, r + 1.5, r + 4.5, FF, P), { tone: "mid", crease: "lo" }, "fan.housing", C, (A) => A.ring(FF, -7, 6, r + 1.5, r + 4.5, { name: "fan.housing", owner: "fan" })));
      out.push(Ln(G.spokesOf(FF, -7, 4, r + 1.5, 10, P), { tone: "faint" }));
      out.push(Ln(G.circleOf(FF, -7, r * 0.55, P) + G.circleOf(FF, -7, r * 0.85, P) + G.circleOf(FF, -7, r + 1.5, P), { tone: "faint" }));
      if (REC) REC.R.put({ at: G.pointOf(FF, -7, 0, 0), name: "fan.guard.back", svg: out.slice(-2).join(""), shapes: [REC.R.solid(REC.A.disc(FF, -7.2, -6.8, r + 1.5, { name: "fan.guard.back", owner: "fan" }))] });
      out.push(Sx(G.solidOf([[-6.8, 3.5], [-6.2, 7.2, 1], [-4, 8.4, 1], [-1.2, 8.2], [-1.2, 5.5], [0.5, 5.5]], FF, P), { tone: "mid", crease: "lo" }, "fan.motor", G.pointOf(FF, -3, 0, 0), (A) => A.solid(FF, [[-6.8, 3.5], [-6.2, 7.2, 1], [-4, 8.4, 1], [-1.2, 8.2], [-1.2, 5.5], [0.5, 5.5]], { name: "fan.motor", owner: "fan" })));
    } else {
      out.push(Ln(G.spokesOf(FF, 6, 6, r + 1.5, 12, P), { tone: "lo" }));
      out.push(Ln(G.circleOf(FF, 6, r * 0.4, P) + G.circleOf(FF, 6, r * 0.7, P) + G.circleOf(FF, 6, r + 1.5, P), { tone: "lo" }));
      if (REC) REC.R.put({ at: G.pointOf(FF, 6, 0, 0), name: "fan.guard.front", svg: out.slice(-2).join(""), shapes: [REC.R.solid(REC.A.disc(FF, 5.8, 6.2, r + 1.5, { name: "fan.guard.front", owner: "fan" }))] });
      out.push(Sx(G.disc(6.2, 8, 5.5, FF, P), { tone: "mid", crease: "lo" }, "fan.hub", G.pointOf(FF, 7, 0, 0), (A) => A.disc(FF, 6.2, 8, 5.5, { name: "fan.hub", owner: "fan" })));
      out.push(Dt([k.iso(G.pointOf(FF, 8, 0, 0), P)], { size: 0.6, tone: "hi" }));
    }
    return out.join("");
  }
  function blades(P, turn) {
    const out = [];
    for (let i = 0; i < 5; i++) {
      const a = turn + (i * 2 * Math.PI) / 5;
      const pts = [];
      for (let j = 0; j <= 8; j++) pts.push(k.iso(G.pointOf(FF, 3.5, 7 + ((r - 4) * j) / 8, a - 0.2 + 0.1 * (j / 8)), P));
      for (let j = 8; j >= 0; j--) {
        const width = 0.36 + 0.18 * Math.sin((Math.PI * j) / 8);
        pts.push(k.iso(G.pointOf(FF, 1.5, 7 + ((r - 4) * j) / 8, a + width + 0.1 * (j / 8)), P));
      }
      out.push(`<path class="iso-shade" data-shade="2" d="${k.pathOf(pts, true)}"/><path class="iso-line" data-tone="lo" d="${k.pathOf(pts, true)}"/>`);
    }
    out.push(S(G.disc(1, 4.5, 6.5, FF, P), { tone: "mid", crease: "lo" }));
    return out.join("");
  }
  return { C, dir, r, FF, stand, housing, blades };
}

// ---- telltale: a post on a foot with a pennant that streams downwind ----
export function makeTelltale({ at, top, dir }) {
  const perp = [-dir[1], dir[0]];
  function post(P) {
    const out = [];
    out.push(Sx(k.cylinder(at[0], at[1], 7, 0, 2, P, 32, 0.4), { tone: "lo" }, "telltale.foot", [at[0], at[1], 0], (A) => A.cylinder(at[0], at[1], 7, 0, 2, { name: "telltale.foot" })));
    out.push(Sx(k.cylinder(at[0], at[1], 1.1, 2, top - 2, P, 16), { tone: "mid", crease: "none" }, "telltale.post", [at[0], at[1], top / 2], (A) => A.cylinder(at[0], at[1], 1.1, 2, top - 3.2, { name: "telltale.post" })));
    out.push(Sx(k.cylinder(at[0], at[1], 1.8, top - 1.2, 1.6, P, 16), { tone: "mid" }, "telltale.cap", [at[0], at[1], top], (A) => A.cylinder(at[0], at[1], 1.8, top - 1.2, 1.6, { name: "telltale.cap" })));
    return out.join("");
  }
  function pennant(P, time, gust = 1) {
    const [x, y] = at;
    const z0 = top - 1.2, z1 = top - 11;
    const length = 20;
    const upper = [], lower = [];
    for (let i = 0; i <= 10; i++) {
      const s = i / 10;
      const wave = Math.sin(time * 9 - s * 5.5) * 2.4 * s * gust;
      const drop = (1 - gust) * 6 * s * s;
      upper.push([x + dir[0] * length * s + perp[0] * wave, y + dir[1] * length * s + perp[1] * wave, z0 - s * 5 - drop]);
    }
    for (let i = 10; i >= 0; i--) {
      const s = i / 10;
      const wave = Math.sin(time * 9 - s * 5.5 - 0.6) * 2.4 * s * gust;
      const drop = (1 - gust) * 6 * s * s;
      lower.push([x + dir[0] * length * s + perp[0] * wave, y + dir[1] * length * s + perp[1] * wave, z1 + s * 5 - drop]);
    }
    return k.pathOf([...upper, ...lower].map((p) => k.iso(p, P)), true);
  }
  return { post, pennant };
}

// ---- console: a sloped-top box with knobs and a dial gauge ----
export function makeConsole({ plan, h = 14, knobs = [], gauge = null }) {
  function body(P) {
    const at = (p) => k.iso(p, P);
    const out = [Sx(k.slabOf(plan, 0, h, P, 6, 0.8), { tone: "mid", inner: Ln(k.sideSeam(plan, h - 3, P, 6), { tone: "faint" }) }, "console.body", [plan.x + plan.w / 2, plan.y + plan.d / 2, h / 2], (A) => A.slab(plan, 0, h, { name: "console.body" }, 6))];
    out.push(Ln(k.planOutline(k.insetPlan(plan, 3), h, P, 6), { tone: "faint" }));
    out.push(Dt(k.corners(plan, 3.2).map(([x, y]) => at([x, y, h])), { size: 0.45 }));
    for (const { c, r } of knobs) {
      out.push(Sx(k.cylinder(c[0], c[1], r + 2.2, h, 0.6, P, 32), { tone: "lo" }, "console.bezel", [c[0], c[1], h], (A) => A.cylinder(c[0], c[1], r + 2.2, h, 0.6, { name: "console.bezel" })));
      const t = k.radialTicks(c[0], c[1], r + 2.0, 12, 3, h + 0.6, [0.8, 1.6], P, (-135 * Math.PI) / 180, (270 * Math.PI) / 180);
      out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
      out.push(Sx(k.cylinder(c[0], c[1], r, h + 0.6, r * 0.62, P, 32), { tone: "mid" }, "console.knob", [c[0], c[1], h + 1], (A) => A.cylinder(c[0], c[1], r, h + 0.6, r * 0.62, { name: "console.knob" })));
      out.push(Ln(k.knurl(c[0], c[1], r, h + 0.6, h + 0.6 + r * 0.62, 30, P), { tone: "lo" }));
    }
    if (gauge) {
      const { c, r, z } = gauge;
      out.push(Sx(k.cylinder(c[0], c[1], r, h, z - h, P, 64, 0.8), { tone: "hi", crease: "lo" }, "console.gauge", [c[0], c[1], h], (A) => A.cylinder(c[0], c[1], r, h, z - h, { name: "console.gauge" })));
      out.push(Ln(k.ring(c[0], c[1], r - 2.2, z, P, 64), { tone: "lo" }));
      const t = k.radialTicks(c[0], c[1], r - 2.6, 24, 4, z, [1.1, 2.4], P, (-120 * Math.PI) / 180, (240 * Math.PI) / 180);
      out.push(Ln(t.minor, { tone: "lo" }), Ln(t.major, { tone: "mid" }));
      out.push(Ln(k.lineOnTop([c[0], c[1] - (r - 2.6)], [c[0], c[1] - (r - 5.6)], z, P), { tone: "hi" }));
      out.push(Ln(k.ring(c[0], c[1], 1.6, z, P, 16), { tone: "mid" }));
    }
    return out.join("");
  }
  // a pointer on a knob top at share -1..1 of its 270° swing
  function pointer(P, i, share) {
    const { c, r } = knobs[i];
    const a = (share * 135 * Math.PI) / 180;
    const z = h + 0.6 + r * 0.62;
    return k.lineOnTop([c[0] + Math.sin(a) * r * 0.15, c[1] - Math.cos(a) * r * 0.15], [c[0] + Math.sin(a) * r * 0.8, c[1] - Math.cos(a) * r * 0.8], z, P);
  }
  // a gauge needle at share -1..1 of its 240° swing
  function needle(P, share) {
    const { c, r, z } = gauge;
    const a = (Math.max(-1, Math.min(1, share)) * 120 * Math.PI) / 180;
    return k.lineOnTop([c[0] - Math.sin(a) * 2.6, c[1] + Math.cos(a) * 2.6], [c[0] + Math.sin(a) * (r - 3.4), c[1] - Math.cos(a) * (r - 3.4)], z + 0.2, P);
  }
  return { plan, h, knobs, gauge, body, pointer, needle };
}

// ---- newton meter (spring balance), spliced into a line from eye a to hook b ----
// A tube with a slotted scale; the lit slider rides down the slot with the force. Returns { svg, mid }.
export function newtonMeter(a, b, P, { force = 0, max = 600, lit = true } = {}) {
  const at = (p) => k.iso(p, P);
  const L = G.len3(G.sub3(b, a));
  const F = G.frameAlong(a, G.unit3(G.sub3(b, a)));
  const out = [];
  const V = G.viewOf(P);
  const face = G.angleToward(F, V);
  // eye, end caps, tube, hook
  out.push(S(G.disc(0, 1.6, 1.1, F, P, { steps: 16 }), { tone: "mid", crease: "none" }));
  out.push(S(G.solidOf([[1.6, 1.6], [2.6, 2.6], [L - 2.6, 2.6], [L - 1.6, 1.6]], F, P, { steps: 28 }), { tone: "mid", crease: "lo", inner: Ln(G.arcOf(F, 3.6, 2.6, P), { tone: "faint" }) + Ln(G.arcOf(F, L - 3.6, 2.6, P), { tone: "faint" }) }));
  // scale ticks along the side facing us, hanging from a slot edge
  const s0 = 4.6, s1 = L - 4.6;
  const slot = [at(G.pointOf(F, s0, 2.62, face - 0.28)), at(G.pointOf(F, s1, 2.62, face - 0.28)), at(G.pointOf(F, s1, 2.62, face + 0.28)), at(G.pointOf(F, s0, 2.62, face + 0.28))];
  out.push(Ln(k.pathOf(slot, true), { tone: "lo" }));
  const ticks = [];
  for (let i = 0; i <= 12; i++) {
    const s = s0 + ((s1 - s0) * i) / 12;
    const len = i % 4 === 0 ? 0.62 : 0.45;
    ticks.push(k.pathOf([at(G.pointOf(F, s, 2.62, face + 0.28)), at(G.pointOf(F, s, 2.62, face + 0.28 + len))]));
  }
  out.push(Ln(ticks.join(""), { tone: "lo" }));
  // the slider, lit: where it sits along the slot is the force
  const share = Math.max(0, Math.min(1, force / max));
  const sAt = s0 + 0.6 + (s1 - s0 - 1.2) * share;
  out.push(Ln(k.pathOf([at(G.pointOf(F, sAt, 2.62, face - 0.28)), at(G.pointOf(F, sAt, 2.62, face + 0.28))]), { tone: lit ? "lit" : "hi" }).replace("<path", '<path style="stroke-width:1.6"'));
  out.push(S(G.disc(L - 1.6, L, 1.1, F, P, { steps: 16 }), { tone: "mid", crease: "none" }));
  return { svg: out.join(""), mid: G.lerp3(a, b, 0.5), share };
}

// ---- chart recorder: a paper strip on rollers, a pen on a rail ----
// plan: footprint on the bench. x across the paper is the mast angle, y along it the tension.
export function makeRecorder({ plan, z = 0, h = 6, xMax = 70, yMax = 600, target = null }) {
  const paper = { x: plan.x + 10, y: plan.y + 5, w: plan.w - 20, d: plan.d - 10, r: 1 };
  const zt = z + h + 0.6;
  const toPaper = (theta, tension) => [paper.x + 4 + (paper.w - 8) * Math.max(0, Math.min(1, theta / xMax)), paper.y + paper.d - 3 - (paper.d - 6) * Math.max(0, Math.min(1, tension / yMax))];
  function body(P) {
    const at = (p) => k.iso(p, P);
    const out = [Sx(k.slabOf(plan, z, h, P, 5, 0.6), { tone: "mid", inner: Ln(k.sideSeam(plan, z + 2, P, 5), { tone: "faint" }) }, "recorder.body", [plan.x + plan.w / 2, plan.y + plan.d / 2, z + h / 2], (A) => A.slab(plan, z, h, { name: "recorder.body" }, 5))];
    // rollers at both ends of the paper
    for (const x of [plan.x + 6.2, plan.x + plan.w - 6.2]) {
      const F = G.frameOf([x, plan.y + 2, z + h + 2.2], [0, 1, 0], [1, 0, 0], [0, 0, 1]);
      out.push(Sx(G.disc(0, plan.d - 4, 2.2, F, P, { steps: 24 }), { tone: "mid", crease: "lo" }, "recorder.roller", G.pointOf(F, plan.d / 2, 0, 0), (A) => A.disc(F, 0, plan.d - 4, 2.2, { name: "recorder.roller" })));
    }
    // the paper
    out.push(Sx(k.slabOf(paper, z + h, 0.6, P, 2), { tone: "hi", crease: "none" }, "recorder.paper", [paper.x + paper.w / 2, paper.y + paper.d / 2, z + h], (A) => A.slab(paper, z + h, 0.6, { name: "recorder.paper" }, 2)));
    // grid on the paper: angle every 10°, tension every 100 N, ending on the paper's edges
    const grid = [];
    for (let a = 0; a <= xMax; a += 10) grid.push(k.lineOnTop(toPaper(a, 0).map((v, i) => (i ? paper.y + paper.d : v)), toPaper(a, yMax).map((v, i) => (i ? paper.y : v)), zt, P));
    const gy = [];
    for (let t = 0; t <= yMax; t += 100) gy.push(k.lineOnTop([paper.x, toPaper(0, t)[1]], [paper.x + paper.w, toPaper(0, t)[1]], zt, P));
    out.push(Ln(grid.join("") + gy.join(""), { tone: "faint" }));
    if (target) out.push(Ln(k.lineOnTop([paper.x, toPaper(0, target)[1]], [paper.x + paper.w, toPaper(0, target)[1]], zt, P), { tone: "mid", dashed: true }));
    // pen rail across the paper, on two posts
    const railY = paper.y - 0.5;
    for (const x of [plan.x + 2.5, plan.x + plan.w - 2.5]) out.push(Sx(k.cylinder(x, plan.y + plan.d / 2, 1.4, z + h, 5, P, 14), { tone: "mid" }, "recorder.post", [x, plan.y + plan.d / 2, z + h], (A) => A.cylinder(x, plan.y + plan.d / 2, 1.4, z + h, 5, { name: "recorder.post" })));
    out.push(Dt([at([plan.x + 3, plan.y + 2, z + h]), at([plan.x + plan.w - 3, plan.y + plan.d - 2, z + h])], { size: 0.45 }));
    return out.join("");
  }
  const railZ = z + h + 5.9;                       // the rail rests on the posts
  function rail(P) {
    const F = G.frameOf([plan.x + 2.5, plan.y + plan.d / 2, railZ], [1, 0, 0], [0, 1, 0], [0, 0, 1]);
    return Sx(G.disc(0, plan.w - 5, 0.9, F, P, { steps: 14 }), { tone: "mid", crease: "none" }, "recorder.rail", G.pointOf(F, plan.w / 2, 0, 0), (A) => A.disc(F, 0, plan.w - 5, 0.9, { name: "recorder.rail" }));
  }
  // the pen carriage on the rail at a mast angle, its stylus touching the paper at the tension
  function pen(P, theta, tension) {
    const [px, py] = toPaper(theta, tension);
    const out = [];
    const car = { x: px - 2.4, y: plan.y + plan.d / 2 - 3, w: 4.8, d: 6, r: 1 };
    out.push(S(k.slabOf(car, railZ - 1.6, 3.2, P, 3), { tone: "mid" }));
    // arm from the carriage to the stylus, along the paper
    const F = G.frameOf([px, plan.y + plan.d / 2, railZ - 0.6], [0, Math.sign(py - (plan.y + plan.d / 2)) || 1, 0], [1, 0, 0], [0, 0, 1]);
    const reach = Math.abs(py - (plan.y + plan.d / 2));
    if (reach > 3.2) out.push(S(G.disc(3, reach, 0.5, F, P, { steps: 10 }), { tone: "mid", crease: "none" }));
    const Fs = G.frameAlong([px, py, railZ - 0.6], [0, 0, -1]);
    out.push(S(G.solidOf([[0, 0.9], [railZ - 0.6 - zt - 1, 0.7], [railZ - 0.6 - zt, 0.15]], Fs, P, { steps: 12 }), { tone: "hi", lit: true, crease: "none" }));
    return out.join("");
  }
  function trace(P, points) {
    if (points.length < 2) return "";
    return k.pathOf(points.map(([a, t]) => k.iso([...toPaper(a, t), zt], P)));
  }
  return { plan, paper, body, rail, pen, trace, toPaper, zt };
}
