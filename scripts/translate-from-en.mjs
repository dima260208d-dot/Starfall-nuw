/**
 * Translate message catalogs → locale JSON files (resumable).
 *
 * Usage:
 *   node scripts/translate-from-en.mjs              # all locales, missing keys only
 *   node scripts/translate-from-en.mjs de ar       # specific locales
 *   FORCE=1 node scripts/translate-from-en.mjs de  # re-translate locale
 *
 * Env:
 *   I18N_SOURCE=ru     — translate from ru.json (recommended for this game)
 *   I18N_PROVIDER=mymemory — MyMemory only (default; Google often rate-limits)
 *   I18N_CONCURRENCY=1
 *   I18N_DELAY_MS=550
 *   MYMEMORY_EMAIL=you@mail.com — higher MyMemory daily quota
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "@vitalets/google-translate-api";

const { translate } = pkg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MSG = path.join(__dirname, "../src/i18n/messages");
const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
const useRuSource = process.env.I18N_SOURCE === "ru";
const source = useRuSource
  ? JSON.parse(fs.readFileSync(path.join(MSG, "ru.json"), "utf8"))
  : en;
const sourceLang = useRuSource ? "ru" : "en";
const keys = Object.keys(en);

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

const KEEP = [
  ["Starfall", "⟦SF⟧"],
  ["Star Pass", "⟦SP⟧"],
  ["Star Guardian", "⟦SG⟧"],
  ["Star Strike", "⟦STK⟧"],
  ["Star Battle", "⟦SBTL⟧"],
  ["Star Hunt", "⟦SH⟧"],
  ["Star Siege", "⟦SSG⟧"],
  ["Crystal Carry", "⟦CC⟧"],
  ["Crystal Void", "⟦CV⟧"],
  ["Fallen Crown", "⟦FC⟧"],
  ["Mega Star Battle", "⟦MSB⟧"],
  ["MEGA Showdown", "⟦MSD⟧"],
  ["Astral", "⟦AST⟧"],
  ["WASD", "⟦WASD⟧"],
  ["ESC", "⟦ESC⟧"],
  ["LMB", "⟦LMB⟧"],
  ["RMB", "⟦RMB⟧"],
  ["3v3", "⟦3V3⟧"],
  ["5v5", "⟦5V5⟧"],
  ["×1.5", "⟦15X⟧"],
  ["1.5×", "⟦15X2⟧"],
  ["STARFALL", "⟦SF2⟧"],
  ["BATTLE ARENA", "⟦BA⟧"],
];

function protect(s) {
  let out = s;
  for (const [a, b] of KEEP) out = out.split(a).join(b);
  return out;
}

function unprotect(s) {
  let out = s;
  for (const [a, b] of KEEP) out = out.split(b).join(a);
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const filter = process.argv.slice(2);
const force = process.env.FORCE === "1";
const PROVIDER = process.env.I18N_PROVIDER || "mymemory";
const CONCURRENCY = Number(process.env.I18N_CONCURRENCY || 1);
const BATCH_DELAY_MS = Number(process.env.I18N_DELAY_MS || 550);
const MYMEMORY_EMAIL = process.env.MYMEMORY_EMAIL || "";

const targets = filter.length
  ? LOCALES.filter(([c]) => filter.includes(c))
  : LOCALES;

let googleBlocked = PROVIDER === "mymemory";

function needsTranslation(k, out) {
  if (force) return true;
  const cur = out[k];
  if (!cur) return true;
  // Still English stub
  if (cur === en[k]) return true;
  // Untranslated copy of Russian source when translating from RU
  if (useRuSource && cur === source[k] && source[k] !== en[k]) return true;
  return false;
}

async function trMyMemory(text, apiTo) {
  const wrapped = protect(text);
  const params = new URLSearchParams({
    q: wrapped.slice(0, 480),
    langpair: `${sourceLang}|${apiTo}`,
  });
  if (MYMEMORY_EMAIL) params.set("de", MYMEMORY_EMAIL);
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(`https://api.mymemory.translated.net/get?${params}`);
      const data = await res.json();
      const out = data?.responseData?.translatedText;
      const warn = data?.responseStatus;
      if (warn && warn >= 429) {
        await sleep(15000 * (attempt + 1));
        continue;
      }
      if (out && !/MYMEMORY WARNING|QUOTA|INVALID/i.test(out)) {
        const fixed = unprotect(out);
        if (fixed && fixed !== text) return fixed;
      }
    } catch {
      /* retry */
    }
    await sleep(1500 * (attempt + 1));
  }
  return null;
}

async function trOne(text, apiTo) {
  const wrapped = protect(text);
  if (!googleBlocked && PROVIDER === "auto") {
    try {
      const r = await translate(wrapped.slice(0, 4500), {
        from: sourceLang,
        to: apiTo,
      });
      if (r?.text) {
        const fixed = unprotect(r.text);
        if (fixed && fixed !== text) return fixed;
      }
    } catch (e) {
      if (/too many/i.test(String(e?.message ?? e))) googleBlocked = true;
    }
  }
  return trMyMemory(text, apiTo);
}

function loadPartial(outPath) {
  if (!fs.existsSync(outPath)) return {};
  try {
    const j = JSON.parse(fs.readFileSync(outPath, "utf8"));
    return typeof j === "object" && j ? j : {};
  } catch {
    return {};
  }
}

async function translateLocale(code, apiTo) {
  const outPath = path.join(MSG, `${code}.json`);
  let out = loadPartial(outPath);

  const pending = keys.filter((k) => needsTranslation(k, out));
  if (pending.length === 0) {
    console.log(`Skip ${code} (already fully translated)`);
    return;
  }

  console.log(
    `\n=== ${code} (${apiTo}) — ${pending.length} keys [${sourceLang}→${apiTo}] ===`,
  );

  let done = 0;
  for (let i = 0; i < pending.length; i += CONCURRENCY) {
    const batch = pending.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (k) => {
        const srcText = source[k] ?? en[k];
        const translated = await trOne(srcText, apiTo);
        if (translated) {
          out[k] = translated;
          done++;
        }
      }),
    );
    if (i % (CONCURRENCY * 20) === 0 && i > 0) {
      fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
    }
    process.stdout.write(
      `\r${code}: ${Math.min(i + CONCURRENCY, pending.length)}/${pending.length} (+${done} ok)`,
    );
    if (i + CONCURRENCY < pending.length) await sleep(BATCH_DELAY_MS);
  }

  for (const k of keys) {
    if (!out[k]) out[k] = en[k];
  }
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
  const translated = keys.filter((k) => out[k] !== en[k]).length;
  console.log(`\nDone ${code} (${translated}/${keys.length} non-English)`);
}

console.log(
  `Source: ${sourceLang}.json | Provider: ${PROVIDER} | ${targets.length} locale(s)`,
);

for (const [code, apiTo] of targets) {
  await translateLocale(code, apiTo);
}

console.log("\nAll locales processed.");
