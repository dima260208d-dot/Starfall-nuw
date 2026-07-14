/**
 * Compress profile icon PNGs + generate shop thumbnails.
 * Full: 128×128 in public/profile-icons/gen/
 * Thumb: 56×56 in public/profile-icons/gen/thumb/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const genDir = path.join(__dirname, "..", "public", "profile-icons", "gen");
const thumbDir = path.join(genDir, "thumb");
const FULL_SIZE = 128;
const THUMB_SIZE = 56;
const REMOVED = new Set(["gen_040.png", "gen_059.png"]);

fs.mkdirSync(thumbDir, { recursive: true });

const files = fs.readdirSync(genDir).filter(f => /^gen_\d{3}\.png$/i.test(f) && !REMOVED.has(f));
let fullBefore = 0;
let fullAfter = 0;
let thumbAfter = 0;

for (const name of files) {
  const file = path.join(genDir, name);
  fullBefore += fs.statSync(file).size;
  const fullBuf = await sharp(file)
    .resize(FULL_SIZE, FULL_SIZE, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true, colors: 48, quality: 50, effort: 10 })
    .toBuffer();
  fs.writeFileSync(file, fullBuf);
  fullAfter += fullBuf.length;

  const thumbBuf = await sharp(fullBuf)
    .resize(THUMB_SIZE, THUMB_SIZE, { fit: "cover" })
    .png({ compressionLevel: 9, palette: true, colors: 32, quality: 45, effort: 10 })
    .toBuffer();
  fs.writeFileSync(path.join(thumbDir, name), thumbBuf);
  thumbAfter += thumbBuf.length;
}

// Remove deleted icons + stale thumbs
for (const name of REMOVED) {
  for (const dir of [genDir, thumbDir]) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

console.log(`Full: ${files.length} icons @ ${FULL_SIZE}px — ${(fullBefore / 1024).toFixed(0)} KB → ${(fullAfter / 1024).toFixed(0)} KB`);
console.log(`Thumb: ${files.length} icons @ ${THUMB_SIZE}px — ${(thumbAfter / 1024).toFixed(0)} KB total`);
