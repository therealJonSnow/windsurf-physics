// F1 · the page, as a game. The board and rig start somewhere new and wait. Nothing moves until the
// learner grabs the board; then the wind swings the floating rig downwind and the learner keeps the
// board square to it. Board and rig light up green while they are in the T-position (±10°); holding it
// for 2 s once the rig has settled wins. The learner can keep playing until Reset puts them somewhere new.
// Everything comes from floatStep.
import { createFigure, fill } from "../../packages/windsurf/ui.js";
import { floatStep, floatInfo, wrap, T_BAND } from "../../packages/windsurf/physics/rig-water.mjs";
import { onHull } from "../../packages/windsurf/physics/hull.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { MAST_FOOT } from "../../packages/windsurf/physics/sail.mjs";
import { P, FAN, TELL, CONSOLE, WIND_TO, scene, toWater, rimMark, yawOf } from "./figure.mjs";

const R = Math.PI / 180;
const N = (v) => Math.round(Math.abs(v));
const HOLD = 2;                                          // seconds in the T, rig settled, to win
const SETTLED = 0.03;                                    // rad/s: the rig counts as settled below this
// With the sailor standing on the board facing the rig, the board can only turn so far under them before
// their feet and the twist of their body stop it: the rig stays within this many degrees of square.
const LIMIT = 45;

export function mount(root, { captions, store = false }) {
  const fig = createFigure(root, { id: "f1-t-position", captions, store, tour: false });
  const $ = fig.$;
  const boardEl = $('[data-part="board"]'), bladesEl = $('[data-part="blades"]'), pennantEl = $('[data-part="pennant"]');
  const pointers = [$('[data-part="pointer0"]'), $('[data-part="pointer1"]')];
  const targetEl = $('[data-part="target"]'), taskEl = $("[data-task]");
  const W = captions.why, S = captions.states, G = captions.game;

  const state = { heading: 90, rho: 60, rate: 0 };
  let heading = 90, headingTarget = 90, fan = 0, info = floatInfo(90, 60);
  // the game: "ready" (frozen, waiting for a grab), "playing", "won" (still playable until reset)
  let phase = "ready", clock = 0, held = 0, wonAt = 0, best = null;
  const drawn = { heading: NaN, rho: NaN, go: null };
  let limited = true, side = 1, atLimit = false, limitUntil = -1;         // side: which side of the board the rig is on (+ port)
  // the board heading that keeps the rig within LIMIT of square, on its side; phi = 180 − heading + rho
  const clampHeading = (h) => {
    if (!limited) return h;
    const phi = wrap(180 - h + state.rho);
    const lo = side * 90 - LIMIT, hi = side * 90 + LIMIT;
    const kept = Math.min(hi, Math.max(lo, phi));
    return h + (phi - kept);
  };

  const boardAngle = () => N(Math.abs(wrap(heading)));                          // 0 nose to wind … 180 nose downwind
  const rigAngle = (i) => N(Math.abs(wrap(i.phi)));
  const sBoard = fig.slider("board", { get: () => headingTarget, set: (v) => { start(); headingTarget = v; }, format: (v) => fill(captions.controls.board.value, { deg: N(Math.abs(wrap(v))) }) });
  fig.button("reset", () => reset());

  const draw = fig.throttle(() => {
    boardEl.innerHTML = scene(heading, state.rho, state.rate).svg;
    drawn.heading = heading;
    drawn.rho = state.rho;
  });

  function say(html) { taskEl.innerHTML = html; taskEl.hidden = !html; }

  function reset() {
    // a start the sailor could stand in: the rig off square by 15–40°, on either side, and well off downwind
    let h, r;
    do {
      side = Math.random() < 0.5 ? 1 : -1;
      r = (Math.random() < 0.5 ? 1 : -1) * (30 + Math.random() * 120);
      const phi = side * (90 + (Math.random() < 0.5 ? 1 : -1) * (15 + Math.random() * 25));
      h = ((180 + r - phi) % 360 + 360) % 360;
    } while (floatInfo(h, r).tPosition || floatInfo(h, r).onDeck);
    limited = true;
    heading = headingTarget = state.heading = h;
    state.rho = r;
    state.rate = 0;
    phase = "ready"; clock = 0; held = 0;
    drawn.heading = NaN;
    info = floatInfo(heading, state.rho);
    fig.stage.classList.add("ws-ready");
    say(G.ready);
    fig.announce(G.readyShort);
    fig.run();
  }
  // the first grab of the board (pointer, slider or keys) starts the clock and the physics
  function start() {
    if (phase !== "ready") return;
    phase = "playing";
    clock = 0; held = 0;
    fig.stage.classList.remove("ws-ready");
    say(G.playing);
    fig.announce(G.playingShort);
  }

  function stateWord(i) {
    if (phase === "ready") return S.ready;
    if (i.tPosition) return S.t;
    if (atLimit && limited) return S.limit;
    if (i.square <= T_BAND) return S.square;
    if (i.onDeck && Math.abs(state.rate) < 0.005) return S.deck;
    if (Math.abs(state.rate) > 0.01) return S.swing;
    return S.rest;
  }
  function words(i, now) {
    const word = stateWord(i);
    const extra = phase === "playing" ? (i.tPosition && Math.abs(state.rate) < SETTLED ? fill(G.holding, { held: held.toFixed(1), hold: HOLD }) : fill(G.timer, { t: clock.toFixed(1) })) : phase === "won" ? fill(G.wonShort, { t: wonAt.toFixed(1) }) : "";
    fig.readout(fill(captions.readout, { board: boardAngle(), rig: rigAngle(i), state: word }) + (extra ? ` · ${extra}` : ""));
    const torque = Math.abs(i.wind).toFixed(1);
    let why;
    if (phase === "ready") why = W.ready;
    else if (atLimit && limited && !i.tPosition) why = fill(W.limit, { limit: LIMIT });
    else if (i.tPosition) why = W.t;
    else if (i.square <= T_BAND) why = fill(W.square, { board: boardAngle() });
    else if (word === S.deck) why = fill(W.deck, { hold: i.hold.toFixed(1), torque });
    else if (word === S.swing) why = fill(W.swing, { lever: C.floatDragLever.toFixed(1), torque });
    else why = fill(W.rest, { board: boardAngle() });
    fig.why(why, now);
    fig.value(boardAngle(), `Board ${boardAngle()} degrees to the wind, rig ${rigAngle(i)} degrees to the board, ${word}.`);
  }

  fig.onTick = (dt, now, calm) => {
    const live = phase !== "ready" || fig.replay;
    const ease = (v, t, s) => (calm ? t : Math.abs(t - v) < 0.01 ? t : v + (t - v) * (1 - Math.exp(-dt / s)));
    // the board turns toward its target, carrying the mast foot; the rig stays where the water holds it
    // turning past the limit is stopped; "feet in the way" shows for a moment after each stop
    const asked = headingTarget;
    headingTarget = clampHeading(headingTarget);
    if (Math.abs(asked - headingTarget) > 0.01) limitUntil = fig.clock + 0.8;
    heading = ease(heading, headingTarget, 0.35);
    state.heading = heading;
    if (live) {
      if (calm) { for (let i = 0; i < 300; i++) floatStep(state, 0.1); state.rate = 0; }
      info = floatStep(state, calm ? 0 : dt);
    } else info = floatInfo(heading, state.rho, 0);
    // a rig that swings past the limit carries the board round with it
    if (limited) {
      const kept = clampHeading(heading);
      if (Math.abs(kept - heading) > 1e-6) {
        headingTarget += kept - heading;
        heading = state.heading = kept;
        info = floatInfo(heading, state.rho, state.rate);
        limitUntil = fig.clock + 0.8;
      }
    }
    atLimit = limited && fig.clock < limitUntil;
    if (phase === "playing") {
      clock += dt;
      held = info.tPosition && Math.abs(state.rate) < SETTLED ? held + dt : 0;
      if (held >= HOLD) {
        phase = "won";
        wonAt = clock;
        best = best == null ? clock : Math.min(best, clock);
        say(fill(G.won, { t: clock.toFixed(1), best: best.toFixed(1) }));
        fig.announce(fill(G.wonShort, { t: clock.toFixed(1) }));
        progressPass();
      }
    }
    // green while the board is square to the rig, wherever the rig points; a stronger green once it is
    // the full T (also across the wind): that is the moment to lift
    const square = phase !== "ready" && info.square <= T_BAND;
    const go = square && Boolean(info.tPosition);
    const look = go ? "t" : square ? "square" : "";
    if (look !== drawn.go) { boardEl.classList.toggle("ws-go", square); boardEl.classList.toggle("ws-go-t", go); drawn.go = look; }
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
  // winning the game counts as the T challenge on the saved progress
  const progressPass = () => fig.progress.pass("f1-t");

  // ---- pointer: grab the board by its hull and turn it about the mast foot ----
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
    if (fig.replay) return;
    const w = worldAt(e);
    if (!onHull(toBoard(w), -8)) return;               // only the board can be grabbed
    grab = { from: angleAt(w), heading: headingTarget };
    start();
    fig.stage.classList.add("ws-grabbing");
    try { fig.stage.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    fig.steer();
  });
  fig.stage.addEventListener("pointermove", (e) => {
    if (!grab) return;
    headingTarget = grab.heading + wrap(angleAt(worldAt(e)) - grab.from);
    fig.steer();
  });
  for (const name of ["pointerup", "pointercancel"]) fig.stage.addEventListener(name, () => { grab = null; fig.stage.classList.remove("ws-grabbing"); fig.run(); });

  fig.keys({
    ArrowRight: (e) => { start(); headingTarget -= e.shiftKey ? 10 : 2; },
    ArrowLeft: (e) => { start(); headingTarget += e.shiftKey ? 10 : 2; },
    Home: () => reset(),
  });

  // ---- challenge: nose to wind ----
  fig.tasks = [{ ok: () => Math.abs(wrap(heading)) < 15 && info.onDeck && Math.abs(state.rate) < 0.01 }];
  fig.onTask = (i) => {
    if (i < 0) { targetEl.style.opacity = "0"; reset(); return; }
    limited = false;                                     // the challenge lets the rig swing over the deck
    heading = headingTarget = state.heading = 90;
    state.rho = 0; state.rate = 0;
    phase = "playing"; clock = 0; held = 0;
    fig.stage.classList.remove("ws-ready");
    targetEl.setAttribute("d", rimMark(WIND_TO + 180, 30));
    drawn.heading = NaN;
    targetEl.style.opacity = "1";
  };

  // ---- mistake: the rig starts upwind of the board ----
  fig.onMistake = () => {
    targetEl.style.opacity = "0";
    limited = false;                                     // the replay lets the rig swing over the deck
    heading = headingTarget = state.heading = 90;
    state.rho = 176; state.rate = 0;
    phase = "playing"; clock = 0; held = 0;
    fig.stage.classList.remove("ws-ready");
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

  fig.probe = () => ({ heading, rho: state.rho, rate: state.rate, phi: info.phi, onDeck: info.onDeck, t: info.tPosition, phase, held });
  reset();
  draw(performance.now(), true);
  words(info, 0);
  fig.run();
  return fig;
}
