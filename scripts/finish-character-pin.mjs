/**
 * Copy character pin asset → public/pins/characters (no background processing).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const brawlerId = process.argv[2];
const kind = process.argv[3];
if (!brawlerId || !kind) {
  console.error("Usage: node scripts/finish-character-pin.mjs <brawlerId> <kind>");
  process.exit(1);
}
const r = spawnSync(
  process.execPath,
  [path.join(root, "scripts", "install-pin-raw.mjs"), "--character", brawlerId, kind],
  { stdio: "inherit", env: process.env },
);
process.exit(r.status ?? 1);
