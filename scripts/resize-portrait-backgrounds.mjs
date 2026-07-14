/**
 * Resize/crop AI-generated portrait backgrounds to exact card dimensions.
 * Usage: node scripts/resize-portrait-backgrounds.mjs [sourceDir]
 * Default source: assets/portrait-bg-src → public/portrait-bg
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.resolve(root, process.argv[2] ?? "assets/portrait-bg-src");
const outDir = path.join(root, "public", "portrait-bg");

const W = 666;
const H = 680;

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const files = fs.readdirSync(srcDir).filter(f => /^pbg-\d{3}\.(png|jpg|webp)$/i.test(f)).sort();
  if (!files.length) {
    console.error("No pbg-NNN.png files in", srcDir);
    process.exit(1);
  }
  for (const file of files) {
    const out = path.join(outDir, file.replace(/\.(jpg|webp)$/i, ".png"));
    await sharp(path.join(srcDir, file))
      .resize(W, H, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(out);
    console.log("resized", file, "→", `${W}x${H}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
