// node build.mjs --audit: the Anatomy audit over a figure's static parts. Every bench, tank, fan,
// telltale, console and recorder solid records its true shape while the static art is drawn; then
// A.settle measures depth wherever two overlap and A.audit runs every check (support, sunk pairs,
// clearance, stand-in shapes, depth order). The moving board, rig and sailor are not recorded yet.
import * as A from "../../.claude/skills/anatomy/kit/audit.mjs";
import { recordInto } from "./bench.mjs";

// The fan's housing is a hollow ring drawn first, its guard, motor and hub inside it after: a concave
// part around its own contents, which no single painter's key can order. Listed here, not biased away.
const ALLOW = [["fan.housing", "fan.guard*"], ["fan.housing", "fan.motor"], ["fan.housing", "fan.hub"]];

export function auditStatic(P, draw, { label = "" } = {}) {
  const R = A.recorder(P);
  recordInto({ R, A });
  try { draw(); } finally { recordInto(null); }
  A.settle(R, P);
  if (label) console.log(`audit · ${label} · ${R.items.length} items, ${R.solids.length} solids`);
  const before = process.exitCode;
  A.auditOrExit(R, P, { argv: ["node", "build", "--audit"], allow: ALLOW });
  return { failed: process.exitCode && process.exitCode !== before, R };
}
