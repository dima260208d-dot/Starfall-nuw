/**
 * DEPRECATED — use AI-generated assets in public/ui and public/starfeats-bg.png.
 * This script only drew SVG placeholders. Do not run for production art.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const uiDir = path.join(root, "public", "ui");
const publicDir = path.join(root, "public");

const TIER_COLORS = {
  1: "#90A4AE",
  2: "#66BB6A",
  3: "#42A5F5",
  4: "#AB47BC",
  5: "#FFA726",
  6: "#FFD700",
};

function starPath(cx, cy, r, points = 5) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = (Math.PI / points) * i - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.42;
    pts.push(`${cx + Math.cos(rad) * rr},${cy + Math.sin(rad) * rr}`);
  }
  return pts.join(" ");
}

function starSvg(n, color, size = 128, badge = false) {
  const pad = 8;
  const slot = (size - pad * 2) / n;
  const stars = [];
  for (let i = 0; i < n; i++) {
    const cx = pad + slot * i + slot / 2;
    const cy = size / 2;
    const r = badge ? slot * 0.38 : slot * 0.4;
    stars.push(
      `<polygon points="${starPath(cx, cy, r)}" fill="${color}" stroke="#1a1208" stroke-width="1.5"/>`,
      `<polygon points="${starPath(cx, cy - 2, r * 0.55)}" fill="rgba(255,255,255,0.35)"/>`,
    );
  }
  const glow = badge
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.46}" fill="none" stroke="${color}" stroke-width="3" opacity="0.5"/>`
    : "";
  const ring = badge
    ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.48}" fill="none" stroke="#FFD740" stroke-width="4"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="100%" height="100%" fill="#f4f4f6"/>
  ${ring}${glow}
  ${stars.join("\n")}
</svg>`;
}

function navFeatsSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <rect width="100%" height="100%" fill="#f0f0f2"/>
  <circle cx="128" cy="128" r="100" fill="#1a1030" opacity="0.15"/>
  <polygon points="${starPath(128, 118, 72)}" fill="#FFD54F" stroke="#E65100" stroke-width="4"/>
  <polygon points="${starPath(128, 108, 38)}" fill="#FFF59D" opacity="0.85"/>
  <circle cx="168" cy="88" r="14" fill="#42A5F5" stroke="#fff" stroke-width="2"/>
  <circle cx="88" cy="168" r="10" fill="#AB47BC" stroke="#fff" stroke-width="2"/>
</svg>`;
}

async function writeSvgPng(svg, outPath, resize) {
  let img = sharp(Buffer.from(svg));
  if (resize) img = img.resize(resize, resize, { fit: "contain", background: { r: 244, g: 244, b: 246, alpha: 1 } });
  await img.png().toFile(outPath);
  console.log("wrote", path.relative(root, outPath));
}

async function main() {
  fs.mkdirSync(uiDir, { recursive: true });
  await writeSvgPng(navFeatsSvg(), path.join(uiDir, "nav-feats.png"), 256);

  for (let tier = 1; tier <= 6; tier++) {
    const color = TIER_COLORS[tier];
    await writeSvgPng(starSvg(tier, color, 128, false), path.join(uiDir, `feat-tab-${tier}.png`), 128);
    await writeSvgPng(starSvg(tier, color, 128, true), path.join(uiDir, `feat-badge-${tier}.png`), 128);
  }

  const bgSrc = path.join(publicDir, "constellation-bg.png");
  const bgOut = path.join(publicDir, "starfeats-bg.png");
  if (fs.existsSync(bgSrc)) {
    const w = 1080;
    const h = 1920;
    const overlay = Buffer.from(
      `<svg width="${w}" height="${h}"><defs>
        <radialGradient id="g" cx="50%" cy="30%" r="70%">
          <stop offset="0%" stop-color="#FFD740" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="#000" stop-opacity="0"/>
        </radialGradient>
      </defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`,
    );
    await sharp(bgSrc)
      .resize(w, h, { fit: "cover" })
      .composite([{ input: overlay, blend: "over" }])
      .png()
      .toFile(bgOut);
    console.log("wrote", path.relative(root, bgOut));
  }

  console.log("\nRun: node scripts/process-ui-icons.mjs public/ui");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
