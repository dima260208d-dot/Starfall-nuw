import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const comicsRoot = path.join(repoRoot, "public", "assets", "comics");
const scriptDir = path.join(repoRoot, "scripts", "comic-generation");

const brawlers = fs
  .readdirSync(scriptDir)
  .filter((f) => f.endsWith("-page-script.json"))
  .map((f) => f.replace("-page-script.json", ""))
  .sort();

let total = 0;
const rows = [];

for (const id of brawlers) {
  const dir = path.join(comicsRoot, id);
  const cover = fs.existsSync(path.join(dir, "cover.png")) ? 1 : 0;
  let pages = 0;
  if (fs.existsSync(dir)) {
    for (const ch of fs.readdirSync(dir)) {
      const chDir = path.join(dir, ch);
      if (!fs.statSync(chDir).isDirectory()) continue;
      pages += fs.readdirSync(chDir).filter((f) => /^page-\d+\.png$/i.test(f)).length;
    }
  }
  const have = cover + pages;
  total += have;
  rows.push({ id, have, pages, cover: !!cover });
}

const scripts = brawlers.filter((id) =>
  fs.existsSync(path.join(scriptDir, `${id}-page-script.json`)),
).length;

console.log("Comic audit");
console.log("Scripts:", scripts, "/", brawlers.length);
console.log("Images:", total, "/", brawlers.length * 101);
console.log("");
for (const r of rows) {
  const mark = r.have === 101 ? "OK" : r.have === 0 ? "MISSING" : "PARTIAL";
  console.log(`${r.id.padEnd(14)} ${String(r.have).padStart(3)}/101  [${mark}]`);
}
