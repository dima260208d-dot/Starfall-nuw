/**
 * Generate missing emoji PNGs via OpenAI. Requires OPENAI_API_KEY.
 * Run collect first: node scripts/collect-emoji-icons.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "scripts", "emoji-icon-manifest.json");
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("OPENAI_API_KEY required");
  process.exit(1);
}
if (!fs.existsSync(manifestPath)) {
  console.error("Run: node scripts/collect-emoji-icons.mjs");
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const only = process.argv[2];
const items = only ? manifest.filter((m) => m.emoji === only || m.file.includes(only)) : manifest;

for (const item of items) {
  const dest = path.join(root, "public", item.file);
  if (fs.existsSync(dest) && !process.env.FORCE_EMOJI) {
    console.log("skip (exists)", item.file);
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  console.log("Generating", item.emoji, "→", item.file);
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
    console.error("No image for", item.emoji);
    process.exit(1);
  }
  fs.writeFileSync(dest, Buffer.from(b64, "base64"));
}

spawnSync(process.execPath, [path.join(root, "scripts", "process-ui-icons.mjs"), path.join(root, "public", "ui", "emojis")], {
  stdio: "inherit",
});
console.log("Done");
