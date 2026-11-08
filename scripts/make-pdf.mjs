// PDFs of the one-page A5 invitation, printed from /print/ with the installed Chrome.
//   assets/pdf/Anusha-Saurav-Wedding-Invitation.pdf    ← print/?v=full
//   assets/pdf/Anusha-Saurav-Reception-Invitation.pdf  ← print/?v=reception
// Uses the live Sheet content if the API is reachable, otherwise data/fallback.json.
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { ROOT, serve, launch, settle } from "./lib.mjs";

const jobs = [
  ["full", "Anusha-Saurav-Wedding-Invitation.pdf"],
  ["reception", "Anusha-Saurav-Reception-Invitation.pdf"]
];

const outDir = path.join(ROOT, "assets/pdf");
mkdirSync(outDir, { recursive: true });
const server = await serve();
const browser = await launch();
try {
  for (const [v, file] of jobs) {
    const page = await browser.newPage();
    await page.goto(server.url + "print/?v=" + v, { waitUntil: "networkidle" });
    await page.waitForSelector("#sheet .p-names");
    await settle(page);
    // The reception PDF must never contain wedding details.
    if (v === "reception") {
      const text = await page.evaluate(() => document.body.innerText);
      if (/Staydium|Bilathikkulam|Muhurtham|10:00/.test(text)) throw new Error("Wedding details found on the reception print page");
    }
    const out = path.join(outDir, file);
    await page.pdf({ path: out, width: "148mm", height: "210mm", printBackground: true, pageRanges: "1",
      margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    console.log(`assets/pdf/${file}  ${(statSync(out).size / 1024).toFixed(0)} KB`);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
