// The learning layer every figure shares: a frame loop that stops offscreen and under reduced motion,
// controls under the card, the live "why" sentence, challenges with held pass checks, the mistake replay,
// an idle tour that steers toward goals, saved progress and the accessibility hooks.
// Runs in the page. `root` is a Document or a ShadowRoot, so the same code serves the review page and
// the <ws-figure> web component.

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Saved progress: localStorage on the website build only, with a no-storage fallback.
export function progressStore(namespace, enabled) {
  const key = `ws-progress:${namespace}`;
  let memory = {};
  const read = () => {
    if (!enabled) return memory;
    try { return JSON.parse(localStorage.getItem(key) || "{}"); } catch { return memory; }
  };
  return {
    passed: (id) => Boolean(read()[id]),
    pass(id) {
      memory = { ...read(), [id]: Date.now() };
      if (!enabled) return;
      try { localStorage.setItem(key, JSON.stringify(memory)); } catch { /* storage off: keep it in memory */ }
    },
  };
}

// Fill a template like "The sail pushes {drag} N" from values.
export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (_, name) => (values[name] ?? `{${name}}`));

export function createFigure(root, { id, captions, store = false, tour = true }) {
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => [...root.querySelectorAll(sel)];
  const stage = $(".iso-stage");
  const readoutEl = $("[data-readout]");
  const whyEl = $("[data-why]");
  const taskEl = $("[data-task]");
  const liveEl = $("[data-live]");
  const mistakeBtn = $("[data-mistake]");
  const still = matchMedia("(prefers-reduced-motion: reduce)");
  const progress = progressStore(id, store);
  const fig = {
    root, stage, still, captions, progress, $, $$,
    clock: 0, visible: true, frame: 0, last: 0,
    touring: tour && !still.matches, tourClock: 0, idleTimer: 0,
    task: -1, held: 0, passed: false,
    replay: null,
    onTick: () => true,
    onTask: () => {},
    onMistake: () => null,
    onSteer: () => {},
    probe: () => ({}),
  };
  // a read-only window on the model for the checks (scripts/check.mjs): stage.__fig.probe()
  stage.__fig = fig;

  // ---- words ----
  let whyAt = 0, sayLive = "";
  fig.readout = (text) => { if (readoutEl && readoutEl.textContent !== text) readoutEl.textContent = text; };
  fig.why = (text, now, force = false) => {
    if (!whyEl) return;
    if (!force && now - whyAt < 400) return;
    whyAt = now;
    if (whyEl.textContent !== text) whyEl.textContent = text;
  };
  fig.announce = (text) => { if (liveEl && text !== sayLive) { sayLive = text; liveEl.textContent = text; } };
  fig.value = (now, text) => { stage.setAttribute("aria-valuetext", text); if (now != null) stage.setAttribute("aria-valuenow", String(now)); };

  // ---- loop ----
  function tick(now) {
    const dt = fig.last ? Math.min((now - fig.last) / 1000, 1 / 30) : 1 / 60;
    fig.last = now;
    const calm = still.matches;
    fig.clock += dt;
    if (fig.touring && !calm && !fig.replay) fig.tourClock += dt;
    let keep = fig.onTick(dt, now, calm);
    if (fig.replay) {
      const done = fig.replay.step(dt, calm);
      keep = true;
      if (done) endReplay();
    }
    checkTask(dt);
    const checking = fig.task >= 0 && !fig.passed;
    fig.frame = fig.visible && (keep || fig.touring || checking) && !calm ? requestAnimationFrame(tick) : 0;
  }
  fig.run = () => {
    if (!fig.frame && fig.visible) {
      fig.last = 0;
      if (still.matches) tick(performance.now());
      else fig.frame = requestAnimationFrame(tick);
    }
  };
  fig.kick = fig.run;

  // offscreen: stop; back on screen: run
  try {
    new IntersectionObserver((entries) => {
      const e = entries[entries.length - 1];
      fig.visible = e.isIntersecting || e.intersectionRatio > 0;
      if (fig.visible) fig.run();
    }, { rootMargin: "120px 0px" }).observe(stage);
  } catch { fig.visible = true; }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) fig.run(); });
  still.addEventListener?.("change", () => { fig.touring = tour && !still.matches && fig.task < 0; fig.run(); });

  // ---- the reader takes over: stop the tour, resume it after a quiet spell ----
  fig.steer = () => {
    fig.touring = false;
    clearTimeout(fig.idleTimer);
    if (tour && fig.task < 0 && !fig.replay)
      fig.idleTimer = setTimeout(() => {
        fig.touring = !still.matches && fig.task < 0 && !fig.replay;
        fig.tourClock = 0;
        fig.onSteer(true);
        fig.run();
      }, 9000);
    fig.onSteer(false);
    fig.run();
  };

  // ---- controls ----
  // A range input bound to a getter/setter, with a live value label and aria-valuetext.
  fig.slider = (name, { get, set, format }) => {
    const input = $(`[data-ctl="${name}"]`), out = $(`[data-out="${name}"]`);
    if (!input) return { sync() {} };
    input.addEventListener("input", () => { set(Number(input.value)); fig.steer(); });
    return {
      input,
      sync(value = get()) {
        if (document.activeElement !== input && Math.abs(Number(input.value) - value) > Number(input.step || 1) / 2) input.value = String(Math.round(value / Number(input.step || 1)) * Number(input.step || 1));
        const text = format(value);
        if (out && out.textContent !== text) out.textContent = text;
        input.setAttribute("aria-valuetext", text);
      },
    };
  };
  // A group of buttons where one is chosen.
  fig.choice = (name, { get, set }) => {
    const buttons = $$(`[data-choice="${name}"] button`);
    buttons.forEach((b) => b.addEventListener("click", () => { set(b.dataset.value); fig.steer(); sync(); }));
    const sync = () => buttons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.value === get())));
    sync();
    return { sync };
  };
  fig.button = (name, handler) => { const b = $(`[data-act="${name}"]`); if (b) b.addEventListener("click", () => { handler(); fig.run(); }); return b; };

  // ---- challenges ----
  const taskButtons = $$("[data-lesson]");
  taskButtons.forEach((b, i) => {
    if (progress.passed(captions.tasks[i].id)) b.dataset.done = "true";
    b.addEventListener("click", () => startTask(i));
  });
  fig.tasks = [];                              // per task: { start(), check(dt) -> bool, target() }
  function startTask(i) {
    stopReplay();
    fig.task = fig.task === i ? -1 : i;
    fig.touring = false;
    clearTimeout(fig.idleTimer);
    fig.held = 0;
    fig.passed = false;
    taskButtons.forEach((b, j) => b.setAttribute("aria-pressed", String(j === fig.task)));
    if (fig.task < 0) {
      taskEl.hidden = true;
      fig.onTask(-1);
      fig.steer();
      return;
    }
    const T = captions.tasks[fig.task];
    taskEl.innerHTML = `<b>${T.title}</b> ${T.say}`;
    taskEl.hidden = false;
    fig.onTask(fig.task);
    fig.announce(`Challenge: ${T.title}`);
    fig.run();
  }
  fig.startTask = startTask;
  function checkTask(dt) {
    if (fig.task < 0 || fig.passed || fig.replay) return;
    const check = fig.tasks[fig.task];
    const T = captions.tasks[fig.task];
    if (!check) return;
    const ok = check.ok(dt);
    fig.held = ok ? fig.held + dt : 0;
    if (ok === "fail") fig.held = 0;
    if (fig.held >= (T.hold ?? 1.5)) {
      fig.passed = true;
      taskButtons[fig.task].dataset.done = "true";
      progress.pass(T.id);
      taskEl.innerHTML = `<b>${T.title}</b> ${T.say}<br><br>✓ ${T.done}`;
      fig.announce(`Passed: ${T.title}`);
    }
  }

  // ---- mistake replay ----
  function stopReplay() {
    if (!fig.replay) return;
    fig.replay = null;
    mistakeBtn?.setAttribute("aria-pressed", "false");
  }
  function endReplay() {
    const M = captions.mistake;
    fig.replay = null;
    mistakeBtn?.setAttribute("aria-pressed", "false");
    if (mistakeBtn) mistakeBtn.dataset.done = "true";
    taskEl.innerHTML = `<b>${M.title}</b> ${M.done}`;
    taskEl.hidden = false;
    fig.announce(`Replay finished: ${M.title}`);
  }
  if (mistakeBtn)
    mistakeBtn.addEventListener("click", () => {
      if (fig.replay) { stopReplay(); fig.steer(); return; }
      fig.task = -1;
      taskButtons.forEach((b) => b.setAttribute("aria-pressed", "false"));
      fig.touring = false;
      clearTimeout(fig.idleTimer);
      fig.replay = fig.onMistake();
      if (!fig.replay) return;
      mistakeBtn.setAttribute("aria-pressed", "true");
      const M = captions.mistake;
      taskEl.innerHTML = `<b>${M.title}</b> ${M.say}`;
      taskEl.hidden = false;
      fig.announce(`Replaying: ${M.title}`);
      fig.run();
    });

  // ---- pointer and keys on the drawing ----
  stage.style.touchAction = "pan-y";
  fig.pointer = (handler) => {
    let pressed = false;
    const svg = stage.querySelector("svg");
    const share = (e) => {
      const box = svg.getBoundingClientRect();
      return [clamp((e.clientX - box.left) / box.width, 0, 1), clamp((e.clientY - box.top) / box.height, 0, 1)];
    };
    stage.addEventListener("pointermove", (e) => { if (e.pointerType === "mouse" || pressed) { handler(share(e), pressed, e); fig.steer(); } });
    stage.addEventListener("pointerdown", (e) => { pressed = true; handler(share(e), true, e); fig.steer(); });
    for (const name of ["pointerup", "pointercancel", "pointerleave"]) stage.addEventListener(name, () => { pressed = false; });
  };
  fig.keys = (map) => {
    stage.addEventListener("keydown", (e) => {
      const f = map[e.key] || (e.key.length === 1 ? map[e.key.toLowerCase()] : null);
      if (!f) return;
      e.preventDefault();
      stopReplay();
      f(e);
      fig.steer();
    });
    stage.addEventListener("focus", () => fig.announce(stage.getAttribute("aria-valuetext") || ""));
  };

  // Redraw throttling: a part that costs c ms to draw is redrawn at most every 1.25·c ms while moving,
  // and always once it settles. Never compare against an uninitialised NaN: `at` starts at -Infinity.
  fig.throttle = (draw) => {
    let at = -Infinity, cost = 16;
    return (now, force = false) => {
      if (!force && now - at < cost * 1.25) return false;
      const t0 = performance.now();
      draw();
      const took = performance.now() - t0;
      // the 90th percentile of the last 60 redraws, for the checks
      (fig.costs ||= []).push(took);
      if (fig.costs.length > 60) fig.costs.shift();
      fig.drawCost = [...fig.costs].sort((a, b) => a - b)[Math.floor(0.9 * (fig.costs.length - 1))];
      cost = Math.max(10, took);
      at = now;
      return true;
    };
  };

  return fig;
}
