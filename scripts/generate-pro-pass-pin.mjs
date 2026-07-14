import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "pro-pass-manifest.json"), "utf8"));
const pinId = process.argv[2];
const apiKey = process.env.OPENAI_API_KEY;

if (!pinId) {
  console.error("Usage: node scripts/generate-pro-pass-pin.mjs <pinId>");
  process.exit(1);
}
if (!apiKey) {
  console.error("OPENAI_API_KEY required for AI pin generation");
  process.exit(1);
}

const pin = manifest.pins.find(p => p.id === pinId);
if (!pin) {
  console.error("Unknown pin", pinId);
  process.exit(1);
}

console.log("Generating pin", pinId, "-", pin.subject);

const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    prompt: pin.prompt,
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
  console.error("No image in response");
  process.exit(1);
}

const outDir = path.join(root, "assets", "pro-pass", "pins");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${pinId}.png`);
fs.writeFileSync(outPath, Buffer.from(b64, "base64"));
console.log("saved", outPath);

spawnSync(process.execPath, [path.join(root, "scripts", "install-pro-pass-asset.mjs"), "pin", pinId], {
  stdio: "inherit",
});
