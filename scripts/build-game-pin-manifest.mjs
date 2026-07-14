import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
function parseCollectiblePins(ts) {
  const removed = new Set();
  const remRe = /REMOVED_PIN_IDS\s*=\s*new Set\(\[([\s\S]*?)\]\)/g;
  let rm;
  while ((rm = remRe.exec(ts)) !== null) {
    const idRe = /"([^"]+)"/g;
    let im;
    while ((im = idRe.exec(rm[1])) !== null) removed.add(im[1]);
  }
  const pins = [];
  const pinRe = /pin\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)",\s*"([^"]+)"(?:,\s*(true|false))?(?:,\s*"(png|svg)")?\)/g;
  let m;
  while ((m = pinRe.exec(ts)) !== null) {
    if (removed.has(m[1])) continue;
    pins.push({ id: m[1], label: m[2], emoji: m[3], rarity: m[4], goldenFrame: m[5] === "true", dir: "game", pool: m[1].startsWith("g2_") ? "premium" : "common" });
  }
  return pins;
}
function parseUniversalPins(ts) {
  const pins = [];
  const re = /\{\s*id:\s*"([^"]+)",\s*kind:\s*"([^"]+)",\s*label:\s*"([^"]+)",\s*emoji:\s*"([^"]+)"/g;
  let m;
  while ((m = re.exec(ts)) !== null) pins.push({ id: m[1], kind: m[2], label: m[3], emoji: m[4], dir: "general", pool: "universal" });
  return pins;
}
const c = fs.readFileSync(path.join(root, "src", "entities", "CollectiblePinData.ts"), "utf8");
const p = fs.readFileSync(path.join(root, "src", "entities", "PinData.ts"), "utf8");
const manifest = [...parseCollectiblePins(c), ...parseUniversalPins(p)];
fs.writeFileSync(path.join(root, "scripts", "game-pin-manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
console.log("Wrote", manifest.length, "pins");