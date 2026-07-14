/**
 * Batch-translate en.ts strings into scripts/locale-tables/*.json
 * Run: node scripts/translate-locale-tables.cjs
 */
const fs = require("fs");
const path = require("path");
const { translate } = require("@vitalets/google-translate-api");
const { keys, enVals } = require("./parse-en-keys.cjs");

const LOCALES = [
  ["zh", "zh-CN"],
  ["zh-TW", "zh-TW"],
  ["ja", "ja"],
  ["ko", "ko"],
  ["es", "es"],
  ["fr", "fr"],
  ["de", "de"],
  ["pt", "pt"],
  ["it", "it"],
  ["ar", "ar"],
  ["uk", "uk"],
  ["pl", "pl"],
  ["tr", "tr"],
  ["vi", "vi"],
  ["th", "th"],
  ["id", "id"],
  ["nl", "nl"],
  ["cs", "cs"],
  ["sv", "sv"],
  ["ro", "ro"],
  ["hu", "hu"],
  ["el", "el"],
  ["he", "he"],
  ["ms", "ms"],
  ["fil", "tl"],
  ["hi", "hi"],
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Protect brand / game terms from mangling */
const KEEP = [
  ["Starfall", "⟦SF⟧"],
  ["Star Pass", "⟦SP⟧"],
  ["Star Guardian", "⟦SG⟧"],
  ["Star Ball", "⟦SB⟧"],
  ["Star Hunt", "⟦SH⟧"],
  ["MEGA Showdown", "⟦MSD⟧"],
  ["Astral", "⟦AST⟧"],
  ["WASD", "⟦WASD⟧"],
  ["ESC", "⟦ESC⟧"],
  ["LMB", "⟦LMB⟧"],
  ["RMB", "⟦RMB⟧"],
  ["3v3", "⟦3V3⟧"],
  ["5v5", "⟦5V5⟧"],
  ["1.5×", "⟦15X⟧"],
  ["1.5x", "⟦15X⟧"],
];

function protect(s) {
  let out = s;
  for (const [term, token] of KEEP) out = out.split(term).join(token);
  return out;
}

function unprotect(s) {
  let out = s;
  for (const [term, token] of KEEP) out = out.split(token).join(term);
  return out;
}

async function translateBatch(texts, to) {
  const protectedTexts = texts.map(protect);
  const joined = protectedTexts.join("\n⟦SEP⟧\n");
  const { text } = await translate(joined, { from: "en", to });
  return text.split(/\n⟦SEP⟧\n/).map(unprotect);
}

async function translateLocale(loc, googleTo) {
  const table = {};
  const values = keys.map(k => enVals[k]);
  const BATCH = 12;
  for (let i = 0; i < values.length; i += BATCH) {
    const slice = values.slice(i, i + BATCH);
    let tries = 0;
    while (tries < 4) {
      try {
        const translated = await translateBatch(slice, googleTo);
        for (let j = 0; j < slice.length; j++) {
          table[keys[i + j]] = translated[j] ?? slice[j];
        }
        process.stdout.write(`  ${loc} ${Math.min(i + BATCH, values.length)}/${values.length}\r`);
        await sleep(350);
        break;
      } catch (e) {
        tries++;
        console.warn(`\n  retry ${tries} for ${loc}@${i}:`, e.message);
        await sleep(1500 * tries);
      }
    }
  }
  console.log(`\n  done ${loc}`);
  return table;
}

async function main() {
  const outDir = path.join(__dirname, "locale-tables");
  fs.mkdirSync(outDir, { recursive: true });
  for (const [loc, googleTo] of LOCALES) {
    const fname = loc === "zh-TW" ? "zh-TW.json" : `${loc}.json`;
    const outPath = path.join(outDir, fname);
    if (fs.existsSync(outPath)) {
      const existing = JSON.parse(fs.readFileSync(outPath, "utf8"));
      if (keys.every(k => existing[k] && existing[k] !== enVals[k])) {
        console.log("skip", fname, "(complete)");
        continue;
      }
    }
    console.log("Translating", loc, "->", googleTo);
    const table = await translateLocale(loc, googleTo);
    fs.writeFileSync(outPath, JSON.stringify(table, null, 2) + "\n");
  }
  console.log("All locale tables written to", outDir);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
