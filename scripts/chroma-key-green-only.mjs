/**
 * Green-screen key for Starfall logo.
 * Removes ONLY green-dominant pixels; white/pink/gold stay fully opaque.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const input = path.join(root, "public/starfall-logo-variants/starfall-logo-green-v01.png");
const output = path.join(root, "public/starfall-logo.png");

const KEY = { r: 0, g: 255, b: 0 };

function dist(r, g, b) {
  return Math.sqrt((r - KEY.r) ** 2 + (g - KEY.g) ** 2 + (b - KEY.b) ** 2);
}

/** Logo colors must never be keyed out. */
function isProtectedLogoPixel(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;

  if (max >= 200 && spread <= 55) return true;
  if (r >= 180 && b >= 100 && g <= r - 20) return true;
  if (r >= 160 && g >= 120 && b <= 80) return true;
  if (max <= 90) return true;
  return false;
}

function isGreenBackground(r, g, b) {
  if (isProtectedLogoPixel(r, g, b)) return false;
  return g >= 120 && g >= r + 32 && g >= b + 32;
}

async function main() {
  const { data, info } = await sharp(input).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels: ch } = info;
  const out = Buffer.alloc(w * h * 4);

  for (let p = 0; p < w * h; p++) {
    const i = p * ch;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const o = p * 4;
    const d = dist(r, g, b);

    let alpha = 255;
    if (isGreenBackground(r, g, b)) {
      if (d <= 72) alpha = 0;
      else if (d <= 110) alpha = Math.round(((d - 72) / 38) * 255);
      else alpha = 255;
    }

    let rr = r;
    let gg = g;
    let bb = b;
    if (alpha > 0 && alpha < 255 && g > r && g > b) {
      const spill = Math.min(1, (g - Math.max(r, b)) / 80);
      gg = Math.round(g - spill * (g - Math.max(r, b)) * 0.9);
    }

    out[o] = rr;
    out[o + 1] = gg;
    out[o + 2] = bb;
    out[o + 3] = alpha;
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(output);
  console.log("Wrote", output, w, "x", h);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
