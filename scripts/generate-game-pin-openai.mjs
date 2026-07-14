import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "scripts", "game-pin-manifest.json"), "utf8"));
const pinId = process.argv[2];
const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) { console.error("OPENAI_API_KEY required"); process.exit(1); }
if (!pinId) { console.error("Usage: node scripts/generate-game-pin-openai.mjs <pinId>"); process.exit(1); }
const pin = manifest.find((p) => p.id === pinId);
if (!pin) { console.error("Unknown pin", pinId); process.exit(1); }
const rarityHint = { common:"common tier silver accents", rare:"rare tier blue burst", epic:"epic tier purple glow", unique:"unique tier orange dramatic", golden:"golden legendary shiny gold" };
const gold = pin.goldenFrame || pin.rarity === "golden" ? " Golden frame accents." : "";
const prompt = pin.dir === "general"
  ? `Single Brawl Stars chat emote pin. ${pin.label} (${pin.emoji}). Yellow emoji gesture, thick outlines. One icon. NO background, transparent PNG. No speech bubble plate.`
  : `Single Brawl Stars in-game pin emote. ${pin.label} (${pin.emoji}). ${rarityHint[pin.rarity]||rarityHint.common}.${gold} Thick cartoon outlines, vibrant colors. One icon centered. NO background, transparent alpha PNG. No sheet.`;
console.log("Generating", pinId);
const res = await fetch("https://api.openai.com/v1/images/generations", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1", prompt, size: "1024x1024", n: 1, background: "transparent" }),
});
if (!res.ok) { console.error(await res.text()); process.exit(1); }
const json = await res.json();
const b64 = json.data?.[0]?.b64_json;
if (!b64) { console.error("No image"); process.exit(1); }
const assets = process.env.PIN_ASSETS_DIR || path.join(process.env.USERPROFILE, ".cursor", "projects", "c-Users-Downloads-zip-repl", "assets");
fs.mkdirSync(assets, { recursive: true });
fs.writeFileSync(path.join(assets, pinId + ".png"), Buffer.from(b64, "base64"));
const { spawnSync } = await import("child_process");
spawnSync(process.execPath, [path.join(root, "scripts", "install-pin-asset.mjs"), pinId], { stdio: "inherit", env: { ...process.env, PIN_ASSETS_DIR: assets } });