// npm run build            all figures, every theme
// npm run build -- f2      one figure (matched by its id prefix)
// npm run build -- --audit also run each figure's geometry audit
import { readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const only = args.filter((a) => !a.startsWith("--"));
const dirs = readdirSync(join(ROOT, "figures"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(ROOT, "figures", d.name, "build.mjs")))
  .map((d) => d.name)
  .filter((name) => !only.length || only.some((o) => name.startsWith(o)))
  .sort();
if (!dirs.length) { console.error(`no figure matches ${only.join(", ")}`); process.exit(1); }
for (const name of dirs) {
  const t0 = Date.now();
  const mod = await import(pathToFileURL(join(ROOT, "figures", name, "build.mjs")));
  await mod.build();
  console.log(`${name}: built in ${Date.now() - t0} ms`);
  if (args.includes("--audit") && mod.audit) await mod.audit();
}
