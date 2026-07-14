/**
 * Writes scripts/locale-tables/*.json with hand-tuned game UI translations.
 * Run: node scripts/seed-locale-tables.cjs
 */
const fs = require("fs");
const path = require("path");
const { keys, enVals } = require("./parse-en-keys.cjs");

/** @type {Record<string, Record<string, string>>} */
const tables = require("./locale-tables-seed-data.cjs");

const LOCALES = [
  "zh", "zh-TW", "ja", "ko", "es", "fr", "de", "pt", "it", "ar", "uk", "pl", "tr",
  "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "he", "ms", "fil", "hi",
];

const outDir = path.join(__dirname, "locale-tables");
fs.mkdirSync(outDir, { recursive: true });

for (const loc of LOCALES) {
  const table = tables[loc];
  if (!table) {
    console.error("Missing table for", loc);
    process.exit(1);
  }
  const missing = keys.filter(k => !table[k]);
  if (missing.length) {
    console.error(loc, "missing", missing.length, missing.slice(0, 8).join(", "));
    process.exit(1);
  }
  const english = keys.filter(k => table[k] === enVals[k]);
  if (english.length) {
    console.warn(loc, "still English:", english.length, english.slice(0, 5).join(", "));
  }
  const fname = loc === "zh-TW" ? "zh-TW.json" : `${loc}.json`;
  fs.writeFileSync(path.join(outDir, fname), JSON.stringify(table, null, 2) + "\n");
  console.log("Wrote", fname);
}

console.log("Done:", LOCALES.length, "locales,", keys.length, "keys each");
