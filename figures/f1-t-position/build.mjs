// node figures/f1-t-position/build.mjs   → f1-t-position.html, -light.html, -dark.html
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigure } from "../../packages/windsurf/build-figure.mjs";
import { auditStatic } from "../../packages/windsurf/audit-static.mjs";
import { WIDTH, HEIGHT, P, TELL, CONSOLE, FAN, staticBack, staticMid, staticFront, scene } from "./figure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const VERIFY = ["wind", "floatDragArea", "floatDragLever", "floatDamping", "floatInertia", "deckFriction", "deckShare", "rigMass"];

export function svgBody() {
  return [
    `<g data-part="back">${staticBack()}</g>`,
    `<g data-part="blades">${FAN.blades(P, 0)}</g>`,
    `<g data-part="mid">${staticMid()}</g>`,
    `<path class="iso-line ws-target" data-tone="lit" data-part="target" style="opacity:0" d=""/>`,
    `<g data-part="board">${scene(90, 60).svg}</g>`,
    `<g data-part="front">${staticFront()}</g>`,
    `<path class="ws-pennant" data-part="pennant" d="${TELL.pennant(P, 0.3)}"/>`,
    `<path class="iso-line" data-tone="hi" data-part="pointer0" style="stroke-width:1.1" d="${CONSOLE.pointer(P, 0, 0)}"/>`,
    `<path class="iso-line" data-tone="hi" data-part="pointer1" style="stroke-width:1.1" d="${CONSOLE.pointer(P, 1, 0)}"/>`,
  ].join("");
}

export const CONTROLS = [
  { type: "range", name: "board", label: "Board", min: 0, max: 360, step: 1, value: 90 },
  { type: "buttons", name: "rig", label: "Rig", buttons: [{ name: "reset", label: "New start" }] },
];

export async function build(options = {}) {
  return buildFigure({ id: "f1-t-position", dir: HERE, width: WIDTH, height: HEIGHT, svgBody: svgBody(), controls: CONTROLS, verify: VERIFY, ...options });
}

export async function audit() {
  return auditStatic(P, () => { staticBack(); staticMid(); staticFront(); }, { label: "f1-t-position" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--audit")) await audit();
  else await build();
}
