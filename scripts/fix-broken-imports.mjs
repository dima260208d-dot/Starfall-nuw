/**
 * Fix imports inserted inside multi-line import blocks by patch scripts.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function fix(content) {
  return content
    .replace(
      /import \{\nimport \{ (Tr|EmojiIcon|TextWithEmojis)([^}]*)\} from "([^"]+)";\n/g,
      (_, sym, rest, from) => `import { ${sym}${rest} } from "${from}";\nimport {\n`,
    )
    .replace(
      /import \{\nimport \{ TextWithEmojis, EmojiIcon \} from "([^"]+)";\n/g,
      (_, from) => `import { TextWithEmojis, EmojiIcon } from "${from}";\nimport {\n`,
    );
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
        console.log("fixed", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("fix-broken-imports done");
