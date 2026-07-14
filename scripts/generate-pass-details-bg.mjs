/**
 * Legacy SVG fallback for pass details backgrounds.
 * Production uses AI-generated PNGs in public/images/:
 *   pass-details-clash-bg.png, pass-details-pro-bg.png
 * Run: node scripts/generate-pass-details-bg.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "images");

const W = 920;
const H = 520;

function clashSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0d1b3d"/>
      <stop offset="45%" stop-color="#1565c0"/>
      <stop offset="100%" stop-color="#1a237e"/>
    </linearGradient>
    <radialGradient id="glow1" cx="20%" cy="15%" r="45%">
      <stop offset="0%" stop-color="#64b5f6" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#64b5f6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="85%" cy="80%" r="50%">
      <stop offset="0%" stop-color="#ffd54f" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffd54f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  ${Array.from({ length: 28 }, (_, i) => {
    const x = (i * 137) % W;
    const y = (i * 89) % H;
    const s = 2 + (i % 4);
    const o = 0.15 + (i % 5) * 0.04;
    return `<circle cx="${x}" cy="${y}" r="${s}" fill="#fff" opacity="${o}"/>`;
  }).join("")}
  <path d="M0 ${H * 0.72} Q ${W * 0.25} ${H * 0.58} ${W * 0.5} ${H * 0.68} T ${W} ${H * 0.62} L ${W} ${H} L 0 ${H} Z" fill="rgba(255,255,255,0.06)"/>
  <text x="${W / 2}" y="48" text-anchor="middle" font-size="28" font-weight="900" fill="rgba(255,255,255,0.12)" letter-spacing="8">STAR PASS</text>
</svg>`;
}

function proSvg() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a0a3a"/>
      <stop offset="40%" stop-color="#4a148c"/>
      <stop offset="100%" stop-color="#ff6f00"/>
    </linearGradient>
    <radialGradient id="glow1" cx="75%" cy="20%" r="55%">
      <stop offset="0%" stop-color="#ffd740" stop-opacity="0.5"/>
      <stop offset="100%" stop-color="#ffd740" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="15%" cy="85%" r="45%">
      <stop offset="0%" stop-color="#ea80fc" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#ea80fc" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow1)"/>
  <rect width="${W}" height="${H}" fill="url(#glow2)"/>
  ${Array.from({ length: 22 }, (_, i) => {
    const x = 40 + (i * 41) % (W - 80);
    const y = 30 + (i * 23) % (H - 60);
    return `<polygon points="${x},${y} ${x + 8},${y + 22} ${x + 16},${y}" fill="#ffd740" opacity="${0.08 + (i % 4) * 0.03}"/>`;
  }).join("")}
  <text x="${W / 2}" y="52" text-anchor="middle" font-size="30" font-weight="900" fill="rgba(255,215,64,0.15)" letter-spacing="10">PRO PASS</text>
</svg>`;
}

async function writePng(svg, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, name);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(out);
  console.log("wrote", out);
}

await writePng(clashSvg(), "pass-details-clash-bg.png");
await writePng(proSvg(), "pass-details-pro-bg.png");
