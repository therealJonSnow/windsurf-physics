// The board and rig, drawn in the board's own frame (x forward from the CLR, y to port, z up, model units)
// with a projection turned by the board's yaw: a yaw ψ is the kit drawing at azimuth a − ψ.
// From the steering demo's rig.mjs, generalised so the rig can sail, lie flat on the water, rise on the
// uphaul or flag downwind. Runs at build time and in the page; returns SVG strings.
import { k, G, T } from "./kit.mjs";
import { BOARD, MAST_FOOT, BOOM_U, BOOM_END, SAIL, CE, CLEW } from "./physics/sail.mjs";
import { HEIGHTS, halfWidth, hullRing } from "./physics/hull.mjs";

const S = (paths, style) => k.solidSvg(paths, style);
const Ln = (d, style) => k.lineSvg(d, style);
const Dt = (points, style) => k.dotsSvg(points, style);
const tube = (points, r, P, opts = {}, tone = "hi") => (points.length < 2 ? "" : T.tubePieces(points, r, P, opts).map((piece) => T.tubeSvg(piece, { tone })).join(""));
const path = (points, closed = false) => k.pathOf(points, closed);

// The projection that draws the board frame: yaw ψ (degrees, + anticlockwise from above) about the
// board point `pivot`, which lands on the world point `at`.
export function boardProjection(P, yaw, pivot = [0, 0, 0], at = [0, 0, 0]) {
  const Pb = { ...P, azimuth: (P.azimuth ?? 45) - yaw, origin: [0, 0] };
  const p = k.iso(pivot, Pb), w = k.iso(at, { ...P, origin: [0, 0] });
  return { ...Pb, origin: [P.origin[0] + w[0] - p[0], P.origin[1] + w[1] - p[1]] };
}

// Sail extent v at a height u along the mast: one monotone cubic through the outline's knots.
export const vmax = (() => {
  const us = SAIL.map((p) => p[0]), vs = SAIL.map((p) => p[1]);
  const n = us.length;
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((vs[i + 1] - vs[i]) / (us[i + 1] - us[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (3 * (us[i + 1] - us[i - 1])) / ((2 * us[i + 1] - us[i] - us[i - 1]) / d[i - 1] + (us[i + 1] + us[i] - 2 * us[i - 1]) / d[i]));
  m.push(d[n - 2]);
  return (u) => {
    if (u <= us[0] || u >= us[n - 1]) return 0;
    let i = 0;
    while (u > us[i + 1]) i++;
    const h = us[i + 1] - us[i], t = (u - us[i]) / h;
    const h00 = 2 * t ** 3 - 3 * t ** 2 + 1, h10 = t ** 3 - 2 * t ** 2 + t, h01 = -2 * t ** 3 + 3 * t ** 2, h11 = t ** 3 - t ** 2;
    return h00 * vs[i] + h10 * h * m[i] + h01 * vs[i + 1] + h11 * h * m[i + 1];
  };
})();
const U0 = SAIL[0][0], U1 = SAIL[SAIL.length - 1][0];
const camberAt = (t) => 4 * t * (1 - t);
const SAMPLES = (() => {
  const us = [];
  for (let i = 0; i <= 90; i++) us.push(U0 + ((U1 - U0) * (1 - Math.cos((Math.PI * i) / 90))) / 2);
  return us;
})();

// Clip a polyline of {p, q} (q: 3D point) against z >= level, keeping runs above it.
function clipRuns(points, level) {
  if (level == null) return [points];
  const runs = [];
  let run = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const up = p[2] >= level;
    if (i > 0) {
      const a = points[i - 1];
      const wasUp = a[2] >= level;
      if (up !== wasUp) {
        const t = (level - a[2]) / (p[2] - a[2]);
        const x = G.lerp3(a, p, t);
        if (wasUp) { run.push(x); runs.push(run); run = []; }
        else run = [x];
      }
    }
    if (up) run.push(p);
  }
  if (run.length > 1) runs.push(run);
  return runs.filter((r) => r.length > 1);
}

// Clip a closed polygon (3D, planar or nearly) against z >= level: Sutherland–Hodgman.
function clipPolygon(points, level) {
  if (level == null) return points;
  const out = [];
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length];
    const ina = a[2] >= level, inb = b[2] >= level;
    if (ina) out.push(a);
    if (ina !== inb) out.push(G.lerp3(a, b, (level - a[2]) / (b[2] - a[2])));
  }
  return out;
}

// ---- the board ----
// Zw: the water line (world z). Returns the deck items (drawn first) and the straps, which sort later.
export function makeBoard({ Zw }) {
  const Zd = Zw + HEIGHTS.deck, ZF = Zw + HEIGHTS.joint;
  const B = BOARD;

  function deck(P, { centreline = true, pivot = true } = {}) {
    const at = (p) => k.iso(p, P);
    const out = [];
    const ring = hullRing(0);
    const lower = hullRing(1.6);
    out.push(S(k.extrude(lower, Zw, 2.4, P, { convex: true }), { tone: "hi", crease: "lo" }));
    const hull = k.extrude(ring, Zw + 2.4, Zd - Zw - 2.4, P, { convex: true, bevel: 1.1 });
    out.push(S(hull, { tone: "hi", crease: "lo", inner: Ln(k.ringSeam(ring, Zw + 3.6, P), { tone: "faint" }) }));
    // deck pad
    const padFrom = B.tail + 3.5, padTo = 21;
    const padSide = [];
    for (let i = 0; i <= 18; i++) {
      const x = padFrom + ((padTo - padFrom) * i) / 18;
      padSide.push([x, halfWidth(x) - 3.4]);
    }
    const pad = [...padSide.map(([x, y]) => [x, -y]), ...padSide.map(([x, y]) => [x, y]).reverse()];
    out.push(S(k.extrude(pad, Zd, 0.35, P, { convex: true }), { tone: "mid", crease: "none" }));
    const padInset = [...padSide.map(([x, y]) => [x + (x === padFrom ? 1.6 : x === padTo ? -1.6 : 0), -(y - 1.6)]), ...padSide.map(([x, y]) => [x + (x === padFrom ? 1.6 : x === padTo ? -1.6 : 0), y - 1.6]).reverse()];
    out.push(Ln(k.onTop(padInset, Zd + 0.35, P, true), { tone: "faint" }));
    if (centreline) {
      // centreline scale with the CLR at zero
      const strip = [[-36, -1.9], [18, -1.9], [18, 1.9], [-36, 1.9]];
      out.push(S(k.extrude(strip, Zd + 0.35, 0.3, P, { convex: true }), { tone: "lo", crease: "none" }));
      const ticks = k.topTicks(-36, 18, 3, 5, -1.9, Zd + 0.65, [1.2, 2.4], P);
      out.push(Ln(ticks.minor, { tone: "lo" }), Ln(ticks.major, { tone: "mid" }));
    }
    if (pivot) {
      // the centreboard head, where the board pivots (the CLR)
      out.push(S(k.cylinder(0, 0, 2.3, Zd + 0.65, 0.4, P, 24), { tone: "hi", crease: "lo" }));
      out.push(Ln(k.ring(0, 0, 1.1, Zd + 1.05, P, 16), { tone: "mid" }), Dt([at([0, 0, Zd + 1.05])], { size: 0.5, tone: "hi" }));
    }
    // mast track
    const track = { x: MAST_FOOT - 8, y: -1.7, w: 17, d: 3.4, r: 1.7 };
    out.push(Ln(k.planOutline(track, Zd, P, 4), { tone: "lo" }));
    const tt = k.topTicks(track.x + 1, track.x + track.w - 1, 2, 4, 1.7, Zd, [1.0, 1.8], P);
    out.push(Ln(tt.minor, { tone: "lo" }), Ln(tt.major, { tone: "mid" }));
    // vent screw and leash plug
    out.push(Ln(k.ring(50, 0, 1.2, Zd, P, 14), { tone: "lo" }), Dt([at([50, 0, Zd])], { size: 0.45 }));
    const leash = [B.tail + 3, 0];
    out.push(S(k.cylinder(leash[0], leash[1], 1.4, Zd, 0.9, P, 18), { tone: "mid" }));
    out.push(Ln(k.ring(leash[0], leash[1], 0.7, Zd + 0.9, P, 12), { tone: "lo" }));
    // mast foot base
    out.push(S(k.cylinder(MAST_FOOT, 0, 3.6, Zd, 1.0, P, 24), { tone: "lo" }));
    out.push(S(k.cylinder(MAST_FOOT, 0, 2.5, Zd + 1.0, 0.7, P, 20), { tone: "mid" }));
    return out.join("");
  }

  // footstraps: two plugs and a padded strap each; each is an item with its own depth
  function straps(P) {
    const at = (p) => k.iso(p, P);
    return [[2, 3.4, 12.8], [2, -3.4, -12.8], [-30, 3.0, 11.6], [-30, -3.0, -11.6]].map(([x, y0, y1]) => {
      const a = [x - 2.6, y0, Zd + 1.05], b = [x + 2.6, y1, Zd + 1.05];
      const pts = [];
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + 2.6 * Math.pow(Math.sin(Math.PI * t), 0.7) - 0.25]);
      }
      const plugs = [[a[0], a[1]], [b[0], b[1]]].map(([px, py]) => S(k.cylinder(px, py, 1.7, Zd + 0.35, 0.7, P, 16), { tone: "mid" }) + Dt([at([px, py, Zd + 1.05])], { size: 0.4, tone: "lo" })).join("");
      return { mid: [x, (y0 + y1) / 2, Zd + 3], svg: plugs + tube(pts, 1.4, P, { maxLength: 60 }, "hi") };
    });
  }

  return { Zw, Zd, ZF, deck, straps };
}

// ---- the rig ----
// frame: from physics (frameFrom): m, b, n and at(u, v, w) in board units with the foot at deck level;
// it is lifted to the universal joint here. Options:
//   camber   sail depth (0.07 sailing, 0 lying flat or flagging)
//   water    world z of the water: parts below it are under the water and not drawn, with a wet line
//   plumb    draw the lit plumb line from the CE to a bob: true hangs it over the deck, a number at that z
//   uphaul   { hands: [x, y, z] } the hands holding the uphaul (board frame), or null for the stowed line
//   meter    a function (from, to, P) => { svg, mid } drawing a newton meter spliced into the uphaul
//   wet      0..1: water still lying on the sail (drawn as a film over its lower part)
//   litCe    the CE eyelet is lit (default true)
// Returns { back, sail, front, early, ce, bob, facing, plane } so callers can interleave other items.
export function drawRig(P, frame, board, opts = {}) {
  const { camber = 0.07, water = null, plumb = false, uphaul = null, meter = null, wet = 0, litCe = true } = opts;
  const V = G.viewOf(P);
  const at = (p) => k.iso(p, P);
  const ZF = board.ZF;
  const rig = frame;
  const lift = (p) => [p[0], p[1], p[2] + ZF];
  const R = (u, v, w = 0) => lift(rig.at(u, v, w));
  const surf = (u, t, off = 0) => {
    const vm = vmax(u);
    return R(u, t * vm, -camber * vm * camberAt(t) + off);
  };
  const n = rig.n, m = rig.m;
  const facing = G.dot3(n, V) > 0 ? 1 : -1;
  const nearSide = (side) => G.dot3(G.mul3(n, side), V) > 0;
  const early = [], back = [], sail = [], front = [];
  const wetLevel = water == null ? null : water + 0.25;
  const above = (p) => wetLevel == null || p[2] >= wetLevel;

  // ---- mast foot: tendon and extension ----
  const foot = [MAST_FOOT, 0, ZF];
  const tendon = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const p0 = [MAST_FOOT, 0, board.Zd + 1.7], p1 = [MAST_FOOT, 0, board.Zd + 3.4];
    tendon.push([0, 1, 2].map((j) => (1 - t) ** 2 * p0[j] + 2 * (1 - t) * t * p1[j] + t * t * foot[j]));
  }
  early.push(tube(tendon, 1.6, P, { maxLength: 40, spacing: 1.5 }, "mid"));
  const Fm = G.frameAlong(foot, m);
  early.push(S(G.solidOf([[0, 2.7], [2.4, 2.7], [2.4, 2.05], [12.6, 2.05], [12.6, 1.55], [14.6, 1.55]], Fm, P, { steps: 24 }), { tone: "mid", crease: "lo" }));
  const face = G.angleToward(Fm, V);
  early.push(Dt([5, 7, 9, 11].map((sv) => at(G.pointOf(Fm, sv, 2.05, face))), { size: 0.45, tone: "lo" }));
  early.push(Ln(G.arcOf(Fm, 1.2, 2.7, P), { tone: "faint" }));

  // ---- sail ----
  const us = SAMPLES;
  const outline3 = [...us.map((u) => surf(u, 0)), ...us.slice().reverse().map((u) => surf(u, 1))];
  const outlinePts = clipPolygon(outline3, wetLevel);
  const outline = path(outlinePts.map(at), true);
  // smooth tone bands chordwise: the camber's normal depends on t only
  const uMid = 128;
  const normalAt = (t) => {
    const e = 0.002;
    const du = G.sub3(surf(uMid + 1, t), surf(uMid - 1, t));
    const dt = G.sub3(surf(uMid, Math.min(1, t + e)), surf(uMid, Math.max(0, t - e)));
    let nn = G.unit3(G.cross3(du, dt));
    if (G.dot3(nn, V) < 0) nn = G.mul3(nn, -1);
    return nn;
  };
  const bandAt = (t) => G.toneOf(normalAt(t), P);
  const cuts = [0];
  let prev = bandAt(0.005);
  const bands = [prev];
  if (camber > 0) {
    for (let i = 1; i <= 80; i++) {
      const t = i / 80;
      const b = bandAt(Math.min(0.995, t));
      if (b !== prev) {
        let lo = (i - 1) / 80, hi = t;
        for (let j = 0; j < 12; j++) {
          const mid = (lo + hi) / 2;
          if (bandAt(mid) === prev) lo = mid;
          else hi = mid;
        }
        cuts.push((lo + hi) / 2);
        bands.push(b);
        prev = b;
      }
    }
  }
  cuts.push(1);
  const shades = ["", "", "", ""];
  let top = "";
  bands.forEach((b, i) => {
    const t0 = cuts[i], t1 = cuts[i + 1];
    const poly3 = clipPolygon([...us.map((u) => surf(u, t0)), ...us.slice().reverse().map((u) => surf(u, t1))], wetLevel);
    if (poly3.length < 3) return;
    const poly = path(poly3.map(at), true);
    if (b >= 4) top += poly;
    else shades[b] += poly;
  });
  const sailPaths = { fill: outline, outline, crease: "", top, shades };
  const off = facing * 0.25;                                   // marks sit on the face we see
  const marks = [];
  const markLine = (pts3, style) => clipRuns(pts3, wetLevel).forEach((run) => marks.push(Ln(path(run.map(at)), style)));
  // panel seams, luff to free edge
  for (const u of [66, 146, 206]) {
    const pts = [];
    for (let i = 0; i <= 16; i++) pts.push(surf(u + (i / 16) * 5, i / 16, off));
    markLine(pts, { tone: "faint" });
  }
  // window: clear film in the lower sail
  const win = [[26, 0.2], [60, 0.17], [64, 0.6], [30, 0.66]];
  const winPts = [];
  for (let i = 0; i < 4; i++) {
    const [ua, ta] = win[i], [ub, tb] = win[(i + 1) % 4];
    for (let j = 0; j < 6; j++) winPts.push(surf(ua + ((ub - ua) * j) / 6, ta + ((tb - ta) * j) / 6, off));
  }
  const winClip = clipPolygon(winPts, wetLevel);
  if (winClip.length > 2) marks.push(`<path class="ws-window" d="${path(winClip.map(at), true)}"/>`, Ln(path(winClip.map(at), true), { tone: "lo" }));
  // water lying on the sail: a film over the low, luff side of the sail, shrinking as it drains
  if (wet > 0.01) {
    const reach = 0.25 + 0.75 * Math.sqrt(wet);
    const film = [];
    const uA = 22, uB = 22 + 120 * reach;
    for (let i = 0; i <= 12; i++) { const u = uA + ((uB - uA) * i) / 12; film.push(surf(u, 0.08 + 0.1 * (1 - reach), off)); }
    for (let i = 12; i >= 0; i--) { const u = uA + ((uB - uA) * i) / 12; film.push(surf(u, Math.min(0.92, 0.3 + 0.6 * reach * Math.sin((Math.PI * i) / 12)), off)); }
    const fc = clipPolygon(film, wetLevel);
    if (fc.length > 2) marks.push(`<path class="ws-film" style="opacity:${(0.35 + 0.65 * Math.min(1, wet * 1.4)).toFixed(2)}" d="${path(fc.map(at), true)}"/>`);
  }
  // batten pockets and tensioners
  for (const ub of [102, 130, 158, 186, 214]) {
    const t0 = 3.6 / vmax(ub), t1 = 1 - 1.4 / Math.max(vmax(ub + 7), 8);
    const A = [], Bp = [];
    for (let i = 0; i <= 14; i++) {
      const t = t0 + ((t1 - t0) * i) / 14;
      const u = ub + 7 * t;
      A.push(surf(u - 0.9, t, off));
      Bp.push(surf(u + 0.9, t, off));
    }
    const poly = clipPolygon([...A, ...Bp.reverse()], wetLevel);
    if (poly.length > 2) marks.push(Ln(path(poly.map(at), true), { tone: "lo" }));
    const tip = surf(ub + 7 * t1, t1, off);
    if (above(tip)) marks.push(Dt([at(tip)], { size: 0.5, tone: "mid" }));
  }
  // clew and tack rings
  const clew = R(CLEW[0], CLEW[1], 0);
  if (above(clew)) marks.push(Ln(G.circleOf(G.frameOf(clew, G.mul3(n, facing), m, rig.b), 0.3, 1.6, P, 20), { tone: "mid" }));
  const tack = R(U0 + 1.5, 2.6, 0);
  if (above(tack)) marks.push(Ln(G.circleOf(G.frameOf(tack, G.mul3(n, facing), m, rig.b), 0.3, 1.1, P, 16), { tone: "mid" }));
  // the wet line where the sail meets the water
  if (wetLevel != null) {
    const edge = [];
    for (let i = 0; i < outline3.length; i++) {
      const a = outline3[i], b = outline3[(i + 1) % outline3.length];
      if ((a[2] - wetLevel) * (b[2] - wetLevel) < 0) edge.push(G.lerp3(a, b, (wetLevel - a[2]) / (b[2] - a[2])));
    }
    if (edge.length >= 2) marks.push(Ln(path([at(edge[0]), at(edge[edge.length - 1])]), { tone: "lo" }));
  }
  // centre of effort: the eyelet the plumb line hangs from
  const ceT = CE.v / vmax(CE.u);
  const ceAt = surf(CE.u, ceT, 0.4);
  const ceFace = surf(CE.u, ceT, off);
  let eyeletSvg = "";
  if (above(ceFace)) {
    const eyelet = G.frameOf(ceFace, G.mul3(n, facing), m, rig.b);
    const tone = litCe ? "lit" : "mid";
    eyeletSvg = Ln(G.circleOf(eyelet, 0, 2.3, P, 24), { tone }) + Ln(G.circleOf(eyelet, 0, 1.1, P, 16), { tone }) + Dt([at(ceFace)], { size: 0.6, tone: litCe ? "hi" : "mid" });
  }
  if (outlinePts.length > 2) sail.push(S(sailPaths, { tone: "hi", crease: "none" }));
  sail.push(marks.join(""));
  sail.push(eyeletSvg);

  // luff sleeve around the mast, open at the boom cutout
  const sleeve = [];
  for (let u = U0; u <= U1 - 1; u += 8) sleeve.push(R(Math.min(u, U1 - 1), 0, 0));
  sleeve.push(R(U1 - 1, 0, 0));
  const cut0 = 74 - U0, cut1 = 82 - U0;
  const sleeveRuns = clipRuns(sleeve, wetLevel);
  const sleeveR = (u) => 2.7 - 0.9 * ((u - U0) / (U1 - 1 - U0));
  sleeveRuns.forEach((run) => {
    const u0 = G.dot3(G.sub3(run[0], foot), m), len = G.pathLength(run);
    const gaps = [[cut0 - (u0 - U0), cut1 - (u0 - U0)]].filter(([a, b]) => b > 0 && a < len);
    sail.push(T.tubePieces(run, (t) => sleeveR(u0 + t * len), P, { maxLength: 400, spacing: 7, gaps }).map((piece) => T.tubeSvg(piece, { tone: "hi" })).join(""));
  });
  if (above(R(78, 0, 0))) sail.push(S(G.disc(73, 83, 1.45, Fm, P), { tone: "mid", crease: "none" }));
  if (above(R(U1, 0, 0))) sail.push(S(G.disc(U1 - 3, U1 + 1.4, 2.1, Fm, P), { tone: "mid", crease: "lo" }) + S(G.sphereOf(G.pointOf(Fm, U1 + 1.6, 0, 0), 1.6, P), { tone: "mid" }));

  // ---- boom: two arms either side of the sail ----
  const nearArm = nearSide(1) ? 1 : -1;
  const armAt = (side, v) => {
    const q = Math.max(0, Math.min(1, (v - 3.4) / (BOOM_END - 3.4)));
    return R(BOOM_U, v, side * (1.9 + 8.6 * Math.pow(Math.sin(Math.PI * q), 0.55)));
  };
  const arm = (side) => {
    const pts = [];
    for (let i = 0; i <= 22; i++) pts.push(armAt(side, 3.4 + ((BOOM_END - 3.4) * i) / 22));
    return clipRuns(pts, wetLevel).map((run) => T.tubePieces(run, 1.2, P, { maxLength: 40, spacing: 4.5, caps: run.length !== pts.length ? true : false, rings: side === nearArm ? { pitch: 2.6, steps: 6, fade: [0.12, 0.6] } : null }).map((piece) => T.tubeSvg(piece, { tone: "hi" })).join("")).join("");
  };
  const head = R(BOOM_U, 0, 0);
  const Fh = G.frameAlong(head, m);
  const boomHead = above(head) ? S(G.disc(-2.6, 2.6, 3.6, Fh, P, { steps: 28 }), { tone: "mid", crease: "lo" }) + Ln(G.arcOf(Fh, 0, 3.6, P), { tone: "faint" }) : "";
  const leverAt = R(BOOM_U, -4.2, 0);
  const boomLever = above(leverAt) ? S(G.sphereOf(leverAt, 1.5, P), { tone: "mid" }) : "";
  const endAt = R(BOOM_U, BOOM_END + 1.2, 0);
  const boomEnd = above(endAt) ? S(G.sphereOf(endAt, 2.9, P), { tone: "mid" }) : "";
  const outA = G.add3(clew, G.mul3(rig.b, 1.6)), outB = G.add3(endAt, G.mul3(rig.b, -2.7));
  const outhaul = above(outA) && above(outB) ? Ln(path([at(outA), at(outB)]), { tone: "mid" }) : "";

  // ---- uphaul ----
  const up0 = G.add3(head, G.mul3(n, 3.6));
  let uphaulSvg = "", meterItem = null;
  if (uphaul && uphaul.hands) {
    // taut from the boom head to the hands, a newton meter spliced in near the hands
    const hands = uphaul.hands;
    if (meter) {
      const len = G.len3(G.sub3(hands, up0));
      const dir = G.unit3(G.sub3(hands, up0));
      const span = meter.length ?? 22;
      const a = G.add3(hands, G.mul3(dir, -Math.min(len * 0.45, len - span - 4) - span));   // meter's top eye
      const b = G.add3(a, G.mul3(dir, span));                                             // meter's bottom hook
      uphaulSvg = tube([up0, G.add3(a, G.mul3(dir, -0.2))], 0.55, P, { maxLength: 80, spacing: 4 }, "mid") + tube([G.add3(b, G.mul3(dir, 0.2)), hands], 0.55, P, { maxLength: 80, spacing: 4 }, "mid");
      meterItem = meter(a, b, P);
    } else uphaulSvg = tube([up0, hands], 0.55, P, { maxLength: 80, spacing: 4 }, "mid");
  } else {
    // stowed: a braided line from the boom head down to the extension, on the windward side
    const up1 = G.add3(G.pointOf(Fm, 12, 0, 0), G.mul3(n, 2.05));
    const uph = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const p = G.lerp3(up0, up1, t);
      uph.push(G.add3(p, G.add3(G.mul3(n, 7 * Math.sin(Math.PI * t)), [0, 0, -5 * Math.sin(Math.PI * t)])));
    }
    uphaulSvg = clipRuns(uph, wetLevel).map((run) => tube(run, 0.55, P, { maxLength: 80, spacing: 4 }, "mid")).join("");
  }

  // ---- plumb line from the CE straight down to a bob over the deck ----
  const bob = [ceAt[0], ceAt[1], typeof plumb === "number" ? plumb : board.Zd + 5];
  let plumbSvg = "";
  if (plumb) {
    const cord = `<path class="iso-line ws-plumb" data-tone="lit" d="${path([at(ceAt), at([bob[0], bob[1], bob[2] + 1.1])])}"/>`;
    plumbSvg = cord + S(G.solidOf([[0, 0.5], [0.5, 1.3], [1.6, 1.3], [3.2, 0.25]], G.frameAlong([bob[0], bob[1], bob[2] + 1.1], [0, 0, -1]), P, { steps: 20 }), { tone: "hi", lit: true, crease: "none" });
  }

  const windward = nearSide(1);
  back.push(arm(windward ? -1 : 1));
  const lineItems = [uphaulSvg, meterItem ? meterItem.svg : "", plumbSvg].join("");
  if (!windward) back.push(lineItems);
  if (windward) front.push(lineItems);
  front.push(arm(windward ? 1 : -1), boomHead, boomLever, boomEnd, outhaul);

  return { early, back, sail, front, ce: ceAt, bob, facing, foot, plane: (p) => G.dot3(G.sub3(p, foot), G.mul3(n, facing)), meter: meterItem };
}

// Assemble a board, a rig and extra items (a sailor's segments, say) in painter's order.
// extra: [{ mid, svg }] in the board frame. Items on the viewer's side of the sail are drawn after it.
export function assemble(P, board, rigParts, extra = [], { straps = true } = {}) {
  const V = G.viewOf(P);
  const depth = (p) => G.dot3(p, V);
  const out = [board.deck(P)];
  const behind = [], infront = [];
  const items = [...(straps ? board.straps(P) : []), ...extra];
  items.sort((a, b) => depth(a.mid) - depth(b.mid) + ((a.bias || 0) - (b.bias || 0)));
  for (const item of items) ((rigParts && rigParts.plane(item.mid) > 0) || item.front ? infront : behind).push(item.svg);
  if (rigParts) {
    // straps and deck items behind the sail go first, then the rig's foot, the far side, the sail, the near side
    out.push(...behind.filter((_, i) => true));
    out.push(...rigParts.early, ...rigParts.back, ...rigParts.sail, ...rigParts.front);
  } else out.push(...behind);
  out.push(...infront);
  return out.join("");
}
