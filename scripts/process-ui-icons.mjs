/**
 * Removes baked white/gray backgrounds and downsizes generated UI PNGs.
 * Mode icons (mode-*.png) are excluded — background removal erodes artwork.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dirs = process.argv.slice(2).length
  ? process.argv.slice(2).map((d) => path.resolve(d))
  : [path.join(root, "public", "ui"), path.join(root, "public", "images")];

const TOLERANCE = Number(process.env.UI_BG_TOLERANCE || 48);
const FEATHER = Number(process.env.UI_BG_FEATHER || 22);
const MAX_DIM = Number(process.env.UI_ICON_MAX || 256);

function collectPngs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) collectPngs(full, out);
    else if (name.endsWith(".png") && (dir.includes(`${path.sep}ui${path.sep}`) || dir.endsWith(`${path.sep}ui`) || name.startsWith("nav-")))
      out.push(full);
  }
  return out;
}

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
    const d = distRgb(data[i], data[i + 1], data[i + 2], br, bg, bb);
    if (a < 12 || d <= TOLERANCE) {
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
      const d = distRgb(data[i], data[i + 1], data[i + 2], br, bg, bb);
      if (d <= TOLERANCE + FEATHER) {
        const t = (d - TOLERANCE) / FEATHER;
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

const files = dirs.flatMap((d) => collectPngs(d));
let changed = 0;

for (const file of files) {
  const meta = await sharp(file).metadata();
  const resize =
    Math.max(meta.width ?? 0, meta.height ?? 0) > MAX_DIM
      ? sharp(file).resize({
          width: meta.width >= meta.height ? MAX_DIM : undefined,
          height: meta.height > meta.width ? MAX_DIM : undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
      : sharp(file);

  const { data, info } = await resize.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const copy = Buffer.from(data);
  const cleared = removeBackground(copy, info.width, info.height);
  if (cleared === 0 && Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_DIM) continue;

  const out = await sharp(copy, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();

  fs.writeFileSync(file, out);
  changed++;
  console.log(path.relative(root, file), `${info.width}x${info.height}`, `(${cleared} px cleared)`);
}

console.log(`\nProcessed ${files.length} PNGs, updated ${changed}.`);
