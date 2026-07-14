/**
 * Slices a 2×4 Brawl Stars-style pin sheet into individual PNGs.
 *
 * Usage:
 *   node scripts/slice-pin-sheet.mjs <sheet.png> <id1,id2,...> [outDir]
 *
 * Pin order: left→right, top→bottom (8 pins max).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let COLS = 4;
let ROWS = 2;

const sheetPath = process.argv[2];
const ids = (process.argv[3] || "").split(",").map(s => s.trim()).filter(Boolean);
const outDir = process.argv[4]
  ? path.resolve(process.argv[4])
  : path.join(__dirname, "..", "public", "pins", "game");

if (!sheetPath || ids.length === 0) {
  console.error("Usage: node scripts/slice-pin-sheet.mjs <sheet.png> <id1,id2,...> [outDir]");
  process.exit(1);
}

const absSheet = path.resolve(sheetPath);
if (!fs.existsSync(absSheet)) {
  console.error("Sheet not found:", absSheet);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

// 4-pin sheets use 2×2 layout
if (ids.length <= 4) {
  COLS = 2;
  ROWS = 2;
}

const PAD = 0.06;
const img = sharp(absSheet);
const meta = await img.metadata();
const w = meta.width ?? 1024;
const h = meta.height ?? 512;
const cellW = w / COLS;
const cellH = h / ROWS;

for (let i = 0; i < Math.min(ids.length, COLS * ROWS); i++) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const left = Math.round(col * cellW + cellW * PAD);
  const top = Math.round(row * cellH + cellH * PAD);
  const width = Math.round(cellW * (1 - PAD * 2));
  const height = Math.round(cellH * (1 - PAD * 2));
  const outPath = path.join(outDir, `${ids[i]}.png`);
  await img
    .clone()
    .extract({ left, top, width, height })
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, colors: 64, quality: 80, effort: 10 })
    .toFile(outPath);
  console.log("  →", outPath);
}

console.log("\nRun: npm run pins:remove-bg  (strip sheet backdrop from sliced pins)");

console.log(`Sliced ${Math.min(ids.length, 8)} pins from ${path.basename(absSheet)}`);
