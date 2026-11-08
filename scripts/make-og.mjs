// WhatsApp / social preview images, 1200×630 JPEG, under 300 KB each.
//   assets/img/og-full.jpg       ← print/og.html?v=full
//   assets/img/og-reception.jpg  ← print/og.html?v=reception
import { statSync } from "node:fs";
import path from "node:path";
import { ROOT, serve, launch, settle } from "./lib.mjs";

const LIMIT = 300 * 1024;
const server = await serve();
const browser = await launch();
try {
  for (const v of ["full", "reception"]) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
    await page.goto(server.url + "print/og.html?v=" + v, { waitUntil: "networkidle" });
    await page.waitForSelector("html[data-ready]");
    await settle(page);
    if (v === "reception") {
      const text = await page.evaluate(() => document.body.innerText);
      if (/Staydium|Bilathikkulam|Muhurtham|16 Dec/.test(text)) throw new Error("Wedding details found on the reception preview");
    }
    const out = path.join(ROOT, "assets/img", `og-${v}.jpg`);
    for (const quality of [86, 80, 72, 64]) {
      await page.screenshot({ path: out, type: "jpeg", quality });
      if (statSync(out).size <= LIMIT) break;
    }
    const kb = statSync(out).size / 1024;
    console.log(`assets/img/og-${v}.jpg  ${kb.toFixed(0)} KB${kb * 1024 > LIMIT ? "  (over 300 KB!)" : ""}`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
