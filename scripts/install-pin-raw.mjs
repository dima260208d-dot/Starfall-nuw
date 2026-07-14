import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsRoot = process.env.PIN_ASSETS_DIR || path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
const args = process.argv.slice(2);
const charIdx = args.indexOf("--character");
if (charIdx !== -1) {
  const brawlerId = args[charIdx + 1];
  const pinKind = args[charIdx + 2];
  if (!brawlerId || !pinKind) {
    console.error("Usage: node scripts/install-pin-raw.mjs --character <brawlerId> <kind>");
    process.exit(1);
  }
  const src = path.join(assetsRoot, `${brawlerId}_pin_${pinKind}.png`);
  const outDir = path.join(root, "public", "pins", "characters", brawlerId);
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${pinKind}.png`);
  if (!fs.existsSync(src)) { console.error("Missing", src); process.exit(1); }
  fs.copyFileSync(src, out);
  console.log("installed", path.relative(root, out));
  process.exit(0);
}
const pinId = args[0];
if (!pinId) {
  console.error("Usage: node scripts/install-pin-raw.mjs <pinId>  OR  --character <brawlerId> <kind>");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "game-pin-manifest.json"), "utf8"));
const pin = manifest.find((p) => p.id === pinId);
if (!pin) { console.error("Unknown pin", pinId); process.exit(1); }
const src = path.join(assetsRoot, pinId + ".png");
const outDir = path.join(root, "public", "pins", pin.dir);
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, pinId + ".png");
if (!fs.existsSync(src)) { console.error("Missing", src); process.exit(1); }
fs.copyFileSync(src, out);
console.log("installed", path.relative(root, out));