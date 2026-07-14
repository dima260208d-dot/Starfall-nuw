/**
 * Generates REAL raster menu button PNGs via OpenAI (same pipeline as pins).
 * Requires OPENAI_API_KEY. Never use SVG placeholders for game UI.
 *
 * Usage:
 *   node scripts/generate-menu-button-icons-openai.mjs          # all
 *   node scripts/generate-menu-button-icons-openai.mjs drawer-settings  # one (filename without .png)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "menu-button-icon-manifest.json"), "utf8"));
const only = process.argv[2];
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY required. Set it in your environment, then re-run.");
  process.exit(1);
}

const assetsDir = process.env.MENU_ICON_ASSETS_DIR
  || path.join(process.env.USERPROFILE || "", ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
fs.mkdirSync(assetsDir, { recursive: true });

const items = only
  ? manifest.filter((m) => m.file.replace(".png", "") === only || m.file === only)
  : manifest;

if (!items.length) {
  console.error("No matching icon in menu-button-icon-manifest.json for:", only);
  process.exit(1);
}

for (const item of items) {
  console.log("Generating", item.file, "…");
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt: item.prompt,
      size: "1024x1024",
      n: 1,
      background: "transparent",
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    process.exit(1);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error("No image data for", item.file);
    process.exit(1);
  }
  const tmp = path.join(assetsDir, item.file);
  fs.writeFileSync(tmp, Buffer.from(b64, "base64"));
  fs.copyFileSync(tmp, path.join(root, "public", "ui", item.file));
  console.log("  → public/ui/" + item.file);
}

console.log("Processing backgrounds…");
spawnSync(process.execPath, [path.join(root, "scripts", "process-ui-icons.mjs"), path.join(root, "public", "ui")], {
  stdio: "inherit",
});
console.log("Done:", items.length, "icon(s)");
