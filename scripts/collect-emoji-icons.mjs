/**
 * Collect emojis used in src TSX files and list PNGs still missing.
 * Generate with: npm run emojis:generate (needs OPENAI_API_KEY)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

const OVERRIDES = new Set([
  "🎒","🐾","⭐","🏛","🏛️","👥","🛒","🦸","🗝","🗝️","🎨","🎁","📖","✨","💎","💬","📰",
  "⚙","⚙️","⚔","⚔️","🏆","🗺","🗺️","🛡","🛡️","🚪","📝","👤","🎯","🔥","📦","🎭",
]);

function emojiSlug(emoji) {
  return [...emoji].map((c) => "u" + c.codePointAt(0).toString(16).padStart(4, "0")).join("-");
}

const found = new Set();
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const t = fs.readFileSync(full, "utf8");
      let m;
      while ((m = emojiRe.exec(t))) found.add(m[0]);
    }
  }
}
walk(path.join(root, "src"));

const missing = [...found].filter((e) => !OVERRIDES.has(e)).sort();
const outDir = path.join(root, "public", "ui", "emojis");
fs.mkdirSync(outDir, { recursive: true });

const manifest = missing.map((emoji) => ({
  emoji,
  file: `ui/emojis/${emojiSlug(emoji)}.png`,
  prompt: `Single Brawl Stars mobile game UI icon for emoji ${emoji}. Thick black cartoon outlines, vibrant colors, glossy shading, one object centered. NO background, transparent PNG.`,
}));

fs.writeFileSync(
  path.join(root, "scripts", "emoji-icon-manifest.json"),
  JSON.stringify(manifest, null, 2),
);

console.log("TSX emojis:", found.size);
console.log("Need PNG generation:", missing.length);
console.log("Manifest → scripts/emoji-icon-manifest.json");
