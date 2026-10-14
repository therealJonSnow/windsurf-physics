// node figures/f3-base-position/build.mjs   → f3-base-position.html, -light.html, -dark.html
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildFigure } from "../../packages/windsurf/build-figure.mjs";
import { WIDTH, HEIGHT, P, TELL, CONSOLE, FAN, staticBack, staticMid, staticFront, scene } from "./figure.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));

export const VERIFY = ["wind", "baseMastAngle", "flagDrag", "tiltMax", "driftDamping", "clewDamping", "baseInertia", "sailorHeight", "sailorMass"];

export function svgBody() {
  return [
    `<g data-part="back">${staticBack()}</g>`,
    `<g data-part="blades">${FAN.blades(P, 0)}</g>`,
    `<g data-part="mid">${staticMid()}</g>`,
    `<path class="iso-line ws-target" data-tone="lit" data-part="target" style="opacity:0" d=""/>`,
    `<g data-part="board">${scene(90, 0).svg}</g>`,
    `<g data-part="front">${staticFront()}</g>`,
    `<path class="ws-pennant" data-part="pennant" d="${TELL.pennant(P, 0.3)}"/>`,
    `<path class="iso-line" data-tone="lit" data-part="needle" style="stroke-width:1.1" d="${CONSOLE.needle(P, 0)}"/>`,
    `<path class="iso-line" data-tone="hi" data-part="pointer" style="stroke-width:1.1" d="${CONSOLE.pointer(P, 0, 0)}"/>`,
  ].join("");
}

export const CONTROLS = [{ type: "range", name: "tilt", label: "Tilt", min: -30, max: 30, step: 1, value: 0 }];

export async function build(options = {}) {
  return buildFigure({ id: "f3-base-position", dir: HERE, width: WIDTH, height: HEIGHT, svgBody: svgBody(), controls: CONTROLS, verify: VERIFY, ...options });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await build();
