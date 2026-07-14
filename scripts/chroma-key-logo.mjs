/**
 * Safe logo background removal — preserves white/colored logo pixels.
 * Flood-fill only strict checkerboard gray + transparency from edges.
 * Opaque logo pixels are never keyed out.
 */
import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const input = path.join(root, "public/starfall-logo-variants/starfall-logo-v01.png");
const output = path.join(root, "public/starfall-logo.png");

const KEY = { r: 0, g: 255, b: 0 };
const GREEN_TOL = 92;
const GREEN_SOFT = 36;

function dist(r, g, b, t) {
  return Math.sqrt((r - t.r) ** 2 + (g - t.g) ** 2 + (b - t.b) ** 2);
}

function isBackgroundSeed(r, g, b, a) {
  if (a < 128) return true;
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 16) return false;
  const avg = (r + g + b) / 3;
  return avg >= 198 && avg <= 212;
}

function isGreenScreen(r, g, b) {
  return g > 155 && g > r + 45 && g > b + 45;
}

function floodBackground(w, h, src) {
  const bg = new Uint8Array(w * h);
  const q = [];

  const tryPush = (x, y) => {
    const p = y * w + x;
    if (bg[p]) return;
    const i = p * 4;
    if (!isBackgroundSeed(src[i], src[i + 1], src[i + 2], src[i + 3])) return;
    bg[p] = 1;
    q.push(p);
  };

  for (let x = 0; x < w; x++) {
    tryPush(x, 0);
    tryPush(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryPush(0, y);
    tryPush(w - 1, y);
  }

  while (q.length) {
    const p = q.pop();
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) tryPush(x - 1, y);
    if (x < w - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < h - 1) tryPush(x, y + 1);
  }

  return bg;
}

async function main() {
  const meta = await sharp(input).metadata();
  const w = meta.width ?? 512;
  const h = meta.height ?? 512;

  const { data: src, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bgMask = floodBackground(w, h, src);

  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    const sr = src[i];
    const sg = src[i + 1];
    const sb = src[i + 2];
    const sa = src[i + 3];
    const o = p * 4;

    if (sa >= 240 && !bgMask[p]) {
      out[o] = sr;
      out[o + 1] = sg;
      out[o + 2] = sb;
      out[o + 3] = 255;
      continue;
    }

    if (!bgMask[p]) {
      out[o] = sr;
      out[o + 1] = sg;
      out[o + 2] = sb;
      out[o + 3] = sa;
      continue;
    }

    let rr = KEY.r;
    let gg = KEY.g;
    let bb = KEY.b;
    const d = dist(rr, gg, bb, KEY);
    let alpha = 0;

    if (d > GREEN_TOL + GREEN_SOFT) {
      rr = sr;
      gg = sg;
      bb = sb;
      alpha = sa;
    } else if (d > GREEN_TOL - GREEN_SOFT) {
      alpha = Math.round(((d - (GREEN_TOL - GREEN_SOFT)) / (GREEN_SOFT * 2)) * 255);
    }

    if (isGreenScreen(rr, gg, bb) && alpha > 0) {
      const spill = Math.min(1, (gg - Math.max(rr, bb)) / 90);
      gg = Math.round(gg - spill * (gg - Math.max(rr, bb)) * 0.85);
    }

    out[o] = rr;
    out[o + 1] = gg;
    out[o + 2] = bb;
    out[o + 3] = alpha;
  }

  await sharp(out, { raw: { width: w, height: h, channels: 4 } }).png().toFile(output);
  console.log("Wrote", output, info.width, "x", info.height);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
