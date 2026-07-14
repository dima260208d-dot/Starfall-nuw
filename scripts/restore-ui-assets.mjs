/**
 * Restores kill-feed icons and ranked league backgrounds from Cursor assets / public sources.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot =
  process.env.RANKED_ASSETS_DIR ||
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");

const TOL = 40;
const FEA = 16;

function dist(r, g, b, br, bg, bb) {
  const dr = r - br;
  const dg = g - bg;
  const db = b - bb;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

async function stripEdgeBg(srcBuf) {
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

async function restoreKillFeed(name) {
  const src = path.join(assetsRoot, name);
  if (!fs.existsSync(src)) throw new Error("Missing " + src);
  const piped = await stripEdgeBg(fs.readFileSync(src));
  const meta = await piped.metadata();
  const maxDim = 256;
  const scale = Math.min(1, maxDim / Math.max(meta.width || maxDim, meta.height || maxDim));
  const w = Math.max(1, Math.round((meta.width || maxDim) * scale));
  const h = Math.max(1, Math.round((meta.height || maxDim) * scale));
  const buf = await piped
    .resize(w, h, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  for (const dir of [path.join(root, "public", "ui"), path.join(root, "src", "assets", "ui")]) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), buf);
  }
  console.log("kill-feed", name, w + "x" + h);
}

async function upscaleRankedBackgrounds() {
  const imgDir = path.join(root, "public", "images");
  const ids = ["shattered", "bronze", "silver", "gold", "platinum", "diamond", "master", "star"];
  for (const id of ids) {
    const file = path.join(imgDir, "ranked-bg-" + id + ".png");
    if (!fs.existsSync(file)) {
      console.warn("Missing", file);
      continue;
    }
    await sharp(file)
      .resize(1280, 720, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(file + ".tmp");
    fs.renameSync(file + ".tmp", file);
    console.log("bg upscaled", id);
  }
}

async function restoreRankedMenuBtn() {
  const src = path.join(assetsRoot, "ranked-menu-btn.png");
  if (!fs.existsSync(src)) {
    console.warn("Missing ranked-menu-btn source");
    return;
  }
  const piped = await stripEdgeBg(fs.readFileSync(src));
  await piped
    .resize(64, 64, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(root, "public", "images", "ranked-menu-btn.png"));
  console.log("ranked-menu-btn restored");
}

fs.mkdirSync(path.join(root, "src", "assets", "ui"), { recursive: true });
await restoreKillFeed("kill-feed-skull.png");
await restoreKillFeed("kill-feed-pistol.png");
await restoreRankedMenuBtn();
await upscaleRankedBackgrounds();
console.log("Done");
