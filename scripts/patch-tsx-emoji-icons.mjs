/**
 * Replaces standalone emoji in JSX with EmojiIcon across src TSX files.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

function relImport(fromFile) {
  const fromDir = path.dirname(fromFile);
  const target = path.join(srcRoot, "components", "EmojiIcon.tsx");
  let rel = path.relative(fromDir, target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "");
}

function patch(content, file) {
  let out = content;
  let changed = false;

  // >🔥< or > 🔥 <
  out = out.replace(/>([\s]*)([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+)([\s]*)</gu, (_, pre, em, post) => {
    if (em.length > 8) return _;
    changed = true;
    const size = em.length > 1 ? 24 : 20;
    return `>${pre}<EmojiIcon emoji="${em}" size={${size}} />${post}<`;
  });

  // icon: "🔥" in object literals (SideButton etc.) — skip, imgSrc preferred

  // {"🔥"} or {'🔥'} alone in JSX
  out = out.replace(/\{\s*["']([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]+)["']\s*\}/gu, (_, em) => {
    changed = true;
    return `<EmojiIcon emoji="${em}" size={20} />`;
  });

  if (!changed) return content;
  if (!out.includes("EmojiIcon")) {
    const imp = `import { EmojiIcon } from "${relImport(file)}";\n`;
    if (out.includes("import ")) {
      out = out.replace(/^(import .+\n)(?!import )/m, (m) => m + imp.replace(/^import /, "import "));
      // insert after first import block
      const idx = out.lastIndexOf("\n", out.indexOf("\n\n"));
      out = out.slice(0, idx + 1) + imp + out.slice(idx + 1);
    } else {
      out = imp + out;
    }
  }
  return out;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx") && !full.includes("EmojiIcon.tsx")) {
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
console.log("Emoji patch complete");
