// F1 · the page: turn the board, swing the rig, let the wind settle it. Everything comes from floatStep.
import { createFigure, fill } from "../../packages/windsurf/ui.js";
import { floatStep, floatInfo, wrap, rigToBoard, downwindAngle, T_BAND } from "../../packages/windsurf/physics/rig-water.mjs";
import { onHull } from "../../packages/windsurf/physics/hull.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { MAST_FOOT, toM } from "../../packages/windsurf/physics/sail.mjs";
import { P, FAN, TELL, CONSOLE, WIND_TO, scene, toWater, rimMark, yawOf } from "./figure.mjs";

const R = Math.PI / 180;
const N = (v) => Math.round(Math.abs(v));

export function mount(root, { captions, store = false }) {
  const fig = createFigure(root, { id: "f1-t-position", captions, store });
  const $ = fig.$;
  const boardEl = $('[data-part="board"]'), bladesEl = $('[data-part="blades"]'), pennantEl = $('[data-part="pennant"]');
  const pointers = [$('[data-part="pointer0"]'), $('[data-part="pointer1"]')];
  const targetEl = $('[data-part="target"]');
  const W = captions.why, S = captions.states;

  const state = { heading: 90, rho: 60, rate: 0 };
  let heading = 90, headingTarget = 90, held = false, rhoTarget = 60, fan = 0, info = floatInfo(90, 60);
  const drawn = { heading: NaN, rho: NaN };

  const boardAngle = () => N(Math.abs(wrap(heading)));                          // 0 nose to wind … 180 nose downwind
  const rigAngle = (i) => N(Math.abs(wrap(i.phi)));
  const sBoard = fig.slider("board", { get: () => headingTarget, set: (v) => { headingTarget = v; }, format: (v) => fill(captions.controls.board.value, { deg: N(Math.abs(wrap(v))) }) });
  fig.button("reset", () => { randomStart(); fig.steer(); });

  const draw = fig.throttle(() => {
    boardEl.innerHTML = scene(heading, state.rho, state.rate).svg;
    drawn.heading = heading;
    drawn.rho = state.rho;
  });

  function stateWord(i) {
    if (held) return S.held;
    if (i.tPosition && Math.abs(state.rate) < 0.02) return S.t;
    if (i.onDeck && Math.abs(state.rate) < 0.005) return S.deck;
    if (Math.abs(state.rate) > 0.01) return S.swing;
    return S.rest;
  }
  function words(i, now) {
    const word = stateWord(i);
    fig.readout(fill(captions.readout, { board: boardAngle(), rig: rigAngle(i), state: word }));
    const torque = Math.abs(i.wind).toFixed(1);
    let why;
    if (held) why = fill(W.held, { rho: N(state.rho), torque });
    else if (word === S.t) why = W.t;
    else if (word === S.deck) why = fill(W.deck, { hold: i.hold.toFixed(1), torque });
    else if (word === S.swing) why = fill(W.swing, { lever: C.floatDragLever.toFixed(1), torque });
    else why = fill(W.rest, { board: boardAngle() });
    fig.why(why, now);
    fig.value(boardAngle(), `Board ${boardAngle()} degrees to the wind, rig ${rigAngle(i)} degrees to the board, ${word}.`);
  }

  function randomStart() {
    let h, r;
    do { h = 20 + Math.random() * 320; r = -150 + Math.random() * 300; } while (floatInfo(h, r).tPosition || floatInfo(h, r).onDeck);
    heading = headingTarget = state.heading = h;
    state.rho = rhoTarget = r;
    state.rate = 0;
    drawn.heading = NaN;
  }

  // idle tour: turn the board toward goals and, now and then, push the rig off downwind and let go
  const TOUR = [{ heading: 90, push: -60, for: 9 }, { heading: 35, push: -50, for: 9 }, { heading: 140, push: 70, for: 9 }, { heading: 90, push: 40, for: 10 }];
  let tourStep = -1;
  function tour() {
    const total = TOUR.reduce((a, s) => a + s.for, 0);
    let x = fig.tourClock % total, i = 0;
    while (x >= TOUR[i].for) { x -= TOUR[i].for; i++; }
    if (i !== tourStep) { tourStep = i; rhoTarget = TOUR[i].push; }
    headingTarget = TOUR[i].heading;
    held = x < 1.6;                                      // hold the rig off downwind, then let go
  }

  fig.onTick = (dt, now, calm) => {
    if (fig.touring && !fig.replay) tour();
    const ease = (v, t, s) => (calm ? t : Math.abs(t - v) < 0.01 ? t : v + (t - v) * (1 - Math.exp(-dt / s)));
    // the board turns toward its target, carrying the mast foot; the rig stays where the water holds it
    heading = ease(heading, headingTarget, 0.5);
    state.heading = heading;
    if (held) state.rho = wrap(state.rho + wrap(rhoTarget - state.rho) * (calm ? 1 : 1 - Math.exp(-dt / 0.35)));
    if (calm && !held) { for (let i = 0; i < 300; i++) floatStep(state, 0.1); state.rate = 0; }
    info = floatStep(state, calm ? 0 : dt, { held });
    if (Math.abs(heading - drawn.heading) > 0.1 || Math.abs(wrap(state.rho - drawn.rho)) > 0.1) draw(now, calm || Math.abs(state.rate) < 1e-3);
    fan += dt * (calm ? 0 : 14);
    bladesEl.innerHTML = FAN.blades(P, fan);
    pennantEl.setAttribute("d", TELL.pennant(P, calm ? 0.3 : fig.clock, 1));
    pointers[0].setAttribute("d", CONSOLE.pointer(P, 0, wrap(heading - 180) / 180));
    pointers[1].setAttribute("d", CONSOLE.pointer(P, 1, wrap(info.phi) / 180));
    sBoard.sync(headingTarget);
    const out = fig.$('[data-out="rig"]');
    if (out) out.textContent = fill(captions.controls.rig.value, { deg: rigAngle(info) });
    words(info, now);
    return true;
  };

  // ---- pointer: drag the board by its hull, or the rig anywhere else ----
  let grab = null;
  const svg = fig.stage.querySelector("svg");
  const worldAt = (e) => {
    const box = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    return toWater([((e.clientX - box.left) / box.width) * vb.width, ((e.clientY - box.top) / box.height) * vb.height]);
  };
  const angleAt = ([x, y]) => Math.atan2(y, x) / R;
  const toBoard = ([x, y]) => {                        // world → board frame (pivot at the mast foot)
    const a = yawOf(heading) * R;
    return [MAST_FOOT + x * Math.cos(a) + y * Math.sin(a), -x * Math.sin(a) + y * Math.cos(a)];
  };
  fig.stage.addEventListener("pointerdown", (e) => {
    const w = worldAt(e);
    if (Math.hypot(w[0], w[1]) > 290) return;
    grab = onHull(toBoard(w), -6) ? { what: "board", from: angleAt(w), heading: headingTarget } : { what: "rig" };
    try { fig.stage.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    move(e);
    fig.steer();
  });
  const move = (e) => {
    if (!grab) return;
    const w = worldAt(e), a = angleAt(w);
    if (grab.what === "board") headingTarget = grab.heading + wrap(a - grab.from);
    else { held = true; rhoTarget = wrap(a - WIND_TO); }
    fig.steer();
  };
  fig.stage.addEventListener("pointermove", move);
  for (const name of ["pointerup", "pointercancel"]) fig.stage.addEventListener(name, () => { grab = null; held = false; fig.run(); });

  fig.keys({
    ArrowRight: (e) => { headingTarget -= e.shiftKey ? 10 : 2; },
    ArrowLeft: (e) => { headingTarget += e.shiftKey ? 10 : 2; },
    ArrowUp: (e) => { state.rho = wrap(state.rho + (e.shiftKey ? 20 : 5)); state.rate = 0; },
    ArrowDown: (e) => { state.rho = wrap(state.rho - (e.shiftKey ? 20 : 5)); state.rate = 0; },
    Home: () => randomStart(),
  });
  fig.onSteer = (resumed) => { if (!resumed) { /* the reader has it */ } else held = false; };

  // ---- challenges ----
  fig.tasks = [
    { ok: () => info.tPosition && Math.abs(state.rate) < 0.03 && !held },
    { ok: () => Math.abs(wrap(heading)) < 15 && info.onDeck && Math.abs(state.rate) < 0.01 && !held },
  ];
  fig.onTask = (i) => {
    held = false;
    if (i < 0) { targetEl.style.opacity = "0"; return; }
    if (i === 0) {
      randomStart();
      // mark both places across the wind on the rim, where the nose may point
      targetEl.setAttribute("d", rimMark(WIND_TO + 90, 2 * T_BAND) + rimMark(WIND_TO - 90, 2 * T_BAND).replace(/^M/, "M"));
    } else {
      heading = headingTarget = state.heading = 90;
      state.rho = 0; state.rate = 0;
      targetEl.setAttribute("d", rimMark(WIND_TO + 180, 30));
    }
    drawn.heading = NaN;
    targetEl.style.opacity = "1";
  };

  // ---- mistake: the rig starts upwind of the board ----
  fig.onMistake = () => {
    targetEl.style.opacity = "0";
    held = false;
    heading = headingTarget = state.heading = 90;
    state.rho = 176; state.rate = 0;
    drawn.heading = NaN;
    let t = 0, stuck = 0;
    return {
      step(dt, calm) {
        t += dt;
        stuck = info.onDeck && Math.abs(state.rate) < 1e-3 ? stuck + dt : 0;
        return calm || stuck > 1.5 || t > 30;
      },
    };
  };

  fig.probe = () => ({ heading, rho: state.rho, rate: state.rate, phi: info.phi, onDeck: info.onDeck, t: info.tPosition });
  draw(performance.now(), true);
  words(info, 0);
  fig.run();
  return fig;
}
