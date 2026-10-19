// npm run check [-- f2] : the review checks for each built figure, using the Anatomy skill's scripts.
//   · captures at desktop (1440) and phone (390) width, both themes: console clean, no sideways scroll
//   · line ends at rest and in three posed states, both themes
//   · every challenge driven through the page's own controls until it passes
//   · the mistake replay runs to its end
//   · an idle-tour contact sheet, to check the parts really move
//   · the slowest redraw while moving
// Needs Chrome or Chromium: CHROME_PATH, or the preinstalled /opt/pw-browsers/chromium.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPTS = join(ROOT, ".claude", "skills", "anatomy", "scripts");
const SHOTS = join(ROOT, "shots");
mkdirSync(SHOTS, { recursive: true });
const env = { ...process.env };
if (!env.CHROME_PATH && existsSync("/opt/pw-browsers/chromium")) env.CHROME_PATH = "/opt/pw-browsers/chromium";
const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const ids = readdirSync(join(ROOT, "figures")).filter((d) => existsSync(join(ROOT, "figures", d, "build.mjs")) && (!only.length || only.some((o) => d.startsWith(o)))).sort();

const node = (script, args) => {
  const r = spawnSync(process.execPath, [join(SCRIPTS, script), ...args], { env, encoding: "utf8", timeout: 240000 });
  return { code: r.status, out: `${r.stdout || ""}${r.stderr || ""}` };
};
let n = 0;
const drive = (page, actions, extra = []) => {
  const file = join(SHOTS, `.actions-${n++}.json`);
  writeFileSync(file, JSON.stringify(actions));
  return node("drive.mjs", [page, "--actions", file, "--height", "1400", ...extra]);
};
const results = [];
const record = (id, what, ok, detail = "") => { results.push({ id, what, ok, detail }); console.log(`${ok ? "pass" : "FAIL"}  ${id}  ${what}${detail ? `  · ${detail}` : ""}`); };

const stage = "document.querySelector('.iso-stage')";
const keys = (key, count) => ["eval", `(() => { for (let i = 0; i < ${count}; i++) ${stage}.dispatchEvent(new KeyboardEvent('keydown', { key: '${key}', bubbles: true })); return ${count}; })()`];
const setRange = (name, value) => ["eval", `(() => { const s = document.querySelector('[data-ctl=${name}]'); s.value = ${value}; s.dispatchEvent(new Event('input')); return s.value; })()`];
const done = (sel, ms) => ["until", `document.querySelector('${sel}').dataset.done === 'true'`, ms];
// steer F3 by its tilt slider toward a heading, like a sailor (the tour's own law)
const steerF3 = (goal) => ["eval", `(() => { clearInterval(window.__steer); window.__steer = setInterval(() => { const p = ${stage}.__fig.probe(); const t = Math.max(-30, Math.min(30, -17 + 1.4 * (${goal} - ((p.heading + 540) % 360 - 180)) - 30 * p.rate)); const s = document.querySelector('[data-ctl=tilt]'); s.value = Math.round(t); s.dispatchEvent(new Event('input')); }, 100); return 'steering'; })()`];

const PLAN = {
  "f1-t-position": {
    // the game: nothing moves until the board is grabbed; then keep it square to the rig until it wins
    poses: [[keys("ArrowLeft", 4), ["wait", 1500]], [setRange("board", 0), ["wait", 7000]], [["click", "[data-mistake]"], ["wait", 5000]]],
    tasks: [
      [["eval", `(() => { const a = ${stage}.__fig.probe(); return new Promise((r) => setTimeout(() => { const b = ${stage}.__fig.probe(); r(a.phase === 'ready' && b.phase === 'ready' && a.rho === b.rho ? 'frozen' : 'MOVED'); }, 1500)); })()`],
       ["eval", `(() => { window.__play = setInterval(() => { const p = ${stage}.__fig.probe(); const want = 180 + p.rho; const h = [want - 90, want + 90].map((v) => v + 360 * Math.round((p.heading - v) / 360)).sort((a, b) => Math.abs(a - p.heading) - Math.abs(b - p.heading))[0]; const s = document.querySelector('[data-ctl=board]'); s.value = String(((Math.round(h) % 360) + 360) % 360); s.dispatchEvent(new Event('input')); }, 120); return 'playing'; })()`],
       ["until", `${stage}.__fig.probe().t && document.querySelector('[data-part=board]').classList.contains('ws-go')`, 30000],
       ["until", `${stage}.__fig.probe().phase === 'won'`, 40000],
       ["eval", "clearInterval(window.__play)"], ["click", "[data-act=reset]"], ["wait", 300],
       ["until", `${stage}.__fig.probe().phase === 'ready'`, 2000]],
      [["click", '[data-lesson="0"]'], ["wait", 200], setRange("board", 0), done('[data-lesson="0"]', 30000)],
    ],
    mistake: 40000,
    // no idle tour in the game: play it, so the sheet and the redraw cost see the parts moving
    sheet: [["eval", `(() => { window.__play = setInterval(() => { const p = ${stage}.__fig.probe(); const want = 180 + p.rho; const h = [want - 90, want + 90].map((v) => v + 360 * Math.round((p.heading - v) / 360)).sort((a, b) => Math.abs(a - p.heading) - Math.abs(b - p.heading))[0]; const s = document.querySelector('[data-ctl=board]'); s.value = String(((Math.round(h) % 360) + 360) % 360); s.dispatchEvent(new Event('input')); }, 120); return 'playing'; })()`]],
  },
  "f2-uphaul": {
    poses: [[keys(" ", 1), ["wait", 2500]], [["wait", 6000]], [keys("b", 1), keys("3", 1), keys(" ", 1), ["wait", 450]]],
    tasks: [
      [["click", '[data-lesson="0"]'], keys("1", 1), keys("l", 1), keys(" ", 1), done('[data-lesson="0"]', 20000)],
      [["click", '[data-lesson="1"]'], keys("1", 1), keys("l", 1), keys(" ", 1), done('[data-lesson="1"]', 20000)],
    ],
    mistake: 20000,
  },
  "f3-base-position": {
    poses: [[keys("ArrowRight", 20), ["wait", 2500]], [keys("ArrowLeft", 50), ["wait", 2500]], [["click", "[data-mistake]"], ["wait", 3000]]],
    tasks: [
      [["click", '[data-lesson="0"]'], steerF3(90), done('[data-lesson="0"]', 40000)],
      [["click", '[data-lesson="1"]'], steerF3(50), done('[data-lesson="1"]', 40000)],
      [["click", '[data-lesson="2"]'], steerF3(150), done('[data-lesson="2"]', 40000)],
    ],
    mistake: 30000,
  },
};

for (const id of ids) {
  const plan = PLAN[id];
  const page = (theme) => join(ROOT, "figures", id, `${id}-${theme}.html`);
  for (const theme of ["light", "dark"]) {
    for (const width of [1440, 390]) {
      const r = node("capture.mjs", [page(theme), "--out", join(SHOTS, `${id}-${theme}-${width}.png`), "--width", String(width), "--wait", "800"]);
      const clean = /console: clean/.test(r.out), scroll = /scrolls sideways: no/.test(r.out);
      record(id, `capture ${theme} ${width}px`, r.code === 0 && clean && scroll, `${clean ? "console clean" : "console errors"} · ${scroll ? "no sideways scroll" : "SCROLLS SIDEWAYS"}`);
    }
    const rest = node("lines.mjs", [page(theme), "--out", join(SHOTS, `${id}-${theme}-lines.png`)]);
    record(id, `line ends at rest, ${theme}`, rest.code === 0, (rest.out.match(/line ends: [^\n]*/) || ["?"])[0]);
    plan.poses.forEach((pose, i) => {
      const r = drive(page(theme), [["wait", 600], ...pose, ["lines", join(SHOTS, `${id}-${theme}-pose${i + 1}-lines.png`)]]);
      record(id, `line ends, pose ${i + 1}, ${theme}`, r.code === 0, (r.out.match(/line ends: [^\n]*/) || ["?"])[0]);
    });
  }
  plan.tasks.forEach((task, i) => {
    const r = drive(page("light"), [["wait", 600], ...task, ["eval", "document.querySelector('[data-task]').textContent.slice(0, 80)"]]);
    record(id, `challenge ${i + 1} passes`, r.code === 0 && !/timed out|MOVED/i.test(r.out));
  });
  const m = drive(page("light"), [["wait", 600], ["click", "[data-mistake]"], done("[data-mistake]", plan.mistake)]);
  record(id, "mistake replay runs to its end", m.code === 0 && !/timed out/i.test(m.out));
  const sheet = drive(page("light"), [["wait", 1200], ...(plan.sheet || []), ["sheet", join(SHOTS, `${id}-tour.png`), 1400, 8, null, 0.5], ["eval", `${stage}.__fig.drawCost`]]);
  const cost = Number((sheet.out.match(/eval: ([\d.]+)/) || [0, NaN])[1]);
  record(id, plan.sheet ? "play contact sheet" : "idle-tour contact sheet", sheet.code === 0, `shots/${id}-tour.png · read it`);
  record(id, "redraw under 25 ms", cost < 25, `${cost.toFixed(1)} ms`);
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} of ${results.length} checks passed${failed.length ? ` · ${failed.length} failed` : ""}`);
process.exitCode = failed.length ? 1 : 0;
