// A tiny static server for site/dist with the same CORS header Vercel sends, for local checks.
// node scripts/serve.mjs [port]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "site", "dist");
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json" };
const port = Number(process.argv[2] || 4173);
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html");
  try {
    const body = await readFile(join(ROOT, path.replace(/\.\.+/g, "")));
    res.writeHead(200, { "Content-Type": TYPES[extname(path)] || "application/octet-stream", "Access-Control-Allow-Origin": "*" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
}).listen(port, () => console.log(`serving site/dist on http://localhost:${port}`));
