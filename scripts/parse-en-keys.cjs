const fs = require("fs");
const path = require("path");

const enPath = path.join(__dirname, "../src/i18n/translations/en.ts");
const enSrc = fs.readFileSync(enPath, "utf8");
const keys = [];
const enVals = {};
for (const line of enSrc.split("\n")) {
  const m = line.match(/^\s*"([^"]+)":\s*"(.*)",?\s*$/);
  if (!m) continue;
  keys.push(m[1]);
  enVals[m[1]] = m[2].replace(/\\"/g, '"');
}
module.exports = { keys, enVals };
