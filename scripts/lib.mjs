// Shared helpers for the asset scripts (run locally with Node; outputs are committed).
import http from "node:http";
import { readFile, readFileSync } from "node:fs";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The public base URL lives in one place: assets/js/config.js (window.BASE_URL).
export function baseUrl() {
  const src = readFileSync(path.join(ROOT, "assets/js/config.js"), "utf8");
  const m = /window\.BASE_URL\s*=\s*"([^"]+)"/.exec(src);
  if (!m) throw new Error("BASE_URL not found in assets/js/config.js");
  return m[1].endsWith("/") ? m[1] : m[1] + "/";
}

const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json",
  ".svg": "image/svg+xml", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
  ".pdf": "application/pdf", ".mp3": "audio/mpeg"
};

// A tiny static server for the repo, on a free port, so the scripts don't depend on `npm run serve`.
export function serve() {
  const read = promisify(readFile);
  const server = http.createServer(async (req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, path.normalize(p));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    try {
      const body = await read(file);
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => {
    resolve({ url: `http://127.0.0.1:${server.address().port}/`, close: () => server.close() });
  }));
}

// Uses the Google Chrome already installed on this computer (no browser download).
export async function launch() {
  const { chromium } = await import("playwright-core");
  return chromium.launch({ channel: "chrome" });
}

// Wait until web fonts and every <img> on the page have finished loading.
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })));
  });
}
