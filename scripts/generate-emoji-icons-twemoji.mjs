/**
 * Download raster PNG emoji icons (Twemoji CDN) and process for transparency.
 * Fallback when OPENAI_API_KEY is unavailable.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = path.join(root, "scripts", "emoji-icon-manifest.json");
const outDir = path.join(root, "public", "ui", "emojis");

function emojiSlug(emoji) {
  return [...emoji].map((c) => "u" + c.codePointAt(0).toString(16).padStart(4, "0")).join("-");
}

function twemojiCode(emoji) {
  return [...emoji].map((c) => c.codePointAt(0).toString(16)).join("-");
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;
const found = new Set();

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx?|json)$/.test(name)) {
      const t = fs.readFileSync(full, "utf8");
      let m;
      while ((m = emojiRe.exec(t))) found.add(m[0]);
    }
  }
}
walk(path.join(root, "src"));

const manifest = [...found].sort().map((emoji) => ({
  emoji,
  file: `ui/emojis/${emojiSlug(emoji)}.png`,
}));

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
fs.mkdirSync(outDir, { recursive: true });

const TWEMOJI = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72";
let ok = 0;
let fail = 0;

for (const item of manifest) {
  const dest = path.join(root, "public", item.file);
  if (fs.existsSync(dest) && !process.env.FORCE_EMOJI) {
    ok++;
    continue;
  }
  const code = twemojiCode(item.emoji);
  const url = `${TWEMOJI}/${code}.png`;
  try {
    await download(url, dest);
    console.log("OK", item.emoji, item.file);
    ok++;
  } catch (e) {
    console.warn("FAIL", item.emoji, e.message);
    fail++;
  }
}

spawnSync(process.execPath, [path.join(root, "scripts", "process-ui-icons.mjs"), outDir], {
  stdio: "inherit",
});

console.log(`\nDone: ${ok} icons, ${fail} failed, manifest ${manifest.length} emojis.`);
