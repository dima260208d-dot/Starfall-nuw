import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot =
  process.env.RANKED_ASSETS_DIR ||
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
const imgDir = path.join(root, "public", "images");

const LEAGUE_IDS = ["shattered", "bronze", "silver", "gold", "platinum", "diamond", "master", "star"];

const ICONS = [
  { name: "mode-ranked-battle.png", w: 200, h: 200 },
  { name: "mode-select-tab-ranked.png", w: 92, h: 72 },
  { name: "ranked-menu-btn.png", w: 64, h: 64 },
  ...LEAGUE_IDS.map((id) => ({ name: "ranked-league-" + id + ".png", w: 128, h: 128 })),
];

const TOL = 40;
const FEA = 16;

function dist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function stripWhiteBg(srcBuf) {
  const { data, info } = await sharp(srcBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const copy = Buffer.from(data);
  const w = info.width;
  const h = info.height;
  const rs = [];
  const gs = [];
  const bs = [];
  for (let x = 0; x < w; x++)
    for (const y of [0, h - 1]) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 8) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  for (let y = 0; y < h; y++)
    for (const x of [0, w - 1]) {
      const i = (y * w + x) * 4;
      if (data[i + 3] > 8) {
        rs.push(data[i]);
        gs.push(data[i + 1]);
        bs.push(data[i + 2]);
      }
    }
  const med = (a) => {
    a.sort((x, y) => x - y);
    return a[Math.floor(a.length / 2)] || 245;
  };
  const br = med(rs);
  const bg = med(gs);
  const bb = med(bs);
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
  for (let idx = 0; idx < w * h; idx++) if (mask[idx]) copy[idx * 4 + 3] = 0;
  for (let idx = 0; idx < w * h; idx++) {
    const i = idx * 4;
    if (!copy[i + 3]) continue;
    const d = dist(copy[i], copy[i + 1], copy[i + 2], br, bg, bb);
    if (d <= TOL + FEA) {
      const t = (d - TOL) / FEA;
      copy[i + 3] = Math.round(copy[i + 3] * Math.min(1, Math.max(0, t)));
    }
  }
  return sharp(copy, { raw: { width: w, height: h, channels: 4 } });
}

fs.mkdirSync(imgDir, { recursive: true });
let missing = 0;

for (const ic of ICONS) {
  const src = path.join(assetsRoot, ic.name);
  if (!fs.existsSync(src)) {
    console.warn("Missing", src);
    missing++;
    continue;
  }
  const piped = await stripWhiteBg(fs.readFileSync(src));
  await piped
    .resize(ic.w, ic.h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(imgDir, ic.name));
  console.log("icon", ic.name);
}

for (const id of LEAGUE_IDS) {
  const name = "ranked-bg-" + id + ".png";
  const src = path.join(assetsRoot, name);
  if (!fs.existsSync(src)) {
    console.warn("Missing", src);
    missing++;
    continue;
  }
  await sharp(src).resize(1280, 720, { fit: "cover" }).png().toFile(path.join(imgDir, name));
  console.log("bg", name);
}

if (missing) {
  console.error(missing, "assets missing in", assetsRoot);
  process.exit(1);
}
console.log("Ranked UI installed to", imgDir);
