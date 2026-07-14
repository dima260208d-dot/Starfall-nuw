/**
 * Find JSX that likely renders raw Unicode emoji (not via EmojiIcon/TextWithEmojis/Tr).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu;

const issues = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (rel === "components/EmojiIcon.tsx" || rel === "i18n/Tr.tsx") continue;
      const lines = fs.readFileSync(full, "utf8").split("\n");
      lines.forEach((line, i) => {
        if (!emojiRe.test(line)) return;
        emojiRe.lastIndex = 0;
        // skip emoji="..." props and import lines, comments
        if (/emoji\s*=/.test(line)) return;
        if (/^\s*(\/\/|\*|import)/.test(line)) return;
        if (/TextWithEmojis|EmojiIcon|<Tr\b/.test(line)) return;
        if (/emojiIconMap|OVERRIDES/.test(line)) return;
        // skip string keys in data (still might render - flag separately)
        if (/^\s*(const|let|type|interface|export)/.test(line) && !/>/.test(line)) return;
        // JSX text content with emoji
        if (/>[^<{]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line) ||
            /\{[^}]*["'][\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(line) ||
            /\{icon\}|\{emoji\}|\{cat\?\.icon/.test(line)) {
          issues.push({ file: rel, line: i + 1, text: line.trim().slice(0, 120) });
        }
      });
    }
  }
}

walk(root);

// t() in JSX without Tr - keys with emoji in i18n
const i18n = JSON.parse(fs.readFileSync(path.join(root, "i18n/messages/ru.json"), "utf8"));
const emojiKeys = new Set(Object.entries(i18n).filter(([, v]) => emojiRe.test(v)).map(([k]) => k));
emojiRe.lastIndex = 0;

function walkT(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walkT(full);
    else if (name.endsWith(".tsx")) {
      const rel = path.relative(root, full).replace(/\\/g, "/");
      const src = fs.readFileSync(full, "utf8");
      const lines = src.split("\n");
      lines.forEach((line, i) => {
        if (!/\bt\s*\(\s*["']/.test(line)) return;
        if (/<Tr\b/.test(line)) return;
        const m = line.match(/\bt\s*\(\s*["']([^"']+)["']/);
        if (m && emojiKeys.has(m[1])) {
          issues.push({ file: rel, line: i + 1, text: `t("${m[1]}") without Tr`, kind: "t-no-tr" });
        }
      });
    }
  }
}
walkT(root);

console.log(`Found ${issues.length} potential raw emoji render sites:\n`);
for (const x of issues.slice(0, 80)) {
  console.log(`${x.file}:${x.line}: ${x.text}`);
}
if (issues.length > 80) console.log(`... and ${issues.length - 80} more`);
