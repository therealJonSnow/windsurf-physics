// Every number the physics uses that the instructor still has to sign off.
// `value` is the starting value from the build brief or the steering demo; `verify: true` marks it as
// not yet confirmed. The review pages list these under each figure, so nothing hides in the code.
// Full-size SI units throughout; the drawing is at 1:1.8 (see UNIT_CM in sail.mjs).

export const VERIFY = {
  // ---- world ----
  wind: { value: 4, unit: "m/s", verify: true, note: "8 knots, a light learning breeze (steering demo)." },
  rho: { value: 1.225, unit: "kg/m³", verify: false, note: "Air density at sea level." },
  g: { value: 9.81, unit: "m/s²", verify: false, note: "Gravity." },

  // ---- rig ----
  rigMass: { value: 9, unit: "kg", verify: true, note: "5 m² learner rig: mast, boom, sail and extension (brief: 8–10 kg)." },
  rigCg: { value: 1.6, unit: "m", verify: true, note: "Rig centre of gravity, measured up the mast from the foot." },
  uphaulAt: { value: 1.5, unit: "m", verify: true, note: "Where the uphaul is tied, up the mast from the foot (boom head)." },

  // ---- F1: rig floating flat ----
  floatDragArea: { value: 0.6, unit: "m²", verify: true, note: "Drag area (Cd·A) of the parts of a floating rig the wind can reach: mast, boom and the lifted edges of the sail." },
  floatDragLever: { value: 2.0, unit: "m", verify: true, note: "Where that drag acts along the mast, from the foot." },
  floatDamping: { value: 40, unit: "N·m·s", verify: true, note: "Water resisting the floating rig as it swings: sets how long the swing takes (about 5 s for 90°)." },
  floatInertia: { value: 60, unit: "kg·m²", verify: true, note: "Rig plus the water it carries, swinging about the mast foot." },
  deckFriction: { value: 0.5, unit: "", verify: true, note: "Friction of a wet mast and sail lying on the deck pad." },
  deckShare: { value: 0.5, unit: "", verify: true, note: "Share of the rig's weight that rests on the deck when the mast lies across it." },

  // ---- F2: uphaul ----
  waterLoad: { value: 15, unit: "kg", verify: true, note: "Water lying on the sail when the pull starts (brief: 10–20 kg equivalent)." },
  waterLever: { value: 1.2, unit: "m", verify: true, note: "Where that water sits, measured along the mast from the foot." },
  drainTime: { value: 3, unit: "s", verify: true, note: "Time constant for the water to run off the sail once the pull starts (brief: 2–4 s)." },
  dryAngle: { value: 45, unit: "°", verify: true, note: "Mast angle by which all the water has run off the sail." },
  floatAngle: { value: 35, unit: "°", verify: true, note: "Below this mast angle the water still carries part of the rig's weight and of the water on the sail." },
  suction: { value: 260, unit: "N·m·s", verify: true, note: "Extra moment per rad/s from tearing the sail off the water quickly." },
  pullSlow: { value: 7, unit: "s", verify: true, note: "Time to raise the rig with a slow pull." },
  pullSteady: { value: 3.5, unit: "s", verify: true, note: "Time to raise the rig with a steady pull." },
  pullSnatch: { value: 1.2, unit: "s", verify: true, note: "Time to raise the rig with a snatch." },
  uphaulTarget: { value: 250, unit: "N", verify: true, note: "Peak uphaul tension a learner should stay under (F2 challenge). The brief suggested 200 N, but with these starting numbers the best pull (slow, legs) peaks at about 240 N." },
  backTarget: { value: 100, unit: "N·m", verify: true, note: "Lower-back moment a learner should stay under while uphauling (F2 second challenge)." },

  // ---- F3: base position ----
  baseMastAngle: { value: 70, unit: "°", verify: true, note: "Mast angle above the water in the base position, sail flagging (brief: ~70°). The clew only touches the water below about 50°: see the clew height on F3." },
  flagDrag: { value: 0.2, unit: "", verify: true, note: "Drag coefficient of a flagging (luffing) sail, on its area." },
  clewDamping: { value: 25, unit: "N·m·s", verify: true, note: "Yaw damping from the clew dragging through the water (only while it touches)." },
  driftDamping: { value: 30, unit: "N·m·s", verify: true, note: "Yaw damping of a drifting board (centreboard and hull) with no way on." },
  baseInertia: { value: 45, unit: "kg·m²", verify: true, note: "Board, rig and sailor about the centreboard." },
  tiltMax: { value: 30, unit: "°", verify: true, note: "The most a learner tilts the rig toward the nose or the tail in the base position." },

  // ---- sailor ----
  sailorHeight: { value: 1.75, unit: "m", verify: true, note: "One generic adult (brief: 175 cm)." },
  sailorMass: { value: 75, unit: "kg", verify: true, note: "One generic adult (brief: 75 kg)." },

  // ---- steering demo (kept for F3 and phase 4) ----
  alphaTrim: { value: 18, unit: "°", verify: true, note: "Angle of attack the sheet holds when sailing." },
  heelMax: { value: 28, unit: "°", verify: true, note: "The most a sailor leans the rig to windward." },
  yawDamping: { value: 120, unit: "N·m·s", verify: true, note: "Fin and centreboard resisting yaw at reaching speed, scaled with speed." },
  sailInertia: { value: 38, unit: "kg·m²", verify: true, note: "Board and rig about the CLR (steering demo)." },
};

// Plain values, for the physics modules.
export const C = Object.fromEntries(Object.entries(VERIFY).map(([key, { value }]) => [key, value]));

// The rows a figure shows for sign-off.
export const verifyRows = (keys) => keys.map((key) => ({ key, ...VERIFY[key] }));
