/**
 * Compresses pin PNGs for faster loading (128×128, palette PNG).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SIZE = 48;

const dirs = process.argv.slice(2).length
  ? process.argv.slice(2).map(d => path.resolve(d))
  : [
      path.join(root, "public", "pins", "game"),
      path.join(root, "public", "pins", "general"),
    ];

function collectPngs(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) collectPngs(full, out);
    else if (name.endsWith(".png")) out.push(full);
  }
  return out;
}

const files = dirs.flatMap(d => collectPngs(d));
let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const before = fs.statSync(file).size;
  totalBefore += before;
  const buf = await sharp(file)
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, colors: 32, quality: 55, effort: 10 })
    .toBuffer();
  fs.writeFileSync(file, buf);
  totalAfter += buf.length;
}

console.log(`Optimized ${files.length} PNGs → ${SIZE}px`);
console.log(`Before: ${(totalBefore / 1024 / 1024).toFixed(2)} MB`);
console.log(`After:  ${(totalAfter / 1024 / 1024).toFixed(2)} MB`);
