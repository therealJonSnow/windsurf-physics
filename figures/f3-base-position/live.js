// F3 · the page: tilt the flagging rig, the board turns. Everything on screen comes from baseSolve.
import { createFigure, fill } from "../../packages/windsurf/ui.js";
import { baseStep, baseSolve, awayFromWind, wrap } from "../../packages/windsurf/physics/rig-water.mjs";
import { P, FAN, TELL, CONSOLE, MOMENT_MAX, TILT_MAX, scene, targetMark } from "./figure.mjs";

const R = Math.PI / 180;
const N = (v) => Math.round(Math.abs(v));
const sign = (v) => (v >= 0 ? "+" : "−");

export function mount(root, { captions, store = false }) {
  const fig = createFigure(root, { id: "f3-base-position", captions, store });
  const $ = fig.$;
  const boardEl = $('[data-part="board"]'), bladesEl = $('[data-part="blades"]'), pennantEl = $('[data-part="pennant"]');
  const needleEl = $('[data-part="needle"]'), pointerEl = $('[data-part="pointer"]'), targetEl = $('[data-part="target"]');
  const W = captions.why, Cc = captions.controls.tilt;

  const state = { heading: 90, rate: 0 };
  let tilt = 0, target = 0, fan = 0, solve = baseSolve(90, 0);
  const drawn = { heading: NaN, tilt: NaN };

  const tiltWord = (t) => (Math.abs(t) < 0.5 ? Cc.upright : fill(t > 0 ? Cc.nose : Cc.tail, { deg: N(t) }));
  const slider = fig.slider("tilt", { get: () => target, set: (v) => { target = v; }, format: tiltWord });

  const draw = fig.throttle(() => {
    boardEl.innerHTML = scene(state.heading, tilt).svg;
    drawn.heading = state.heading;
    drawn.tilt = tilt;
  });

  function words(s, now) {
    const turn = awayFromWind(state.heading, state.rate / R);
    const doing = Math.abs(turn) < 1.5 ? captions.doing.hold : fill(turn > 0 ? captions.doing.away : captions.doing.up, { rate: N(turn) });
    const h = wrap(state.heading);
    fig.readout(fill(captions.readout, { heading: N(h), moment: `${sign(s.torque)}${Math.abs(s.torque).toFixed(1)}`, doing }));
    // the lever, measured across the wind: + ahead of the centreboard toward the nose
    const ahead = Math.sign(Math.sin(state.heading * R) || 1) * s.lever;
    const turnKey = Math.abs(s.torque) < 0.4 ? "none" : awayFromWind(state.heading, s.torque) > 0 ? "away" : "up";
    const close = Math.abs(Math.sin(state.heading * R)) < 0.3;
    const why = close && turnKey === "none" ? W.close : fill(W.push, { drag: N(s.drag), lever: N(ahead * 100), leverM: Math.abs(ahead).toFixed(2), side: ahead >= 0 ? W.side.ahead : W.side.behind, turn: W.turn[turnKey] });
    fig.why(why, now);
    fig.value(Math.round(tilt), `Tilt ${tiltWord(tilt)}. ${N(h)} degrees off the wind, ${doing}.`);
  }

  // idle tour: steer like a sailor toward a heading, by tilt
  const TOUR = [[90, 6], [140, 8], [60, 9], [90, 6]];
  const tourHeading = (t) => {
    const total = TOUR.reduce((a, [, d]) => a + d, 0);
    let x = t % total;
    for (const [h, d] of TOUR) { if (x < d) return h; x -= d; }
    return 90;
  };
  const steerTo = (goal) => Math.max(-TILT_MAX, Math.min(TILT_MAX, -17 + 1.4 * (goal - state.heading) - 30 * (state.rate)));

  fig.onTick = (dt, now, calm) => {
    if (fig.touring && !fig.replay) target = steerTo(tourHeading(fig.tourClock));
    const ease = (v, t, s) => (calm ? t : Math.abs(t - v) < 0.01 ? t : v + (t - v) * (1 - Math.exp(-dt / s)));
    tilt = ease(tilt, target, 0.35);
    if (calm) { for (let i = 0; i < 60; i++) baseStep(state, tilt, 0.1); state.rate = 0; }
    else solve = baseStep(state, tilt, dt);
    solve = baseSolve(state.heading, tilt);
    const moved = !(Math.abs(state.heading - drawn.heading) < 0.1 && Math.abs(tilt - drawn.tilt) < 0.05);
    if (moved) draw(now, calm || (Math.abs(state.rate) < 0.003 && tilt === target));
    fan += dt * (calm ? 0 : 14);
    bladesEl.innerHTML = FAN.blades(P, fan);
    pennantEl.setAttribute("d", TELL.pennant(P, calm ? 0.3 : fig.clock, 1));
    needleEl.setAttribute("d", CONSOLE.needle(P, solve.torque / MOMENT_MAX));
    pointerEl.setAttribute("d", CONSOLE.pointer(P, 0, tilt / TILT_MAX));
    slider.sync(target);
    words(solve, now);
    return true;
  };

  // ---- input ----
  fig.pointer(([x]) => { target = -TILT_MAX + Math.max(0, Math.min(1, (x - 0.2) / 0.6)) * 2 * TILT_MAX; });
  fig.keys({
    ArrowRight: (e) => { target = Math.min(TILT_MAX, Math.round(target) + (e.shiftKey ? 5 : 1)); },
    ArrowLeft: (e) => { target = Math.max(-TILT_MAX, Math.round(target) - (e.shiftKey ? 5 : 1)); },
    Home: () => { target = 0; },
  });

  // ---- challenges ----
  const goals = [{ heading: 90, band: 8 }, { heading: 50, band: 8 }, { heading: 150, band: 8 }];
  fig.tasks = goals.map((g) => ({ ok: () => Math.abs(wrap(state.heading) - g.heading) < g.band && Math.abs(state.rate / R) < 4 }));
  fig.onTask = (i) => {
    if (i < 0) { targetEl.style.opacity = "0"; return; }
    state.heading = i === 0 ? 120 : 90;
    state.rate = 0;
    tilt = target = 0;
    drawn.heading = NaN;
    targetEl.setAttribute("d", targetMark(goals[i].heading));
    targetEl.style.opacity = "1";
  };

  // ---- mistake: tilt toward the nose to "point higher" ----
  fig.onMistake = () => {
    state.heading = 90; state.rate = 0; tilt = target = 0; drawn.heading = NaN;
    targetEl.style.opacity = "0";
    let t = 0;
    return {
      step(dt, calm) {
        t += calm ? 99 : dt;
        target = t < 1 ? 0 : t < 7.5 ? 22 : -17;
        return t > 10;
      },
    };
  };
  fig.onSteer = () => {};

  draw(performance.now(), true);
  words(solve, 0);
  fig.why(fill(W.push, { drag: N(solve.drag), lever: 0, leverM: "0.00", side: W.side.ahead, turn: W.turn.none }), 0, true);
  fig.run();
  return fig;
}
