/**
 * Generate all Pro Star Pass pins/icons one at a time via OpenAI.
 * Requires OPENAI_API_KEY. Skips assets already present in assets folder.
 *
 * Usage: node scripts/generate-all-pro-pass.mjs [pin|icon|all]
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "pro-pass-manifest.json"), "utf8"));
const assetsDir = path.join(root, "assets", "pro-pass");
const mode = process.argv[2] || "all";
const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error("OPENAI_API_KEY required");
  process.exit(1);
}

fs.mkdirSync(assetsDir, { recursive: true });

async function generateOne(prompt, filename) {
  const out = path.join(assetsDir, filename);
  if (fs.existsSync(out)) {
    console.log("skip existing", filename);
    return true;
  }
  console.log("generating", filename);
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
      prompt,
      size: "1024x1024",
      n: 1,
      background: "transparent",
    }),
  });
  if (!res.ok) {
    console.error(await res.text());
    return false;
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    console.error("No image for", filename);
    return false;
  }
  fs.writeFileSync(out, Buffer.from(b64, "base64"));
  return true;
}

function install(type, id) {
  spawnSync(process.execPath, [path.join(root, "scripts", "install-pro-pass-asset.mjs"), type, id], {
    stdio: "inherit",
    env: { ...process.env, PIN_ASSETS_DIR: assetsDir },
  });
}

if (mode === "all" || mode === "pin") {
  for (const pin of manifest.pins) {
    const ok = await generateOne(pin.prompt, pin.id + ".png");
    if (ok) install("pin", pin.id);
  }
}

if (mode === "all" || mode === "icon") {
  for (const icon of manifest.icons) {
    const ok = await generateOne(icon.prompt, icon.id.replace(":", "_") + ".png");
    if (ok) install("icon", icon.id);
  }
}

console.log("Done.");
