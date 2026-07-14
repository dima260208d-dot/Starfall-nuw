/**
 * Installs AI-generated ranked UI PNGs from the Cursor assets folder.
 * Does NOT generate SVG placeholders — run generate-ranked-ui-openai.mjs first.
 */
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const install = path.join(root, "scripts", "install-ranked-ui-assets.mjs");
const r = spawnSync(process.execPath, [install], { stdio: "inherit", env: process.env });
process.exit(r.status ?? 1);
