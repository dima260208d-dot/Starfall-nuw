/**
 * Chroma-key #00FF00 → transparent alpha for battle VFX sprites.
 * Input: public/vfx/chroma/*.png (solid green backdrop from generator)
 * Output: public/vfx/brawlers/*.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const inDir = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "public", "vfx", "chroma");
const outDir = process.argv[3]
  ? path.resolve(process.argv[3])
  : path.join(root, "public", "vfx", "brawlers");

const KEY_R = 0;
const KEY_G = 255;
const KEY_B = 0;
const TOLERANCE = Number(process.env.VFX_CHROMA_TOLERANCE || 72);
const FEATHER = Number(process.env.VFX_CHROMA_FEATHER || 18);
const MAX_DIM = Number(process.env.VFX_MAX_DIM || 512);

function distKey(r, g, b) {
  const dr = r - KEY_R;
  const dg = g - KEY_G;
  const db = b - KEY_B;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

/** Reject pixels that are green-dominant even if not exact key (helps spill). */
function isGreenSpill(r, g, b) {
  return g > 140 && g > r + 40 && g > b + 40;
}

function chromaKey(data, width, height) {
  const n = width * height;
  const mask = new Float32Array(n);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const tryPush = (x, y) => {
    const idx = y * width + x;
    if (mask[idx] > 0) return;
    const i = idx * 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 8) {
      mask[idx] = 1;
      return;
    }
    if (distKey(r, g, b) <= TOLERANCE || isGreenSpill(r, g, b)) {
      mask[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < width; x++) {
    tryPush(x, 0);
    tryPush(x, height - 1);
  }
  for (let y = 1; y < height - 1; y++) {
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

  for (let idx = 0; idx < n; idx++) {
    const i = idx * 4;
    if (mask[idx] >= 1) {
      data[i + 3] = 0;
      continue;
    }
    let minD = Infinity;
    for (let dy = -FEATHER; dy <= FEATHER; dy++) {
      for (let dx = -FEATHER; dx <= FEATHER; dx++) {
        const nx = (idx % width) + dx;
        const ny = ((idx / width) | 0) + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const ni = ny * width + nx;
        if (mask[ni] >= 1) {
          const d = Math.hypot(dx, dy);
          if (d < minD) minD = d;
        }
      }
    }
    if (minD <= FEATHER) {
      data[i + 3] = Math.round(255 * (minD / FEATHER));
    }
  }
}

async function processFile(file) {
  const base = path.basename(file);
  const outPath = path.join(outDir, base);
  const img = sharp(file).ensureAlpha();
  const meta = await img.metadata();
  let pipeline = img;
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  if (Math.max(w, h) > MAX_DIM) {
    pipeline = pipeline.resize({
      width: w >= h ? MAX_DIM : undefined,
      height: h > w ? MAX_DIM : undefined,
      fit: "inside",
    });
  }
  const { data, info } = await pipeline.raw().toBuffer({ resolveWithObject: true });
  const buf = Buffer.from(data);
  chromaKey(buf, info.width, info.height);
  await sharp(buf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log("[vfx-chroma]", base, "→", outPath);
}

async function main() {
  if (!fs.existsSync(inDir)) {
    console.error("Input dir missing:", inDir);
    process.exit(1);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(inDir).filter((f) => f.endsWith(".png"));
  if (!files.length) {
    console.warn("No PNG files in", inDir);
    return;
  }
  for (const f of files) {
    await processFile(path.join(inDir, f));
  }
  console.log("[vfx-chroma] done:", files.length, "files");
}

void main();
