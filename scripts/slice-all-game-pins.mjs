/**
 * Slices all sheets listed in game-pin-sheets.json → public/pins/game/<id>.png
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  fs.readFileSync(path.join(root, "scripts", "game-pin-sheets.json"), "utf8"),
);

for (const entry of manifest) {
  const sheet = path.join(root, entry.file);
  if (!fs.existsSync(sheet)) {
    console.warn("SKIP (missing sheet):", entry.file);
    continue;
  }
  console.log("\n", entry.file);
  const r = spawnSync(
    process.execPath,
    [
      path.join(root, "scripts", "slice-pin-sheet.mjs"),
      sheet,
      entry.ids.join(","),
    ],
    { stdio: "inherit", cwd: root },
  );
  if (r.status !== 0) process.exit(r.status ?? 1);
}
console.log("\nDone.");
