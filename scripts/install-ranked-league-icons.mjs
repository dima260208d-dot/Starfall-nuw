/**
 * Installs ranked league icons from AI sources.
 * Removes only edge-connected white/checkerboard pixels — never floods into emblem interior.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot =
  process.env.RANKED_ASSETS_DIR ||
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
const outDir = path.join(root, "public", "images");
const LEAGUE_IDS = ["shattered","bronze","silver","gold","platinum","diamond","master","star"];
const OUT_SIZE = 512;

function isBgPixel(r, g, b) {
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const sat = mx === 0 ? 0 : (mx - mn) / mx;
  if (mx > 232 && sat < 0.08) return true;
  if (mx > 150 && mx < 228 && sat < 0.07 && Math.abs(r - g) < 14 && Math.abs(g - b) < 14) return true;
  return false;
}

function removeEdgeBackground(data, channels, w, h) {
  const copy = Buffer.from(data);
  const mask = new Uint8Array(w * h);
  const q = [];
  const idx = (x, y) => y * w + x;
  const tryPush = (x, y) => {
    const i = idx(x, y);
    if (mask[i]) return;
    const p = i * channels;
    if (!isBgPixel(copy[p], copy[p + 1], copy[p + 2])) return;
    mask[i] = 1;
    q.push(i);
  };
  for (let x = 0; x < w; x++) { tryPush(x, 0); tryPush(x, h - 1); }
  for (let y = 0; y < h; y++) { tryPush(0, y); tryPush(w - 1, y); }
  let head = 0;
  while (head < q.length) {
    const i = q[head++];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) tryPush(x - 1, y);
    if (x < w - 1) tryPush(x + 1, y);
    if (y > 0) tryPush(x, y - 1);
    if (y < h - 1) tryPush(x, y + 1);
  }
  for (let i = 0; i < w * h; i++) if (mask[i]) copy[i * channels + 3] = 0;
  return copy;
}

fs.mkdirSync(outDir, { recursive: true });
let missing = 0;

for (const id of LEAGUE_IDS) {
  const name = "ranked-league-" + id + ".png";
  const src = path.join(assetsRoot, name);
  if (!fs.existsSync(src)) { console.warn("Missing", src); missing++; continue; }
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const keyed = removeEdgeBackground(data, info.channels, info.width, info.height);
  await sharp(keyed, { raw: { width: info.width, height: info.height, channels: info.channels } })
    .resize(OUT_SIZE, OUT_SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(path.join(outDir, name));
  console.log("installed", name);
}

if (missing) { console.error(missing, "missing in", assetsRoot); process.exit(1); }
console.log("League icons installed to", outDir);
