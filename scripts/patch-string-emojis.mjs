/**
 * Wrap plain string literals containing emoji in JSX with TextWithEmojis.
 * Handles admin labels, option text, button text, etc.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function relImport(fromFile) {
  const target = path.join(srcRoot, "components", "EmojiIcon.tsx");
  let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "");
}

function patch(content, file) {
  if (file.endsWith("EmojiIcon.tsx")) return content;
  let out = content;
  let changed = false;

  // JSX text nodes with emoji: >⚔️ ПЕРСОНАЖИ<
  out = out.replace(/>([^<{}]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}][^<{}]*)</gu, (full, text) => {
    if (text.includes("EmojiIcon") || text.includes("TextWithEmojis")) return full;
    if (!hasEmoji.test(text)) return full;
    changed = true;
    const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `><TextWithEmojis text="${escaped.trim()}" emojiSize={16} /><`;
  });

  // Inline template in JSX body: `📥 ВХОДЯЩИЕ${x}` not in attribute
  out = out.replace(
    /(?<![=\w])`([^`]*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}][^`]*)`/gu,
    (match, inner) => {
      if (match.includes("EmojiIcon")) return match;
      if (inner.includes("${")) {
        changed = true;
        return `{<>${inner.replace(/\$\{([^}]+)\}/g, (_, e) => `{${e}}`).split(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)/gu).map((p) => {
          if (hasEmoji.test(p)) return `<EmojiIcon emoji="${p}" size={16} />`;
          if (p) return p;
          return "";
        }).join("")}</>}`;
      }
      changed = true;
      return `<TextWithEmojis text={\`${inner}\`} emojiSize={16} />`;
    },
  );

  if (!changed) return content;
  if (!out.includes("TextWithEmojis")) {
    const imp = `import { TextWithEmojis, EmojiIcon } from "${relImport(file)}";\n`;
    const lines = out.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, imp.trim());
    else lines.unshift(imp.trim());
    out = lines.join("\n");
  } else if (!out.includes("EmojiIcon")) {
    const imp = `import { EmojiIcon } from "${relImport(file)}";\n`;
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
        console.log("strings", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("patch-string-emojis complete");
