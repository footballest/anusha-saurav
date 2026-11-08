// QR codes for both links, maroon on ivory, made locally (no online QR service).
//   assets/img/qr-full.svg       → BASE_URL
//   assets/img/qr-reception.svg  → BASE_URL + "reception/"
import QRCode from "qrcode";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { ROOT, baseUrl } from "./lib.mjs";

const base = baseUrl();
const targets = [
  ["qr-full.svg", base],
  ["qr-reception.svg", base + "reception/"]
];

for (const [file, url] of targets) {
  let svg = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
    color: { dark: "#7A1F2BFF", light: "#FFFDF7FF" }
  });
  svg = svg.replace("<svg ", `<svg role="img" aria-label="QR code: ${url}" `);
  writeFileSync(path.join(ROOT, "assets/img", file), svg);
  console.log(`assets/img/${file}  →  ${url}`);
}
