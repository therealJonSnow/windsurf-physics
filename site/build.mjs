// npm run site → site/dist: one self-contained ES module per figure (kit and modules inlined) that
// defines <ws-figure name="…">, plus a test page, a sandboxed-iframe test page and the Vercel config.
import { mkdirSync, writeFileSync, copyFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as esbuild from "esbuild";
import { k } from "../packages/windsurf/kit.mjs";
import { WS_CSS } from "../packages/windsurf/page.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "site", "dist");
mkdirSync(OUT, { recursive: true });
const ids = readdirSync(join(ROOT, "figures")).filter((d) => existsSync(join(ROOT, "figures", d, "build.mjs"))).sort();
const sizes = [];
for (const id of ids) {
  const mod = await import(pathToFileURL(join(ROOT, "figures", id, "build.mjs")));
  const built = await mod.build({ write: false });
  const entry = `
import { mount } from ${JSON.stringify(join(ROOT, "figures", id, "live.js"))};
import captions from ${JSON.stringify(join(ROOT, "figures", id, "captions.json"))};
import { register } from ${JSON.stringify(join(ROOT, "site", "element.js"))};
register(${JSON.stringify(id)}, { mount, captions, css: ${JSON.stringify(k.ISO_CSS + WS_CSS)}, markup: ${JSON.stringify(built.markupFor("light"))} });
`;
  const result = await esbuild.build({ stdin: { contents: entry, resolveDir: ROOT, loader: "js" }, bundle: true, format: "esm", minify: true, write: false, target: "es2020", legalComments: "none" });
  writeFileSync(join(OUT, `${id}.js`), result.outputFiles[0].text);
  sizes.push(`${id}.js ${(result.outputFiles[0].text.length / 1024).toFixed(0)} KB`);
}
const tags = (theme) => ids.map((id) => `<ws-figure name="${id}"${theme ? ` theme="${theme}"` : ""}></ws-figure>`).join("\n");
const scripts = ids.map((id) => `<script type="module" src="./${id}.js"></script>`).join("\n");
writeFileSync(join(OUT, "index.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Windsurf figures</title>
<style>body{margin:0;font:15px/1.6 system-ui,sans-serif;background:#f2f2ef;color:#222}@media (prefers-color-scheme:dark){body{background:#0b0b0b;color:#ddd}}main{width:min(680px,100% - 32px);margin:48px auto}ws-figure{margin:0 0 48px}</style>
${scripts}</head><body><main><h1>Uphauling and getting going</h1>
${tags("")}
</main></body></html>`);
// a sandboxed iframe: scripts only, no same-origin, so storage throws and the figure must cope
writeFileSync(join(OUT, "iframe-test.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Sandboxed figure</title><style>body{margin:0;background:#f2f2ef}iframe{width:min(720px,100%);height:1400px;border:0;display:block;margin:24px auto}</style></head><body>
<iframe sandbox="allow-scripts" src="./embed.html?name=f2-uphaul"></iframe></body></html>`);
writeFileSync(join(OUT, "embed.html"), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Figure</title><style>body{margin:0;padding:16px;background:#f2f2ef}</style></head><body>
<script type="module">const name = new URLSearchParams(location.search).get("name") || "f1-t-position"; const el = document.createElement("ws-figure"); el.setAttribute("name", name); document.body.append(el); import(new URL("./" + name + ".js", location.href).href);</script></body></html>`);
console.log(`site/dist: ${sizes.join(" · ")}`);
