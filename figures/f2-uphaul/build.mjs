// node figures/f2-uphaul/build.mjs   → f2-uphaul.html, -light.html, -dark.html
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigure } from "../../packages/windsurf/build-figure.mjs";
import { auditStatic } from "../../packages/windsurf/audit-static.mjs";
import { WIDTH, HEIGHT, P, TELL, FAN, RECORDER, staticBack, staticMid, staticFront, scene } from "./figure.mjs";
import { C } from "../../packages/windsurf/physics/constants.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const VERIFY = ["rigMass", "rigCg", "uphaulAt", "waterLoad", "waterLever", "drainTime", "dryAngle", "floatAngle", "suction", "pullSlow", "pullSteady", "pullSnatch", "uphaulTarget", "backTarget", "baseMastAngle", "sailorHeight", "sailorMass"];

export function svgBody() {
  return [
    `<g data-part="back">${staticBack()}</g>`,
    `<g data-part="blades">${FAN.blades(P, 0)}</g>`,
    `<g data-part="mid">${staticMid()}</g>`,
    `<g data-part="board">${scene({ theta: 0, water: C.waterLoad, tension: 0, style: "legs" }).svg}</g>`,
    `<g data-part="front">${staticFront()}</g>`,
    `<path class="iso-line" data-tone="hi" data-part="trace" style="stroke-width:1" d=""/>`,
    `<g data-part="rail">${RECORDER.rail(P)}</g>`,
    `<g data-part="pen">${RECORDER.pen(P, 0, 0)}</g>`,
    `<path class="ws-pennant" data-part="pennant" d="${TELL.pennant(P, 0.3)}"/>`,
  ].join("");
}

export const CONTROLS = [
  { type: "choice", name: "pull", label: "Pull", options: [{ value: "slow", label: "Slow" }, { value: "steady", label: "Steady" }, { value: "snatch", label: "Snatch" }] },
  { type: "choice", name: "style", label: "Lift with", options: [{ value: "legs", label: "Legs" }, { value: "back", label: "Back" }] },
  { type: "buttons", name: "act", label: "Rig", buttons: [{ name: "pull", label: "Pull" }, { name: "reset", label: "Lay it down" }] },
];

export async function build(options = {}) {
  return buildFigure({ id: "f2-uphaul", dir: HERE, width: WIDTH, height: HEIGHT, svgBody: svgBody(), controls: CONTROLS, verify: VERIFY, ...options });
}

export async function audit() {
  return auditStatic(P, () => { staticBack(); staticMid(); staticFront(); RECORDER.rail(P); }, { label: "f2-uphaul" });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--audit")) await audit();
  else await build();
}
