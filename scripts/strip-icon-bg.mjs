/**
 * Strip baked white/gray/checkerboard backgrounds from specific PNG paths.
 * Usage: node scripts/strip-icon-bg.mjs public/images/mode-random.png ...
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOLERANCE = Number(process.env.UI_BG_TOLERANCE || 52);
const FEATHER = Number(process.env.UI_BG_FEATHER || 24);

function distRgb(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function median(values) {
  if (values.length === 0) return [245, 245, 245];
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function sampleBackgroundRgb(data, width, height) {
  const rs = [];
  const gs = [];
  const bs = [];
  const push = (x, y) => {
    const i = (y * width + x) * 4;
    if (data[i + 3] < 8) return;
    rs.push(data[i]);
    gs.push(data[i + 1]);
    bs.push(data[i + 2]);
  };
  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
    push(0, y);
    push(width - 1, y);
  }
  return [median(rs), median(gs), median(bs)];
}

function isCheckerboardPixel(r, g, b) {
  const spread = Math.max(r, g, b) - Math.min(r, g, b);
  if (spread > 14) return false;
  const avg = (r + g + b) / 3;
  return avg >= 175 && avg <= 255;
}

function removeBackground(data, width, height) {
  const [br, bg, bb] = sampleBackgroundRgb(data, width, height);
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;

  const tryPush = (x, y) => {
    const idx = y * width + x;
    if (mask[idx]) return;
    const i = idx * 4;
    const a = data[i + 3];
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const d = distRgb(r, g, b, br, bg, bb);
    if (a < 12 || d <= TOLERANCE || isCheckerboardPixel(r, g, b)) {
      mask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    tryPush(0, y);
    tryPush(width - 1, y);
  }

  while (head < tail) {
    const idx = queue[head++];
    const x = idx % width;
    const y = (idx / width) | 0;
    if (x > 0) tryPush(x - 1, y);
    if (x < width - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < height - 1) tryPush(x, y + 1);
  }

  let cleared = 0;
  for (let idx = 0; idx < width * height; idx++) {
    if (!mask[idx]) continue;
    const i = idx * 4;
    data[i + 3] = 0;
    cleared++;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx]) continue;
      const i = idx * 4;
      if (data[i + 3] === 0) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const d = distRgb(r, g, b, br, bg, bb);
      if (d <= TOLERANCE + FEATHER || isCheckerboardPixel(r, g, b)) {
        const t = isCheckerboardPixel(r, g, b)
          ? 0
          : (d - TOLERANCE) / FEATHER;
        const alpha = Math.round(data[i + 3] * Math.min(1, Math.max(0, t)));
        if (alpha < data[i + 3]) {
          data[i + 3] = alpha;
          cleared++;
        }
      }
    }
  }

  return cleared;
}

const files = process.argv.slice(2).map((f) => path.resolve(f));
if (files.length === 0) {
  console.error("Usage: node scripts/strip-icon-bg.mjs <file.png> ...");
  process.exit(1);
}

for (const file of files) {
  if (!fs.existsSync(file)) {
    console.warn("skip (missing):", path.relative(root, file));
    continue;
  }
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const copy = Buffer.from(data);
  const cleared = removeBackground(copy, info.width, info.height);
  const out = await sharp(copy, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  fs.writeFileSync(file, out);
  console.log(path.relative(root, file), `${info.width}x${info.height}`, `(${cleared} px cleared)`);
}
