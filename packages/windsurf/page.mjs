// Page assembly at build time: the card, the controls under it, the "why" line, challenges, the mistake
// button, the constants still to sign off, and the review page around them. The same markup goes into
// the <ws-figure> web component's shadow root.
import { k } from "./kit.mjs";

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

export const WS_CSS = `
.ws-root{--ws-water:#16191c;--ws-film:#1d2226;--ws-wet:#2a3a46}
.ws-root[data-theme="light"]{--ws-water:#e9edf0;--ws-film:#eef1f3;--ws-wet:#c9d9e4}
.ws-root{color:var(--anatomy-text);font:14px/1.6 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
.ws-water{fill:var(--ws-water)}
.ws-inner{fill:var(--anatomy-shade-0)}
.ws-window{fill:var(--ws-film);stroke:none}
.ws-film{fill:var(--ws-wet);stroke:none}
.ws-pennant{fill:var(--anatomy-shade-2);stroke:var(--anatomy-lo);stroke-width:.6;stroke-linejoin:round}
.ws-plumb{stroke-width:.9}
.ws-target{stroke-width:2.2}
.ws-lever{stroke-width:1.4}
.ws-wake{fill:none;stroke:var(--anatomy-lo);stroke-width:.6}
.ws-root{--ws-go:#30a46c;--ws-go-fill:#e3f4ea;--ws-go-shade:#cfe9d9}
.ws-root[data-theme="dark"]{--ws-go:#6be0a0;--ws-go-fill:#123222;--ws-go-shade:#0e281b}
.ws-go .iso-solid>.iso-fill,.ws-go .iso-solid>.iso-top,.ws-go .tb-body,.ws-go .tb-shine{fill:var(--ws-go-fill)}
.ws-go .iso-solid>.iso-shade[data-shade],.ws-go .tb-shade{fill:var(--ws-go-shade)}
.ws-go .iso-edge,.ws-go .tb-edge{stroke:var(--ws-go)}
.ws-go .iso-solid[data-seamless]>.iso-shade,.ws-go .iso-solid[data-seamless]>.iso-top{stroke:var(--ws-go-fill)}
.ws-go-t .iso-edge,.ws-go-t .tb-edge{stroke-width:1.4}
.ws-ready{cursor:grab}
.ws-grabbing{cursor:grabbing}
.iso-stage{outline:none;cursor:ew-resize}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.ws-panel{margin:18px 0 26px;display:grid;gap:14px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--anatomy-text)}
.ws-row{display:grid;grid-template-columns:72px 1fr 156px;align-items:center;gap:12px}
.ws-row>span{letter-spacing:.08em;text-transform:uppercase;color:var(--anatomy-muted)}
.ws-row output{color:var(--anatomy-strong);text-align:right}
.ws-row input{width:100%;accent-color:var(--anatomy-strong)}
.ws-choice{display:flex;flex-wrap:wrap;gap:6px}
.ws-panel button{font:inherit;font-size:11px;letter-spacing:.06em;text-transform:uppercase;padding:6px 10px;border:1px solid var(--anatomy-muted);background:transparent;color:var(--anatomy-text);border-radius:4px;cursor:pointer}
.ws-panel button[aria-pressed="true"]{border-color:var(--anatomy-strong);color:var(--anatomy-strong)}
.ws-panel button[data-done="true"]::after{content:" ✓"}
.ws-panel button.ws-mistake{border-style:dashed}
.ws-why{margin:0;font:14px/1.6 ui-sans-serif,system-ui,sans-serif;color:var(--anatomy-strong);min-height:4.8em}
.ws-lessons{display:flex;flex-wrap:wrap;gap:6px}
.ws-task{margin:0;padding:10px 12px;border-left:2px solid var(--anatomy-strong);font:13px/1.55 ui-sans-serif,system-ui,sans-serif;color:var(--anatomy-text)}
.ws-task[hidden]{display:none}
.ws-task b{color:var(--anatomy-strong);font-weight:600}
.ws-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.ws-verify{margin:8px 0 0;font:12px/1.5 ui-sans-serif,system-ui,sans-serif;color:var(--anatomy-muted)}
.ws-verify summary{cursor:pointer;letter-spacing:.06em;text-transform:uppercase;font:11px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.ws-verify table{width:100%;border-collapse:collapse;margin-top:8px}
.ws-verify td{padding:4px 6px;border-top:1px solid var(--anatomy-faint);vertical-align:top}
.ws-verify td:nth-child(2){white-space:nowrap;color:var(--anatomy-strong);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.ws-intro{margin:0 0 18px;color:var(--anatomy-text)}
.ws-intro h1{font-size:15px;font-weight:600;margin:0 0 6px;color:var(--anatomy-strong)}
@media (max-width:560px){.ws-row{grid-template-columns:56px 1fr 112px}.ws-root .iso-plate{padding:44px 8px 78px}.ws-root .iso-plate-corner[data-corner="readout"]{left:0;white-space:normal;text-align:right;line-height:1.35}.ws-root .iso-plate-corner[data-corner="hint"]{bottom:34px}}
`;

// Controls: { type: "range", name, label, min, max, step, value } | { type: "choice", name, label, options: [{ value, label }] }
//         | { type: "button", name, label }
function controlHtml(c) {
  if (c.type === "range")
    return `<label class="ws-row"><span>${esc(c.label)}</span><input type="range" data-ctl="${c.name}" min="${c.min}" max="${c.max}" step="${c.step ?? 1}" value="${c.value ?? 0}"><output data-out="${c.name}"></output></label>`;
  if (c.type === "choice")
    return `<div class="ws-row"><span>${esc(c.label)}</span><div class="ws-choice" role="group" aria-label="${esc(c.label)}" data-choice="${c.name}">${c.options.map((o) => `<button type="button" data-value="${o.value}" aria-pressed="false">${esc(o.label)}</button>`).join("")}</div><output data-out="${c.name}"></output></div>`;
  if (c.type === "buttons")
    return `<div class="ws-row"><span>${esc(c.label)}</span><div class="ws-choice">${c.buttons.map((b) => `<button type="button" data-act="${b.name}">${esc(b.label)}</button>`).join("")}</div><output data-out="${c.name}"></output></div>`;
  return "";
}

export function verifyTable(rows) {
  if (!rows.length) return "";
  return `<details class="ws-verify"><summary>Starting numbers to sign off · ${rows.filter((r) => r.verify).length}</summary><table>${rows
    .map((r) => `<tr><td>${esc(r.key)}</td><td>${esc(r.value)} ${esc(r.unit)}</td><td>${esc(r.note)}${r.verify ? "" : " (fixed)"}</td></tr>`)
    .join("")}</table></details>`;
}

// The whole figure: card, legend, panel. theme: "light" | "dark".
export function figureMarkup({ id, fig, title, hint, width, height, label, ariaLabel, svgBody, controls = [], captions, keys = [], caption = "", verify = [], theme = "light" }) {
  const svg = k.figureSvg({ width, height, label, body: svgBody });
  const stage = `<div class="iso-stage" tabindex="0" role="slider" aria-label="${esc(ariaLabel)}" aria-valuemin="0" aria-valuemax="100">${svg}</div>`;
  const plate = k.plateHtml({ fig, title, hint, readout: "", keys, caption, body: stage });
  const tasks = captions.tasks.map((t, i) => `<button type="button" data-lesson="${i}" aria-pressed="false">${esc(t.button)}</button>`).join("");
  const mistake = captions.mistake ? `<button type="button" class="ws-mistake" data-mistake aria-pressed="false">${esc(captions.mistake.button)}</button>` : "";
  const panel = `<div class="ws-panel">${controls.map(controlHtml).join("")}<p class="ws-why" data-why></p><div class="ws-lessons" role="group" aria-label="Challenges">${tasks}${mistake}</div><p class="ws-task" data-task hidden></p><p class="ws-sr" data-live aria-live="polite"></p></div>`;
  return `<div class="iso ws-root" data-theme="${theme}" data-figure="${id}">${plate}${panel}${verifyTable(verify)}</div>`;
}

// The review page: one figure, its intro, the theme fixed or following the system.
export function reviewPage({ title, intro = "", markup, script, theme = "auto" }) {
  const fixed = theme === "auto" ? "light" : theme;
  const follow = theme === "auto"
    ? `<script>try{const q=matchMedia("(prefers-color-scheme: dark)");const set=()=>{const t=q.matches?"dark":"light";document.body.dataset.theme=t;document.querySelectorAll(".ws-root").forEach((e)=>e.dataset.theme=t)};set();q.addEventListener("change",set)}catch(e){}</script>`
    : "";
  const page = k.pageHtml({ title, theme: fixed, body: `${intro ? `<header class="ws-intro">${intro}</header>` : ""}${markup}`, script, width: 680 });
  return page.replace("</style>", `${WS_CSS}</style>`).replace(/<main class="iso-page">/, `${follow}<main class="iso-page">`);
}
