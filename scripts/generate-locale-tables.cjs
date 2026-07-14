/**
 * Generates scripts/locale-tables/*.json from embedded game UI translations.
 * Run: node scripts/generate-locale-tables.cjs
 */
const fs = require("fs");
const path = require("path");
const { keys, enVals } = require("./parse-en-keys.cjs");

const LOCALES = [
  "zh", "zh-TW", "ja", "ko", "es", "fr", "de", "pt", "it", "ar", "uk", "pl", "tr",
  "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "he", "ms", "fil", "hi",
];

// Load per-locale translation tables (key -> string)
const dataPath = path.join(__dirname, "locale-tables-data");
const tables = {};
for (const loc of LOCALES) {
  const fname = loc === "zh-TW" ? "zh-TW.json" : `${loc}.json`;
  const fp = path.join(dataPath, fname);
  if (!fs.existsSync(fp)) {
    console.error("Missing", fp);
    process.exit(1);
  }
  tables[loc] = JSON.parse(fs.readFileSync(fp, "utf8"));
}

const outDir = path.join(__dirname, "locale-tables");
fs.mkdirSync(outDir, { recursive: true });

for (const loc of LOCALES) {
  const table = tables[loc];
  const missing = keys.filter(k => !table[k]);
  if (missing.length) {
    console.error(loc, "missing keys:", missing.length, missing.slice(0, 5).join(", "));
    process.exit(1);
  }
  const extra = Object.keys(table).filter(k => !keys.includes(k));
  if (extra.length) console.warn(loc, "extra keys:", extra.length);
  const fname = loc === "zh-TW" ? "zh-TW.json" : `${loc}.json`;
  fs.writeFileSync(path.join(outDir, fname), JSON.stringify(table, null, 2) + "\n");
  console.log("Wrote", fname, Object.keys(table).length, "keys");
}
