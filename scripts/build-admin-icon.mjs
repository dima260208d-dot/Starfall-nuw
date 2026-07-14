// Build the external admin-panel desktop icon from the user-provided art.
// 1) Remove ONLY the black backdrop (flood-fill from the borders) so interior
//    dark outlines of the art are preserved.
// 2) Emit a transparent PNG + a multi-size .ico (PNG-compressed entries).
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = process.argv[2];
const OUT_DIR = resolve("admin-panel");
if (!SRC) { console.error("usage: node scripts/build-admin-icon.mjs <source.png>"); process.exit(1); }

const NEAR_BLACK = 46; // channel threshold; pixels darker than this near the edge = backdrop

const { data, info } = await sharp(SRC)
  .ensureAlpha()
  .resize(512, 512, { fit: "cover" })
  .raw()
  .toBuffer({ resolveWithObject: true });

const { width: W, height: H } = info;
const idx = (x, y) => (y * W + x) * 4;
const isBlackish = (i) => data[i] < NEAR_BLACK && data[i + 1] < NEAR_BLACK && data[i + 2] < NEAR_BLACK;

// Flood-fill background starting from every border pixel that is blackish.
const visited = new Uint8Array(W * H);
const stack = [];
for (let x = 0; x < W; x++) { stack.push([x, 0]); stack.push([x, H - 1]); }
for (let y = 0; y < H; y++) { stack.push([0, y]); stack.push([W - 1, y]); }
while (stack.length) {
  const [x, y] = stack.pop();
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const p = y * W + x;
  if (visited[p]) continue;
  const i = idx(x, y);
  if (!isBlackish(i)) continue;
  visited[p] = 1;
  data[i + 3] = 0; // transparent
  stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
}

// Soften the cut edge a touch: any remaining blackish pixel directly adjacent to a
// transparent one also fades, to avoid a hard black halo.
for (let y = 1; y < H - 1; y++) {
  for (let x = 1; x < W - 1; x++) {
    const i = idx(x, y);
    if (data[i + 3] === 0 || !isBlackish(i)) continue;
    if (data[idx(x + 1, y) + 3] === 0 || data[idx(x - 1, y) + 3] === 0 ||
        data[idx(x, y + 1) + 3] === 0 || data[idx(x, y - 1) + 3] === 0) {
      data[i + 3] = 90;
    }
  }
}

const transparent = sharp(data, { raw: { width: W, height: H, channels: 4 } }).png();
await transparent.clone().resize(256, 256).toFile(resolve(OUT_DIR, "icon.png"));

// ── Build .ico (PNG-compressed entries — supported on Windows Vista+) ──
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const s of sizes) {
  const buf = await sharp(data, { raw: { width: W, height: H, channels: 4 } }).resize(s, s).png().toBuffer();
  pngs.push({ size: s, buf });
}
const count = pngs.length;
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(count, 4);
const dir = Buffer.alloc(16 * count);
let offset = 6 + 16 * count;
pngs.forEach((p, n) => {
  const e = dir.subarray(n * 16, n * 16 + 16);
  e.writeUInt8(p.size >= 256 ? 0 : p.size, 0);
  e.writeUInt8(p.size >= 256 ? 0 : p.size, 1);
  e.writeUInt8(0, 2); e.writeUInt8(0, 3);
  e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
  e.writeUInt32LE(p.buf.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += p.buf.length;
});
const ico = Buffer.concat([header, dir, ...pngs.map((p) => p.buf)]);
writeFileSync(resolve(OUT_DIR, "icon.ico"), ico);
console.log(`wrote admin-panel/icon.png + admin-panel/icon.ico (${count} sizes, ${ico.length} bytes)`);
