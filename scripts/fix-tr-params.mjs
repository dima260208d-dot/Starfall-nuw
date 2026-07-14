/** Fix malformed <Tr params={{ ...} />)} from patch-i18n-tr.mjs */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function fix(content) {
  return content.replace(
    /<Tr id="([^"]+)" params=\{\{([^]*?)\} \/>\)\}/g,
    (_, id, inner) => `<Tr id="${id}" params={{${inner}) }} />`,
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
        console.log("fixed Tr", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("fix-tr-params done");
