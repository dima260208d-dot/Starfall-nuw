/**
 * Translate locales in parallel (one Node process per locale, worker pool).
 *   node scripts/i18n-persist-parallel.mjs
 *   I18N_PARALLEL=8 I18N_CONCURRENCY=4 I18N_DELAY_MS=150 node scripts/i18n-persist-parallel.mjs
 */
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const MSG = path.join(root, "src/i18n/messages");
const LOG_DIR = path.join(root, "logs", "i18n");
const CONCURRENCY = Math.max(1, Number(process.env.I18N_PARALLEL || 8));
const DELAY_MS = Number(process.env.I18N_DELAY_MS || 150);
const KEY_CONCURRENCY = Number(process.env.I18N_CONCURRENCY || 4);

const ALL = [
  "zh", "zh-TW", "de", "es", "ja", "ko", "fr", "pt", "it", "pl", "uk", "tr",
  "ar", "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "he", "ms", "fil", "hi",
];

const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
const ru = JSON.parse(fs.readFileSync(path.join(MSG, "ru.json"), "utf8"));
const keys = Object.keys(en);

function pending(code) {
  let p = 0;
  let loc = {};
  try {
    loc = JSON.parse(fs.readFileSync(path.join(MSG, `${code}.json`), "utf8"));
  } catch {
    return keys.length;
  }
  for (const k of keys) {
    const v = loc[k];
    if (!v || v === en[k] || (v === ru[k] && ru[k] !== en[k])) p++;
  }
  return p;
}

function log(line) {
  const msg = `[${new Date().toISOString()}] ${line}`;
  console.log(msg);
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, "parallel-run.log"), msg + "\n", "utf8");
}

const filter = process.argv.slice(2);
const queue = (filter.length ? filter : ALL)
  .filter((code) => pending(code) > 0)
  .sort((a, b) => pending(a) - pending(b));

if (queue.length === 0) {
  console.log("All locales complete.");
  process.exit(0);
}

log(`Parallel translate: ${queue.length} locales, locales=${CONCURRENCY}, keys=${KEY_CONCURRENCY}, delay=${DELAY_MS}ms`);
log(`Order: ${queue.join(", ")}`);

function runLocale(code) {
  return new Promise((resolve) => {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const logPath = path.join(LOG_DIR, `${code}.log`);
    const out = fs.createWriteStream(logPath, { flags: "a" });
    out.write(`\n=== ${code} started ${new Date().toISOString()} ===\n`);

    const child = spawn("node", ["scripts/i18n-persist-locale.mjs", code], {
      cwd: root,
      env: { ...process.env, I18N_DELAY_MS: String(DELAY_MS), I18N_CONCURRENCY: String(KEY_CONCURRENCY) },
      stdio: ["ignore", "pipe", "pipe"],
    });

    child.stdout.on("data", (buf) => {
      const s = buf.toString();
      out.write(s);
      process.stdout.write(`[${code}] ${s}`);
    });
    child.stderr.on("data", (buf) => {
      const s = buf.toString();
      out.write(s);
      process.stderr.write(`[${code}!] ${s}`);
    });

    child.on("close", (exitCode) => {
      log(`${code}: exit ${exitCode}, pending=${pending(code)}`);
      out.end();
      resolve(exitCode ?? 1);
    });
  });
}

async function workerPool(items, concurrency, fn) {
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
}

await workerPool(queue, CONCURRENCY, runLocale);

log("Parallel run finished.");
for (const code of queue) {
  const left = pending(code);
  const title = JSON.parse(fs.readFileSync(path.join(MSG, `${code}.json`), "utf8"))["settings.title"];
  const ok = title && title !== en["settings.title"];
  log(`  ${code}: pending=${left}, settings.title=${ok ? "translated" : "stub"}`);
}