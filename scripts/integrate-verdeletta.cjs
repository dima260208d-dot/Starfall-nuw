const fs = require("fs");
const path = require("path");
const root = process.cwd();
const prevPath = path.join(root, "src/entities/PreviewBrawlers.ts");
let prev = fs.readFileSync(prevPath, "utf8");
prev = prev.replace(/\n\s*previewBrawler\(\{ id: "verdeletta"[\s\S]*?\}\),/, "");
fs.writeFileSync(prevPath, prev, "utf8");
console.log("PreviewBrawlers updated");
for (const f of fs.readdirSync(path.join(root, "src/modes")).filter(x => x.endsWith(".ts"))) {
  const p = path.join(root, "src/modes", f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("applyZafkielStarEffectsOnHit") || s.includes("applyVerdelettaOnHit")) continue;
  s = s.replace('import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";','import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";\nimport { applyVerdelettaOnHit } from "../utils/verdelettaStars";');
  s = s.replace(/applyZafkielStarEffectsOnHit\(([^)]*)\);/g, "applyZafkielStarEffectsOnHit($1);\n          applyVerdelettaOnHit($1);");
  fs.writeFileSync(p, s, "utf8");
  console.log("patched", f);
}
const keys = {
  "brawler.verdeletta.name": ["\u0412\u0435\u0440\u0434\u0435\u043b\u0435\u0442\u0442\u0430", "Verdeletta"],
  "brawler.verdeletta.role": ["\u041a\u043e\u043d\u0442\u0440\u043e\u043b\u043b\u0435\u0440/\u041f\u0440\u0438\u0437\u044b\u0432\u0430\u0442\u0435\u043b\u044c", "Controller/Summoner"],
  "brawler.verdeletta.description": ["\u0410\u0434\u0441\u043a\u0438\u0439 \u0446\u0435\u0440\u0435\u043c\u043e\u043d\u0438\u043c\u0435\u0439\u0441\u0442\u0435\u0440 \u0441 \u0432\u043e\u043b\u0448\u0435\u0431\u043d\u044b\u043c \u043f\u0438\u0441\u0442\u043e\u043b\u0435\u0442\u043e\u043c \u0438 \u0430\u0440\u043c\u0438\u0435\u0439 \u0442\u0435\u043d\u0435\u0439", "Hell ceremony master with a magic pistol and shadow army"],
  "brawler.verdeletta.lore": ["\u00ab\u0414\u043e\u0431\u0440\u043e \u043f\u043e\u0436\u0430\u043b\u043e\u0432\u0430\u0442\u044c \u043d\u0430 \u043c\u043e\u0439 \u0431\u0430\u043b. \u0412\u0445\u043e\u0434 \u2014 \u0434\u0443\u0448\u0430. \u0412\u044b\u0445\u043e\u0434\u0430 \u043d\u0435\u0442.\u00bb", "Welcome to my ball. Entry is your soul. There is no exit."],
  "brawler.verdeletta.attackName": ["\u0410\u0434\u0441\u043a\u043e\u0435 \u043f\u0440\u0438\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435", "Hell Invitation"],
  "brawler.verdeletta.superName": ["\u0411\u0430\u043b \u0441\u0430\u0442\u0430\u043d\u044b", "Satan Ball"],
  "brawler.verdeletta.attackDesc": ["\u041f\u0443\u043b\u044f \u043d\u0430\u043a\u043b\u0430\u0434\u044b\u0432\u0430\u0435\u0442 \u041c\u0435\u0442\u043a\u0443 \u043d\u0430 2 \u0441\u0435\u043a. \u0423\u0440\u043e\u043d 600, 3 \u0437\u0430\u0440\u044f\u0434\u0430.", "Bullet applies a 2s Brand. 600 damage, 3 charges."],
  "brawler.verdeletta.superDesc": ["\u041f\u0440\u0438\u0437\u044b\u0432\u0430\u0435\u0442 3 \u0442\u0435\u043d\u0438-\u0440\u0430\u0441\u043f\u043e\u0440\u044f\u0434\u0438\u0442\u0435\u043b\u044f.", "Summons 3 steward shadows."],
  "star.verdeletta.1.name": ["\u0411\u0435\u0441\u043a\u043e\u043d\u0435\u0447\u043d\u044b\u0439 \u0431\u0430\u043d\u043a\u0435\u0442", "Endless Banquet"],
  "star.verdeletta.1.effect": ["\u041c\u0435\u0442\u043a\u0430 \u0434\u043b\u0438\u0442\u0441\u044f 3 \u0441\u0435\u043a.", "Brand lasts 3 seconds."],
  "star.verdeletta.2.name": ["\u041e\u0441\u0442\u0440\u044b\u0435 \u043a\u0430\u0431\u043b\u0443\u043a\u0438", "Sharp Heels"],
  "star.verdeletta.2.effect": ["\u0423\u0440\u043e\u043d \u043e\u0431\u044b\u0447\u043d\u043e\u0439 \u0422\u0435\u043d\u0438: 450.", "Normal Shadow damage: 450."],
  "star.verdeletta.3.name": ["\u0422\u0430\u043d\u0446\u043f\u043e\u043b", "Dance Floor"],
  "star.verdeletta.3.effect": ["+\u043020% \u0441\u043a\u043e\u0440\u043e\u0441\u0442\u0438 \u043d\u0430 2 \u0441\u0435\u043a \u043f\u0440\u0438 \u0441\u043f\u0430\u0432\u043d\u0435 \u0442\u0435\u043d\u0438.", "+20% speed for 2s when a shadow spawns."],
  "star.verdeletta.4.name": ["VIP-\u043b\u043e\u0436\u0430", "VIP Box"],
  "star.verdeletta.4.effect": ["\u0421\u0443\u043f\u0435\u0440 \u043f\u0440\u0438\u0437\u044b\u0432\u0430\u0435\u0442 4 \u0442\u0435\u043d\u0438.", "Super summons 4 steward shadows."],
  "star.verdeletta.5.name": ["\u0410\u0434\u0441\u043a\u0438\u0439 \u0434\u0436\u0430\u0437", "Hell Jazz"],
  "star.verdeletta.5.effect": ["\u0423\u0431\u0438\u0439\u0441\u0442\u0432\u043e \u043e\u0431\u044b\u0447\u043d\u043e\u0439 \u0442\u0435\u043d\u0438: +300 HP \u0438 10 \u0441\u0435\u043a.", "Normal shadow kill: +300 HP and 10s life."],
  "star.verdeletta.6.name": ["\u0412\u043b\u0430\u0434\u044b\u043a\u0430 \u043f\u0440\u0435\u0438\u0441\u043f\u043e\u0434\u043d\u0435\u0439", "Lord of Underworld"],
  "star.verdeletta.6.effect": ["\u0420\u0430\u0441\u043f\u043e\u0440\u044f\u0434\u0438\u0442\u0435\u043b\u0438: 5400 HP, 750 \u0443\u0440\u043e\u043d\u0430, \u043c\u0430\u043a\u0441 9.", "Stewards: 5400 HP, 750 dmg, max 9."],
};
for (const loc of ["ru", "en"]) {
  const p = path.join(root, "src/i18n/messages/" + loc + ".json");
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [k, v] of Object.entries(keys)) j[k] = v[loc === "ru" ? 0 : 1];
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("i18n", loc);
}
