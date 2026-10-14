// F2 · the page: pull the rig up, watch the meter and the recorder. Everything comes from uphaulStep.
import { createFigure, fill } from "../../packages/windsurf/ui.js";
import { uphaulStart, uphaulStep, uphaulLoad, PULLS, BASE_ANGLE } from "../../packages/windsurf/physics/rig-water.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";
import { P, FAN, TELL, RECORDER, scene } from "./figure.mjs";

const N = (v) => Math.round(Math.abs(v));

export function mount(root, { captions, store = false }) {
  captions.tasks.forEach((t) => { t.say = fill(t.say, { backTarget: C.backTarget, target: C.uphaulTarget }); });
  const fig = createFigure(root, { id: "f2-uphaul", captions, store });
  const $ = fig.$;
  const boardEl = $('[data-part="board"]'), bladesEl = $('[data-part="blades"]'), pennantEl = $('[data-part="pennant"]');
  const traceEl = $('[data-part="trace"]'), penEl = $('[data-part="pen"]');
  const W = captions.why, Cc = captions.controls;

  let pull = "slow", style = "legs", run = uphaulStart({ pull, style }), pulling = false, fan = 0, lit = false;
  const drawn = { theta: NaN, water: NaN, tension: NaN, style: "" };

  const choicePull = fig.choice("pull", { get: () => pull, set: (v) => { pull = v; reset(); } });
  const choiceStyle = fig.choice("style", { get: () => style, set: (v) => { style = v; reset(); } });
  const pullBtn = fig.button("pull", () => { if (run.done || pulling) reset(); else start(); fig.steer(); });
  fig.button("reset", () => { reset(); fig.steer(); });

  function reset() {
    run = uphaulStart({ pull, style });
    pulling = false;
    lit = false;
    drawn.theta = NaN;
    choicePull.sync(); choiceStyle.sync();
    fig.run();
  }
  function start() {
    if (run.done || run.t > 0) run = uphaulStart({ pull, style });
    pulling = true;
    fig.run();
  }

  const draw = fig.throttle(() => {
    boardEl.innerHTML = scene({ theta: run.theta, water: run.water, tension: run.tension, style: run.style, lever: run.t > 0, litLever: lit }).svg;
    drawn.theta = run.theta; drawn.water = run.water; drawn.tension = run.tension; drawn.style = run.style;
  });

  function words(now) {
    fig.readout(fill(captions.readout, { tension: N(run.tension), theta: N(run.theta), water: run.water.toFixed(1) }));
    let why;
    if (run.done) {
      why = fill(W.done, { peak: N(run.peak), peakAt: N(run.peakAt), back: N(run.backPeak), verdict: fill(run.peak < C.uphaulTarget ? W.under : W.over, { target: C.uphaulTarget }) });
    } else if (run.t === 0) {
      why = fill(W.ready, { water: run.water.toFixed(0) });
    } else {
      const l = run.load;
      const dyn = l.parts.inertia + l.parts.suction;
      why = fill(W.pulling, { lever: N(l.lever * 100), moment: N(l.moment), rig: N(l.parts.rig), wet: N(l.parts.wet), extra: dyn > 8 ? fill(W.extra, { dyn: N(dyn) }) : "", tension: N(l.tension) });
    }
    fig.why(why, now, run.done);
    if (pullBtn) pullBtn.textContent = run.done ? "Again" : pulling ? "Pulling" : "Pull";
    const outPull = $('[data-out="pull"]'), outStyle = $('[data-out="style"]');
    if (outPull) outPull.textContent = fill(Cc.pull.value, { seconds: PULLS[pull] });
    if (outStyle) outStyle.textContent = run.done ? `back ${N(run.backPeak)} N·m` : `back ${N(run.load ? run.load.back.moment : 0)} N·m`;
  }

  // idle tour: try each way of pulling in turn, a goal at a time
  const TOUR = [["slow", "legs"], ["snatch", "legs"], ["steady", "back"], ["slow", "legs"]];
  let tourAt = -1, tourPause = 0;
  function tour(dt) {
    if (pulling) return;
    tourPause += dt;
    if (tourPause < (run.done ? 3 : 1.2)) return;
    tourAt = (tourAt + 1) % TOUR.length;
    [pull, style] = TOUR[tourAt];
    choicePull.sync(); choiceStyle.sync();
    run = uphaulStart({ pull, style });
    pulling = true;
    tourPause = 0;
  }

  fig.onTick = (dt, now, calm) => {
    if (fig.touring && !fig.replay) tour(dt);
    if (pulling) {
      if (calm) while (!run.done) uphaulStep(run, 1 / 60);
      else uphaulStep(run, dt);
      if (run.done) { pulling = false; tourPause = 0; }
    }
    if (run.t === 0) run.load = uphaulLoad({ theta: 0, water: run.water, style: run.style });
    const moved = Math.abs(run.theta - drawn.theta) > 0.05 || Math.abs(run.water - drawn.water) > 0.05 || Math.abs(run.tension - drawn.tension) > 1 || run.style !== drawn.style;
    if (moved) draw(now, calm || !pulling);
    fan += dt * (calm ? 0 : 14);
    bladesEl.innerHTML = FAN.blades(P, fan);
    pennantEl.setAttribute("d", TELL.pennant(P, calm ? 0.3 : fig.clock, 1));
    traceEl.setAttribute("d", RECORDER.trace(P, run.trace));
    penEl.innerHTML = RECORDER.pen(P, run.theta, run.tension);
    words(now);
    fig.value(N(run.theta), `Mast ${N(run.theta)} degrees, tension ${N(run.tension)} newtons, ${run.water.toFixed(1)} kilograms of water on the sail.`);
    return pulling || fig.touring;
  };

  fig.pointer((_, pressed) => { if (pressed && !pulling) { if (run.done) reset(); start(); } });
  fig.keys({
    " ": () => { if (run.done || pulling) reset(); else start(); },
    Enter: () => { if (run.done || pulling) reset(); else start(); },
    1: () => { pull = "slow"; reset(); },
    2: () => { pull = "steady"; reset(); },
    3: () => { pull = "snatch"; reset(); },
    l: () => { style = "legs"; reset(); },
    b: () => { style = "back"; reset(); },
    Home: () => reset(),
  });

  // ---- challenges: pass on a finished pull that stays under the marks ----
  fig.tasks = [
    { ok: () => run.done && run.peak < C.uphaulTarget },
    { ok: () => run.done && run.peak < C.uphaulTarget && run.backPeak < C.backTarget },
  ];
  fig.onTask = (i) => { reset(); };

  // ---- mistake: a snatch with a bent back ----
  fig.onMistake = () => {
    pull = "snatch"; style = "back";
    reset();
    lit = true;
    let t = 0;
    return {
      step(dt, calm) {
        t += dt;
        if (t > 0.8 && !pulling && !run.done) start();
        return calm ? (start(), true) : run.done && t > 2.5;
      },
    };
  };

  fig.probe = () => ({ theta: run.theta, peak: run.peak, back: run.backPeak, done: run.done, pulling });
  draw(performance.now(), true);
  words(0);
  fig.run();
  return fig;
}
