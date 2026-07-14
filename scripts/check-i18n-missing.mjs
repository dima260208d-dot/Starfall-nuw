import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src");
const ru = JSON.parse(fs.readFileSync(path.join(root, "i18n/messages/ru.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "i18n/messages/en.json"), "utf8"));
const keys = new Set();

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name !== "node_modules") walk(p);
      continue;
    }
    if (!/\.(tsx?|jsx?)$/.test(ent.name)) continue;
    const t = fs.readFileSync(p, "utf8");
    for (const re of [/t\(["']([^"']+)["']/g, /Tr id=["']([^"']+)["']/g, /translate\(["']([^"']+)["']/g]) {
      for (const m of t.matchAll(re)) keys.add(m[1]);
    }
  }
}
walk(root);

const missRu = [...keys].filter((k) => !(k in ru)).sort();
const missEn = [...keys].filter((k) => !(k in en)).sort();
console.log("missing ru:", missRu.length);
for (const k of missRu) console.log(" ", k);
console.log("missing en:", missEn.length);
for (const k of missEn) console.log(" ", k);
