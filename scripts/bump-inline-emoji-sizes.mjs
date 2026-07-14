/**
 * Bump small inline emoji icon sizes ×1.5 (buttons, labels with text).
 * 12→18, 14→21, 16→24
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const MAP = [
  [/emojiSize=\{12\}/g, "emojiSize={18}"],
  [/emojiSize=\{14\}/g, "emojiSize={21}"],
  [/emojiSize=\{16\}/g, "emojiSize={24}"],
  [/EmojiIcon([^>]*?)size=\{12\}/g, "EmojiIcon$1size={18}"],
  [/EmojiIcon([^>]*?)size=\{14\}/g, "EmojiIcon$1size={21}"],
  [/EmojiIcon([^>]*?)size=\{16\}/g, "EmojiIcon$1size={24}"],
];

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      let src = fs.readFileSync(full, "utf8");
      const orig = src;
      for (const [re, rep] of MAP) src = src.replace(re, rep);
      if (src !== orig) {
        fs.writeFileSync(full, src);
        console.log("bumped", path.relative(root, full).replace(/\\/g, "/"));
      }
    }
  }
}

walk(root);
console.log("done");
