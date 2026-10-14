// Build one figure: static art from its preset, the live code bundled with esbuild (kit and modules
// inlined), and the review pages: <id>.html following the system theme, <id>-light.html, <id>-dark.html.
// Also returns the markup and the bundle so the site build can wrap them in a web component.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as esbuild from "esbuild";
import { figureMarkup, reviewPage } from "./page.mjs";
import { verifyRows } from "./physics/constants.mjs";

export async function bundleLive(dir, { mountCall = "mount(document, { captions, store: false });" } = {}) {
  const result = await esbuild.build({
    stdin: { contents: `import { mount } from "./live.js";\nimport captions from "./captions.json";\n${mountCall}\n`, resolveDir: dir, loader: "js" },
    bundle: true,
    format: "esm",
    write: false,
    minify: true,
    target: "es2020",
    legalComments: "none",
  });
  return result.outputFiles[0].text;
}

export async function buildFigure({ id, dir, width, height, svgBody, controls, verify, write = true }) {
  const captions = JSON.parse(readFileSync(join(dir, "captions.json"), "utf8"));
  const rows = verifyRows(verify);
  const markupFor = (theme) =>
    figureMarkup({
      id, fig: captions.fig, title: captions.title, hint: captions.hint, width, height,
      label: captions.label, ariaLabel: captions.aria, svgBody, controls, captions,
      keys: captions.keys || [], caption: captions.caption, verify: rows, theme,
    });
  const script = await bundleLive(dir);
  if (write) {
    for (const theme of ["auto", "light", "dark"]) {
      const name = theme === "auto" ? `${id}.html` : `${id}-${theme}.html`;
      writeFileSync(join(dir, name), reviewPage({ title: captions.title, intro: captions.intro, markup: markupFor(theme === "dark" ? "dark" : "light"), script, theme }));
    }
  }
  return { id, captions, markupFor, script, rows };
}
