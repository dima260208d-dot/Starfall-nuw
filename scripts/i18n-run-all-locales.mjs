import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const MSG = path.join(root, "src/i18n/messages");
const LOG = path.join(root, "i18n-persist-run.log");

const ORDER = [
  "de", "es", "fr", "pt", "it", "pl", "uk", "tr", "ar", "he", "ko", "ja",
  "zh", "zh-TW", "vi", "th", "id", "nl", "cs", "sv", "ro", "hu", "el", "ms", "fil", "hi",
];

function log(line) {
  const ts = new Date().toISOString();
  const msg = `[${ts}] ${line}`;
  console.log(msg);
  fs.appendFileSync(LOG, msg + "\n", "utf8");
}

const en = JSON.parse(fs.readFileSync(path.join(MSG, "en.json"), "utf8"));
const results = [];
let startIdx = 0;
const argStart = process.argv.indexOf("--from");
if (argStart >= 0 && process.argv[argStart + 1]) {
  const from = process.argv[argStart + 1];
  startIdx = ORDER.indexOf(from);
  if (startIdx < 0) startIdx = 0;
}

log(`Starting from ${ORDER[startIdx]} (${startIdx + 1}/${ORDER.length})`);

for (let i = startIdx; i < ORDER.length; i++) {
  const loc = ORDER[i];
  log(`========== ${loc} (${i + 1}/${ORDER.length}) ==========`);
  const r = spawnSync("node", ["scripts/i18n-persist-locale.mjs", loc], {
    cwd: root,
    stdio: "inherit",
    encoding: "utf8",
  });
  if (r.status !== 0) log(`WARN: ${loc} exited with code ${r.status}`);

  const data = JSON.parse(fs.readFileSync(path.join(MSG, `${loc}.json`), "utf8"));
  const title = data["settings.title"];
  const translated = title !== undefined && title !== en["settings.title"];
  log(`VERIFY ${loc} settings.title: ${JSON.stringify(title)} vs en: ${JSON.stringify(en["settings.title"])} => ${translated ? "REAL" : "NOT_TRANSLATED"}`);
  results.push({ loc, settingsTitle: title, enTitle: en["settings.title"], realTranslation: translated });
  fs.writeFileSync(path.join(root, "i18n-persist-results.json"), JSON.stringify(results, null, 2), "utf8");
}

log("ALL DONE");
