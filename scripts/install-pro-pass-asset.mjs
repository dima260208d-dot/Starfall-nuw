import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot =
  process.env.PIN_ASSETS_DIR ||
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
const type = process.argv[2];
const id = process.argv[3];
if (!type || !id) {
  console.error("Usage: node scripts/install-pro-pass-asset.mjs pin|icon|token <id>");
  process.exit(1);
}

const fileBase = type === "icon" ? id.replace(":", "_") : id;
const src = path.join(assetsRoot, fileBase + ".png");
if (!fs.existsSync(src)) {
  console.error("Missing asset", src);
  process.exit(1);
}

let out;
if (type === "pin") {
  out = path.join(root, "public", "pins", "game", id + ".png");
} else if (type === "icon") {
  out = path.join(root, "public", "profile-icons", "pro", fileBase + ".png");
} else if (type === "token") {
  out = path.join(root, "public", "images", "ranked-battle-token.png");
} else {
  console.error("Unknown type", type);
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });
const tmp = out + ".__tmp.png";
fs.copyFileSync(src, tmp);
const { data, info } = await sharp(tmp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const copy = Buffer.from(data);
const w = info.width;
const h = info.height;
const TOL = 40;
const FEA = 16;
function dist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}
const rs = [];
const gs = [];
const bs = [];
for (let x = 0; x < w; x++) {
  for (const y of [0, h - 1]) {
    const i = (y * w + x) * 4;
    if (data[i + 3] > 8) {
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
}
for (let y = 0; y < h; y++) {
  for (const x of [0, w - 1]) {
    const i = (y * w + x) * 4;
    if (data[i + 3] > 8) {
      rs.push(data[i]);
      gs.push(data[i + 1]);
      bs.push(data[i + 2]);
    }
  }
}
rs.sort((a, b) => a - b);
const br = rs[Math.floor(rs.length / 2)] || 120;
gs.sort((a, b) => a - b);
const bg = gs[Math.floor(gs.length / 2)] || 120;
bs.sort((a, b) => a - b);
const bb = bs[Math.floor(bs.length / 2)] || 120;
const mask = new Uint8Array(w * h);
const q = new Int32Array(w * h);
let head = 0;
let tail = 0;
const tryPush = (x, y) => {
  const idx = y * w + x;
  if (mask[idx]) return;
  const i = idx * 4;
  const d = dist(copy[i], copy[i + 1], copy[i + 2], br, bg, bb);
  if (copy[i + 3] < 12 || d <= TOL) {
    mask[idx] = 1;
    q[tail++] = idx;
  }
};
for (let x = 0; x < w; x++) {
  tryPush(x, 0);
  tryPush(x, h - 1);
}
for (let y = 0; y < h; y++) {
  tryPush(0, y);
  tryPush(w - 1, y);
}
while (head < tail) {
  const idx = q[head++];
  const x = idx % w;
  const y = (idx / w) | 0;
  if (x > 0) tryPush(x - 1, y);
  if (x < w - 1) tryPush(x + 1, y);
  if (y > 0) tryPush(x, y - 1);
  if (y < h - 1) tryPush(x, y + 1);
}
for (let idx = 0; idx < w * h; idx++) {
  if (!mask[idx]) continue;
  const i = idx * 4;
  copy[i + 3] = 0;
}
for (let idx = 0; idx < w * h; idx++) {
  const i = idx * 4;
  const a = copy[i + 3];
  if (a === 0) continue;
  const sum = copy[i] + copy[i + 1] + copy[i + 2];
  if (sum < 36) copy[i + 3] = 0;
}
for (let y = 0; y < h; y++)
  for (let x = 0; x < w; x++) {
    const idx = y * w + x;
    if (mask[idx]) continue;
    const i = idx * 4;
    if (copy[i + 3] === 0) continue;
    const d = dist(copy[i], copy[i + 1], copy[i + 2], br, bg, bb);
    if (d <= TOL + FEA) {
      const t = (d - TOL) / FEA;
      copy[i + 3] = Math.round(copy[i + 3] * Math.min(1, Math.max(0, t)));
    }
  }
const size = type === "token" ? 256 : 128;
await sharp(copy, { raw: { width: w, height: h, channels: 4 } })
  .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, palette: type !== "token", colors: 64, quality: 80, effort: 10 })
  .toFile(out);
fs.unlinkSync(tmp);
console.log("installed", path.relative(root, out));
