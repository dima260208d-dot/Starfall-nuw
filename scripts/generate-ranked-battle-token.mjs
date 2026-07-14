import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "public", "images", "ranked-battle-token.png");

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="256" height="320" viewBox="0 0 256 320">
  <defs>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FFE57F"/>
      <stop offset="45%" stop-color="#FFC107"/>
      <stop offset="100%" stop-color="#FF8F00"/>
    </linearGradient>
    <linearGradient id="green" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#C6FF00"/>
      <stop offset="100%" stop-color="#76FF03"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="4" flood-color="#000" flood-opacity="0.45"/>
    </filter>
  </defs>
  <g filter="url(#shadow)">
    <rect x="48" y="18" width="160" height="284" rx="80" fill="url(#gold)" stroke="#5D4037" stroke-width="6"/>
    <rect x="62" y="34" width="132" height="252" rx="66" fill="url(#green)" stroke="#33691E" stroke-width="4"/>
    <circle cx="128" cy="42" r="14" fill="#1B5E20" stroke="url(#gold)" stroke-width="5"/>
    <circle cx="128" cy="42" r="6" fill="#263238"/>
    <polygon points="128,278 118,292 138,292" fill="url(#gold)" stroke="#5D4037" stroke-width="3"/>
    <g stroke="#263238" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="88" y="88" width="14" height="88" rx="5" fill="#B0BEC5" transform="rotate(-32 95 132)"/>
      <rect x="154" y="88" width="14" height="88" rx="5" fill="#B0BEC5" transform="rotate(32 161 132)"/>
      <rect x="98" y="168" width="60" height="12" rx="4" fill="url(#gold)"/>
      <circle cx="95" cy="176" r="8" fill="#76FF03" stroke="#33691E" stroke-width="3"/>
      <circle cx="161" cy="176" r="8" fill="#76FF03" stroke="#33691E" stroke-width="3"/>
    </g>
    <polygon points="128,198 136,218 158,218 141,232 147,254 128,240 109,254 115,232 98,218 120,218" fill="url(#gold)" stroke="#5D4037" stroke-width="4"/>
    <circle cx="128" cy="224" r="10" fill="#C6FF00" stroke="#33691E" stroke-width="3"/>
  </g>
</svg>`;

await sharp(Buffer.from(svg)).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(out);

console.log("Wrote", path.relative(root, out));
