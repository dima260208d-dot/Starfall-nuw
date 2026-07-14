/** Remove patch-string-emojis artifacts from template literals and JSX. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");
const ART = "} emojiSize={16} />";

function fix(content) {
  let out = content;

  // Broken template literal opener injected by patch-string-emojis
  out = out.replace(new RegExp("`" + ART.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "`");

  // Double-wrapped TextWithEmojis
  out = out.replace(
    /<TextWithEmojis text=<TextWithEmojis text=\{([^}]+)\} emojiSize=\{16\} \/> emojiSize=\{16\} \/>/g,
    "<TextWithEmojis text={$1} emojiSize={16} />",
  );

  // Broken template literal tail from patch-string-emojis
  out = out.replace(/}<TextWithEmojis text=\{`,/g, "}`,");
  out = out.replace(/}<TextWithEmojis text=\{`/g, "}`");
  out = out.replace(/\)<TextWithEmojis text=\{`,/g, ")`,");
  out = out.replace(/\)<TextWithEmojis text=\{`/g, ")`");

  // Broken import { \n import { EmojiIcon
  out = out.replace(
    /import \{\nimport \{ EmojiIcon \} from "([^"]+)";\n/g,
    'import { EmojiIcon } from "$1";\nimport {\n',
  );
  out = out.replace(
    /import \{\nimport \{ TextWithEmojis(?:, EmojiIcon)? \} from "([^"]+)";\n/g,
    'import { TextWithEmojis$1 } from "$1";\nimport {\n'.replace("$1 }", ", EmojiIcon }"),
  );

  return out;
}

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx")) {
      const raw = fs.readFileSync(full, "utf8");
      const next = fix(raw);
      if (next !== raw) {
        fs.writeFileSync(full, next);
        console.log("cleaned", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("cleanup-emoji-artifacts done");
