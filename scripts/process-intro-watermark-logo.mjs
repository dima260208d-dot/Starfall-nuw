/**
 * Remove green-screen from first-launch intro watermark overlay PNG.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "assets", "starfall-watermark-green.png");
const OUT = path.join(ROOT, "public", "ui", "starfall-intro-watermark.png");

function isGreenScreen(r, g, b) {
  return g > 150 && g > r + 25 && g > b + 25;
}

if (!fs.existsSync(SRC)) {
  console.error("Missing source:", SRC);
  process.exit(1);
}

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });

for (let i = 0; i < data.length; i += 4) {
  const r = data[i];
  const g = data[i + 1];
  const b = data[i + 2];
  if (isGreenScreen(r, g, b)) {
    data[i + 3] = 0;
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
await sharp(data, {
  raw: { width: info.width, height: info.height, channels: 4 },
})
  .png()
  .toFile(OUT);

console.log("Published", OUT, `${info.width}x${info.height}`);
