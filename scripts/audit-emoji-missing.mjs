import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
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

const mapSrc = fs.readFileSync(path.join(root, "src/data/emojiIconMap.ts"), "utf8");
const overrides = new Set();
for (const m of mapSrc.matchAll(/"([^"]+)":\s*"([^"]+)"/g)) overrides.add(m[1]);

function slug(e) {
  return [...e.replace(/\uFE0F/g, "")]
    .map((c) => "u" + c.codePointAt(0).toString(16).padStart(4, "0"))
    .join("-");
}

function resolve(e) {
  const bare = e.replace(/\uFE0F/g, "").trim();
  if (overrides.has(e) || overrides.has(bare)) return "override";
  const p = path.join(root, "public/ui/emojis", slug(bare) + ".png");
  return fs.existsSync(p) ? "file" : "MISSING";
}

const missing = [...found].filter((e) => resolve(e) === "MISSING").sort();
console.log("Truly missing PNG (no override, no file):", missing.length);
console.log(missing.join(" "));
