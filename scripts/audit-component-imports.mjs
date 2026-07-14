import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const checks = [
  { name: "TextWithEmojis", use: /<TextWithEmojis\b/, import: /import\s*\{[^}]*\bTextWithEmojis\b[^}]*\}\s*from/ },
  { name: "EmojiIcon", use: /<EmojiIcon\b/, import: /import\s*\{[^}]*\bEmojiIcon\b[^}]*\}\s*from/ },
  { name: "Tr", use: /<Tr\b/, import: /import\s*\{[^}]*\bTr\b[^}]*\}\s*from/ },
];

const issues = [];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const rel = path.relative(root, full).replace(/\\/g, "/");
      if (rel === "i18n/Tr.tsx" || rel === "components/EmojiIcon.tsx") continue;
      const src = fs.readFileSync(full, "utf8");
      for (const { name: comp, use, import: imp } of checks) {
        if (use.test(src) && !imp.test(src)) {
          issues.push({ file: rel, component: comp });
        }
      }
      if (src.includes("<TextWithEmojis text={`") || src.includes("translateY(") && src.includes("<TextWithEmojis")) {
        issues.push({ file: rel, component: "CORRUPTED_PATCH" });
      }
    }
  }
}

walk(root);
console.log("Missing imports / corruption:");
for (const i of issues) console.log(`  ${i.file}: ${i.component}`);
console.log(`Total: ${issues.length}`);
