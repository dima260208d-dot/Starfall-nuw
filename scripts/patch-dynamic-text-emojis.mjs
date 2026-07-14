/** Wrap dynamic text fields with TextWithEmojis for raster emoji rendering. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function relImport(fromFile) {
  const target = path.join(srcRoot, "components", "EmojiIcon.tsx");
  let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "");
}

const REPLACEMENTS = [
  [/\{m\.text\}/g, `<TextWithEmojis text={m.text} emojiSize={16} />`],
  [/\{msg\.text\}/g, `<TextWithEmojis text={msg.text} emojiSize={16} />`],
  [/\{message\.text\}/g, `<TextWithEmojis text={message.text} emojiSize={16} />`],
  [/\{sentMsg\}/g, `<TextWithEmojis text={sentMsg} emojiSize={14} />`],
  [/\{status\}/g, `<TextWithEmojis text={status} emojiSize={14} />`],
];

function patch(content, file) {
  if (file.endsWith("EmojiIcon.tsx")) return content;
  let out = content;
  let changed = false;
  for (const [re, rep] of REPLACEMENTS) {
    if (re.test(out)) {
      out = out.replace(re, rep);
      changed = true;
    }
  }
  if (!changed) return content;
  if (!out.includes("TextWithEmojis")) {
    const imp = `import { TextWithEmojis } from "${relImport(file)}";\n`;
    const lines = out.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, imp.trim());
    out = lines.join("\n");
  }
  return out;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const raw = fs.readFileSync(full, "utf8");
      const next = patch(raw, full);
      if (next !== raw) {
        fs.writeFileSync(full, next);
        console.log("text wrap", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("patch-dynamic-text-emojis done");
