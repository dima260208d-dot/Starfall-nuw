/**
 * Copies gen_XXX.png from Cursor assets into public/profile-icons/gen/ (128×128).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "profile-icons", "gen");

const assetDirs = [
  path.join(root, "assets"),
  path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets"),
];

fs.mkdirSync(outDir, { recursive: true });

let copied = 0;
for (let n = 1; n <= 100; n++) {
  const name = `gen_${String(n).padStart(3, "0")}.png`;
  let src = null;
  for (const dir of assetDirs) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      src = p;
      break;
    }
  }
  if (!src) continue;
  const dest = path.join(outDir, name);
  await sharp(src).resize(128, 128, { fit: "cover" }).png().toFile(dest);
  copied++;
}

console.log(`Synced ${copied} icons → ${outDir}`);
