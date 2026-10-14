// Sign and limit checks for the pure physics. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { C } from "../packages/windsurf/physics/constants.mjs";
import { CE, AREA_M2, coefficients } from "../packages/windsurf/physics/sail.mjs";
import { solve, step } from "../packages/windsurf/physics/board.mjs";
import * as W from "../packages/windsurf/physics/rig-water.mjs";
import { uphaulPosture, backMoment } from "../packages/windsurf/physics/sailor.mjs";

test("the sail is about 5 m² and its CE sits inside it", () => {
  assert.ok(AREA_M2 > 4.5 && AREA_M2 < 5.5, `area ${AREA_M2}`);
  assert.ok(CE.u > 50 && CE.u < 200 && CE.v > 0);
});

test("a luffing sail makes no lift", () => {
  assert.equal(coefficients(0).lift, 0);
  assert.ok(coefficients(15).lift > coefficients(3).lift);
});

test("steering: rake forward bears away, rake back heads up", () => {
  assert.ok(solve(90, 10).torque > solve(90, 0).torque);
  assert.ok(solve(90, 10).torque > 0, "rake forward turns the nose away from the wind");
  assert.ok(solve(90, -10).torque < 0, "rake back turns the nose toward the wind");
});

test("steering: a luffing sail gives no moment to steer with", () => {
  // eased until the sail lies along the apparent wind (angle of attack about 1°): raking does almost nothing
  const luff = solve(90, 12, 20).torque - solve(90, 0, 20).torque;
  const drawn = solve(90, 12, 0).torque - solve(90, 0, 0).torque;
  assert.ok(solve(90, 0, 20).alpha < 2);
  assert.ok(Math.abs(luff) < 0.1 * Math.abs(drawn), `${luff} vs ${drawn}`);
});

test("steering: raking forward from a reach bears the board away over time", () => {
  const s = { heading: 90, rate: 0 };
  for (let i = 0; i < 300; i++) step(s, 10, 1 / 60);
  assert.ok(s.heading > 100, `heading ${s.heading}`);
});

test("F1: the floating rig swings downwind and settles there", () => {
  assert.ok(W.floatTorque(30) < 0 && W.floatTorque(-30) > 0, "wind turns the rig toward downwind from either side");
  assert.ok(Math.abs(W.floatTorque(0)) < 1e-9);
  const s = { heading: 90, rho: 60, rate: 0 };
  for (let i = 0; i < 60 * 30; i++) W.floatStep(s, 1 / 60);
  assert.ok(Math.abs(s.rho) < 2, `rho ${s.rho}`);
  const info = W.floatInfo(s.heading, s.rho);
  assert.ok(info.tPosition, "board across the wind with the rig downwind is the T-position");
});

test("F1: a rig started upwind swings over the board and the mast lands on the deck", () => {
  const s = { heading: 90, rho: 175, rate: 0 };
  let landed = false;
  for (let i = 0; i < 60 * 30; i++) landed = W.floatStep(s, 1 / 60).onDeck || landed;
  assert.ok(landed);
  assert.ok(Math.abs(s.rho) > 45, "the deck's friction holds it short of downwind");
});

test("F1: nose into the wind puts the rig over the tail, on the deck", () => {
  const info = W.floatInfo(0, 0);
  assert.ok(info.onDeck && !info.tPosition);
});

test("F2: uphaul tension falls as the mast rises (static, water drained)", () => {
  let last = Infinity;
  for (const theta of [30, 40, 50, 60, 70]) {
    const t = W.uphaulLoad({ theta, water: 0 }).tension;
    assert.ok(t < last, `${theta}°: ${t}`);
    last = t;
  }
});

test("F2: water on the sail adds load, and a snatch peaks higher than a slow pull", () => {
  assert.ok(W.uphaulLoad({ theta: 25, water: 15 }).tension > W.uphaulLoad({ theta: 25, water: 0 }).tension);
  const slow = W.uphaulRun({ style: "legs", pull: "slow" }), snatch = W.uphaulRun({ style: "legs", pull: "snatch" });
  assert.ok(snatch.peak > 2 * slow.peak, `${snatch.peak} vs ${slow.peak}`);
  assert.ok(slow.peak < C.uphaulTarget, "the slow pull with the legs passes the challenge");
  assert.ok(slow.done && slow.water < 0.5, "the water has drained by the end");
});

test("F2: bending the back loads the lower back more than leaning back with the legs", () => {
  const legs = W.uphaulRun({ style: "legs", pull: "slow" }), back = W.uphaulRun({ style: "back", pull: "slow" });
  assert.ok(back.backPeak > 1.5 * legs.backPeak, `${back.backPeak} vs ${legs.backPeak}`);
  assert.ok(legs.backPeak < C.backTarget);
});

test("F2: the hands stay within reach and the line pulls toward the tie point", () => {
  for (const style of ["legs", "back"]) for (const p of [0, 0.5, 1]) {
    const A = W.attachAt(p * W.BASE_ANGLE);
    const q = uphaulPosture(style, p, A);
    const reach = Math.hypot(q.hands[0] - q.shoulder[0], q.hands[1] - q.shoulder[1]);
    assert.ok(reach < 0.7, `${style} ${p}: reach ${reach}`);
    assert.ok(backMoment(q, 0).moment >= 0);
  }
});

test("F3: tilting the flagging rig toward the nose bears away, toward the tail heads up", () => {
  const fwd = W.baseSolve(90, 20).torque, back = W.baseSolve(90, -30).torque;
  assert.ok(fwd > 0 && back < 0, `${fwd} ${back}`);
  assert.ok(W.baseSolve(90, 20).torque > W.baseSolve(90, 0).torque);
});

test("F3: a flagging sail pushes straight downwind, so the board weathervanes", () => {
  // nose downwind with the rig over the nose is stable; nose to wind with the rig over the tail is stable
  assert.ok(W.baseSolve(170, 0).torque > 0 && W.baseSolve(190, 0).torque < 0);
  assert.ok(W.baseSolve(10, -30).torque < 0 && W.baseSolve(-10, -30).torque > 0);
});

test("F3: with tilt alone the board can be held across the wind, headed up and borne away", () => {
  const settle = (tilt, from) => { const s = { heading: from, rate: 0 }; for (let i = 0; i < 60 * 40; i++) W.baseStep(s, tilt, 1 / 60); return s.heading; };
  assert.ok(settle(-C.tiltMax, 90) < 50, "tilted fully toward the tail, the board heads up past 50°");
  assert.ok(settle(C.tiltMax, 90) > 150, "tilted fully toward the nose, the board bears away past 150°");
  // somewhere between, the push lines up with the centreboard and the board holds its heading
  const hold = [-30, -25, -20, -15, -10, -5, 0].find((t) => W.baseSolve(90, t).torque > 0);
  assert.ok(hold !== undefined && W.baseSolve(90, hold - 5).torque < 0);
});

test("F3: close to the wind the push lines up with the board and tilt stops turning it", () => {
  // the open question for the instructor: turning through the wind needs more than tilt in this model
  assert.ok(Math.abs(W.baseSolve(3, -C.tiltMax).torque) < 0.5);
});

test("F3: flagging drag is a few newtons to tens of newtons in 8 knots", () => {
  const d = W.flagDrag();
  assert.ok(d > 2 && d < 40, `${d}`);
});
