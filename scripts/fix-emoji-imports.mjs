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

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (name.endsWith(".tsx") && !full.endsWith("EmojiIcon.tsx")) {
      let content = fs.readFileSync(full, "utf8");
      if (!content.includes("<EmojiIcon") && !content.includes("EmojiIcon ")) continue;
      if (/import\s*\{[^}]*EmojiIcon/.test(content)) continue;
      const imp = `import { EmojiIcon } from "${relImport(full)}";\n`;
      const lines = content.split("\n");
      let lastImport = -1;
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith("import ")) lastImport = i;
      }
      if (lastImport >= 0) lines.splice(lastImport + 1, 0, imp.trim());
      else lines.unshift(imp.trim());
      fs.writeFileSync(full, lines.join("\n"));
      console.log("import added", path.relative(root, full));
    }
  }
}

walk(srcRoot);
