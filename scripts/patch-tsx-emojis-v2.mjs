/**
 * Comprehensive emoji → EmojiIcon / TextWithEmojis patch for TSX files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const emojiChar = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
const emojiRun = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+/gu;

function relImport(fromFile, targetRel) {
  const fromDir = path.dirname(fromFile);
  const target = path.join(srcRoot, targetRel);
  let rel = path.relative(fromDir, target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "");
}

function ensureImport(content, file, spec) {
  if (content.includes(spec.name)) return content;
  const imp = `import { ${spec.name} } from "${relImport(file, spec.path)}";\n`;
  const lines = content.split("\n");
  let lastImport = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("import ")) lastImport = i;
  }
  if (lastImport >= 0) lines.splice(lastImport + 1, 0, imp.trim());
  else lines.unshift(imp.trim());
  return lines.join("\n");
}

function patch(content, file) {
  let out = content;
  let changed = false;
  let needEmoji = false;
  let needText = false;

  if (file.endsWith("EmojiIcon.tsx")) return content;

  // Skip already-wrapped emoji="..."
  const skipZones = [];
  for (const m of out.matchAll(/emoji="[^"]*"/g)) skipZones.push([m.index, m.index + m[0].length]);

  function inSkip(i) {
    return skipZones.some(([a, b]) => i >= a && i < b);
  }

  // >🔥 text< or > 🔥 <
  out = out.replace(/>([\s]*)([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)([\s]*)</gu, (_, pre, em, post) => {
    changed = true;
    needEmoji = true;
    const size = [...em.replace(/\uFE0F/g, "")].length > 1 ? 22 : 20;
    return `>${pre}<EmojiIcon emoji="${em.replace(/"/g, '\\"')}" size={${size}} />${post}<`;
  });

  // Text before JSX expr: 👥 {foo}
  out = out.replace(
    /^(\s*)([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)\s+(\{)/gmu,
    (_, indent, em, brace) => {
      changed = true;
      needEmoji = true;
      return `${indent}<EmojiIcon emoji="${em}" size={18} /> ${brace}`;
    },
  );

  // Template literal title={`🏆 ${t(` → split
  out = out.replace(
    /`([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)\s*\$\{/gu,
    (_, em) => {
      changed = true;
      needEmoji = true;
      return `" + /*emoji*/ "<EmojiIcon emoji=\\"${em}\\" size={20} /> " + `;
    },
  );
  // Simpler: title={`🏆 ${t("x")}`} pattern
  out = out.replace(
    /title=\{`([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)\s*\$\{([^}]+)\}`\}/gu,
    (_, em, expr) => {
      changed = true;
      needEmoji = true;
      return `title={${expr}} /* was: ${em} */`;
    },
  );

  // {"🔥"} or {'🔥'}
  out = out.replace(/\{\s*["']([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)["']\s*\}/gu, (_, em) => {
    changed = true;
    needEmoji = true;
    return `<EmojiIcon emoji="${em}" size={20} />`;
  });

  // Array tuples ["key", "🔥 LABEL"]
  out = out.replace(
    /\[\s*["']([^"']+)["']\s*,\s*["']([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D]+)\s*([^"']*)["']\s*\]/gu,
    (_, key, em, rest) => {
      changed = true;
      needEmoji = true;
      return `[${JSON.stringify(key)}, <>${`<EmojiIcon emoji="${em}" size={16} />`}${rest ? ` ${JSON.stringify(rest.trim())}` : ""}</>]`;
    },
  );

  // {var.icon} and {cat.icon} and {star.icon} and {c.icon} and {item.icon} when icon is emoji field
  out = out.replace(/\{([a-zA-Z_][\w?.]*\.icon)\}/g, (_, expr) => {
    if (out.includes(`<EmojiIcon emoji={${expr}}`)) return `{${expr}}`;
    changed = true;
    needEmoji = true;
    return `<EmojiIcon emoji={${expr}} size={18} />`;
  });

  // {message.text} in chat-like divs → TextWithEmojis
  out = out.replace(/\{message\.text\}/g, () => {
    changed = true;
    needText = true;
    return `<TextWithEmojis text={message.text} emojiSize={16} />`;
  });

  // return "🎁"; in render helpers → return emoji string kept for rewardIcon switch - patch separately

  if (!changed) return content;

  if (needEmoji) out = ensureImport(out, file, { name: "EmojiIcon", path: "components/EmojiIcon.tsx" });
  if (needText) out = ensureImport(out, file, { name: "TextWithEmojis", path: "components/EmojiIcon.tsx" });

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
        console.log("patched", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("patch-tsx-emojis-v2 complete");
