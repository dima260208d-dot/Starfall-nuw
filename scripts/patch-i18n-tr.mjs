/**
 * Replace JSX {t("key")} with <Tr id="key" /> for emoji-capable rendering.
 * Skips string attributes (title=, placeholder=, aria-label=) — those use stripEmoji via t().
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcRoot = path.join(root, "src");

function relImport(fromFile) {
  const target = path.join(srcRoot, "i18n", "Tr.tsx");
  let rel = path.relative(path.dirname(fromFile), target).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.tsx$/, "");
}

function patchFile(content, file) {
  if (file.includes("Tr.tsx") || file.includes("I18nProvider")) return content;
  let out = content;
  let changed = false;

  // {t("key")} or {t('key')} or {t("key", params)} — not after = (attribute)
  out = out.replace(
    /(?<![=\w]){\s*t\(\s*(["'])([^"']+)\1(?:\s*,\s*([^)]+))?\s*\)\s*}/g,
    (match, q, key, params, offset, str) => {
      // skip if inside attribute: title={t(...)} already handled; title={t} - check char before {
      const before = str.slice(Math.max(0, offset - 20), offset);
      if (/=\s*$/.test(before) || /:\s*$/.test(before)) return match;
      changed = true;
      if (params) return `<Tr id=${q}${key}${q} params={${params.trim()}} />`;
      return `<Tr id=${q}${key}${q} />`;
    },
  );

  if (!changed) return content;
  if (!out.includes('from "../i18n/Tr"') && !out.includes('from "./i18n/Tr"') && !out.includes("Tr.tsx")) {
    const imp = `import { Tr } from "${relImport(file)}";\n`;
    const lines = out.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    if (lastImport >= 0) lines.splice(lastImport + 1, 0, imp.trim());
    else lines.unshift(imp.trim());
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
      const next = patchFile(raw, full);
      if (next !== raw) {
        fs.writeFileSync(full, next);
        console.log("i18n Tr", path.relative(root, full));
      }
    }
  }
}

walk(srcRoot);
console.log("patch-i18n-tr complete");
