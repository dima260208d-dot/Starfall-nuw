/**
 * Deletes all pins except public/pins/characters/**
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function clearDir(dir) {
  if (!fs.existsSync(dir)) return 0;
  let n = 0;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) continue;
    if (/\.(png|svg|webp)$/i.test(name)) {
      fs.unlinkSync(full);
      n++;
    }
  }
  return n;
}

const game = clearDir(path.join(root, "public", "pins", "game"));
const general = clearDir(path.join(root, "public", "pins", "general"));
console.log(`Removed ${game} game + ${general} general pin files (characters kept).`);
