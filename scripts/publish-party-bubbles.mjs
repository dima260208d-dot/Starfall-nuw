/**
 * Remove green-screen background from party bubble PNGs and publish to public/ui.
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const ASSETS = path.join(ROOT, "assets");
const OUT = path.join(ROOT, "public", "ui");

const JOBS = [
  {
    src: "party-speech-bubble-v2.png",
    out: "party-speech-bubble.png",
    width: 224,
    height: 176,
  },
  {
    src: "party-mode-suggest-bubble-v2.png",
    out: "party-mode-suggest-bubble.png",
    width: 384,
    height: 156,
  },
];

function isGreenScreen(r, g, b) {
  return g > 160 && g > r + 30 && g > b + 30 && r < 140 && b < 140;
}

async function removeGreenAndPublish({ src, out, width, height }) {
  const input = path.join(ASSETS, src);
  if (!fs.existsSync(input)) {
    throw new Error(`Missing source: ${input}`);
  }

  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (isGreenScreen(r, g, b)) {
      data[i + 3] = 0;
    }
  }

  fs.mkdirSync(OUT, { recursive: true });
  const dest = path.join(OUT, out);
  await sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .resize(width, height, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(dest);

  console.log(`Published ${out} (${width}x${height})`);
}

for (const job of JOBS) {
  await removeGreenAndPublish(job);
}
