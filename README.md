# Windsurf learning figures

Interactive isometric figures that teach beginner windsurfing one lesson page at a time. Each figure shows the *why* behind a step as a real object on a bench: a board in a tank of water, a fan, a newton meter, a plumb line, a chart recorder. The page's text and video show the *how*. The figures support a lesson with an instructor; they don't replace one.

Built with the [Anatomy skill](https://github.com/wheresryan22/anatomy) (MIT). It is a git submodule at `.claude/skills/anatomy`, and the kit is used from there, so there's no copy to drift.

## Phase 1: "Uphauling and getting going" (ready for instructor review)

| Figure | Idea | Review pages |
| --- | --- | --- |
| F1 T-position weathervane | A rig lying flat on the water, hinged at the mast foot, swings downwind like a weathervane. The only start that stays put is the board across the wind with the rig downwind, square to it. | `figures/f1-t-position/f1-t-position.html` (`-light`, `-dark`) |
| F2 Uphaul load | The pull is hardest at the start, while water lies on the sail and the line's lever is short. Pulling slowly with the legs lets the water drain and spares the back. | `figures/f2-uphaul/f2-uphaul.html` |
| F3 Base position steering | With the sail flagging, tilting the rig toward the nose or the tail moves the sail's push ahead of or behind the centreboard and turns the board. | `figures/f3-base-position/f3-base-position.html` |

Open the HTML files straight from disk; they are self-contained. Each page has:

- **Controls** under the card, mirrored by keys and by pointer or touch on the drawing.
- **A live "why" sentence** built from the model, with the numbers filled in.
- **Challenges** with held pass checks. Passes are saved per learner on the website build only.
- **"Try the mistake"**, which replays the error and explains it.
- **An idle tour** that steers toward goals rather than playing a fixed script.
- **"Starting numbers to sign off"**, listing every constant the figure uses that still needs the instructor's confirmation.

Phase 1 stops here, for review. Phases 2–5 (F4–F6 and the steering port) haven't been started.

## Commands

```sh
git submodule update --init      # the Anatomy skill
npm install                      # esbuild
npm test                         # physics unit tests: signs and limits
npm run build                    # every figure, light, dark and system themes
npm run build -- f2              # one figure
npm run check                    # captures, line ends, challenges, mistake replays, tour sheets (needs Chrome: CHROME_PATH)
npm run site                     # site/dist: one ES module per figure defining <ws-figure>
node scripts/serve.mjs           # serve site/dist locally with the CORS header Vercel sends
```

Node 20.10 or later. The checks use the skill's `capture.mjs`, `drive.mjs` and `lines.mjs`, and write to `shots/` (git-ignored).

## Layout

```
packages/windsurf/
  physics/constants.mjs   every starting number, marked verify: true until signed off
  physics/sail.mjs        sail outline, CE, lift and drag, rig frames (from the steering demo)
  physics/board.mjs       speed by heading, sailing solve, yaw about the CLR (from the steering demo)
  physics/hull.mjs        the board's plan shape and heights
  physics/rig-water.mjs   F1 floating rig, F2 uphaul load with drainage, F3 flagging-sail steering
  physics/sailor.mjs      body proportions and masses, the uphaul posture, moments on the lower back
  mannequin.mjs           wooden mannequin: skeleton, two-bone IK, poses, CG, segment drawing
  rig.mjs                 board and rig drawing (sailing, flat, rising, flagging; clipped at the water)
  bench.mjs               bench, tank, fan, telltale, console and gauge, newton meter, chart recorder
  ui.js                   the shared learning layer (loop, controls, why, challenges, mistake, tour, a11y)
  page.mjs, build-figure.mjs   markup, review pages, esbuild bundling
figures/<id>/             figure.mjs (camera and parts), live.js (page), captions.json (all wording), build.mjs
site/                     element.js (<ws-figure>), build.mjs, framer/WsFigure.tsx, datocms/figure-block.json
tests/physics.test.mjs    sign and limit checks
scripts/check.mjs         the review checks
```

All wording is in `captions.json` per figure: captions, "why" templates, challenges and the mistake text. You can edit it without touching geometry; rebuild afterwards.

## Website

- `npm run site` writes `site/dist/<id>.js`: one self-contained module per figure, with the kit and modules inlined. Each one defines `<ws-figure name="<id>">`, which renders into shadow DOM, carries its own light and dark tokens, follows the system theme (or `theme="light|dark"`), and pauses offscreen. Attributes: `challenge="2"` opens a challenge first, `caption="…"` overrides the caption, `store="off"` disables saved progress.
- **Vercel:** `vercel.json` at the repo root builds `site/dist` and sends `Access-Control-Allow-Origin: *` on the modules, so Framer and sandboxed iframes can import them. Vercel has to fetch the submodule.
- **Framer:** `site/framer/WsFigure.tsx` is a code component. Set `BASE` to the deployment URL. Its properties are figure, theme, opening challenge and caption.
- **DatoCMS:** `site/datocms/figure-block.json` describes the "Figure" block: figure name, opening challenge, caption override and theme, plus how the front end renders it.
- `site/dist/index.html` shows all three figures on one page. `site/dist/iframe-test.html` loads F2 in an `<iframe sandbox="allow-scripts">`, where storage throws and the figure carries on without it.

## Decisions to check

- **Camera and wind.** A flagging sail lines up with the wind, so it reads broadside only when the wind blows across the view. But F3's subject is the tilt along the board, which runs into the screen when the board is across that same wind. So the wind blows at 45° to the view in every figure, from a fan at the back left. That's the same world in each figure.
- **Tank sizes.** F1 and F2 need a wide pool because the rig lies flat (R 272 and 212). In F3 the sail flies over the rim, so the tank only has to hold the board (R 112).
- **F2's challenge target is 250 N, not 200 N.** With the brief's starting numbers (9 kg rig, CG 1.6 m, uphaul at 1.5 m, 15 kg of water draining over 3 s), even the best pull (slow, with the legs) peaks at about 240 N. The rig's weight alone needs about 190 N near 20°, because the line pulls at a shallow angle to the mast. A second challenge asks for the lower back under 100 N·m.
- **Back versus legs.** The line's tension barely changes between the two styles; a bent back even pulls at a slightly better angle. The model's difference is the moment on the lower back. Leaning back with a straight back puts the upper body's weight behind the lower back, where it balances the line. Bent over, the weight hangs in front and adds to it. On a slow pull that's about 60 against 130 N·m.
- **F3 turning through the wind.** Close to the wind the flagging sail's push runs along the board, through the centreboard, so tilt alone stops turning the board (it stalls at about 16° off the wind). The brief's challenge, "turn the board to put the wind behind you (back in the T-position on the new side)", therefore isn't reachable by tilt in this model. F3 has three challenges instead: hold across the wind, head up to 50°, and bear away to 150°.
- **F3 neutral tilt.** The mast foot sits 54 cm ahead of the centreboard (from the steering demo), so with the rig upright the flagging sail's push acts ahead of it and the board slowly bears away. Holding course needs the rig leaned about 17° toward the tail.
- **Mistakes.** F1 (rig upwind) and F2 (snatch with a bent back) are from the brief. F3's ("tilting toward the nose to point higher") is a placeholder until you rank the mistakes you see.

## Open questions for the instructor

1. **Uphaul numbers (F2):** rig mass, water on the sail and its drain time, the peak tension a learner should stay under (see above), and whether the lower-back challenge is worth keeping.
2. **Base position (F3):** mast angle and clew. The brief says the mast is about 70° up with the clew just touching the water, but with a boom square to the mast those can't both hold. At 70° the clew is about 78 cm above the water, and it touches only at about 50°. Which is right, and how does a flagging sail's drag steer the board? Is the 54 cm from mast foot to centreboard right for a drifting learner board?
3. **Turning in the base position:** what should the "new side" challenge be, given that tilt alone can't take the board through the wind here? Do learners step the board round with their feet, use momentum, or something else?
4. **Mistakes:** which ones to replay per figure, ranked by how often you see them.
5. **Mannequin:** one generic adult (175 cm, 75 kg, as built), or a smaller and a larger sailor to show lever differences?
6. **Stance (for F4–F6):** a straight front arm from the start, or a closer "control position" first?
7. **Copy voice** for captions, "why" sentences and challenges, and the lesson order on the new site.
8. **Video:** your own footage per page, or none?

## Verification status (phase 1)

- Physics unit tests pass (`npm test`), including signs and limits: rake forward bears away, a luffing sail gives no moment to steer with, uphaul tension falls as θ rises, a flagging sail weathervanes.
- `npm run check` (see its output for the current run): no console errors and no sideways scroll at 1440 and 390 px in both themes; line ends at 0 at rest and in three posed states per figure, both themes; every challenge passes when driven through the page's own controls; every mistake replay runs to its end; idle-tour contact sheets show the parts moving.
- Not done yet:
  - The geometry audit (`node build.mjs --audit` with recorded shapes) isn't wired in. Depth order between the mannequin, mast, boom and sail is a per-frame painter's sort (by the sail plane, then by depth), not `A.settle`.
  - The web component hasn't been tried inside a real Framer project.
  - The 4× close-up sweep has only been done on the mannequin and the rig.
