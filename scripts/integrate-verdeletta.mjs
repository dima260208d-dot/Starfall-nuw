import fs from "fs";
import path from "path";

const root = path.resolve(".");

// PreviewBrawlers - remove verdeletta
const prevPath = path.join(root, "src/entities/PreviewBrawlers.ts");
let prev = fs.readFileSync(prevPath, "utf8");
prev = prev.replace(/\n\s*previewBrawler\(\{ id: "verdeletta"[\s\S]*?\}\),/, "");
fs.writeFileSync(prevPath, prev, "utf8");
console.log("PreviewBrawlers updated");

// Patch game modes
const modesDir = path.join(root, "src/modes");
for (const f of fs.readdirSync(modesDir).filter(x => x.endsWith(".ts"))) {
  const p = path.join(modesDir, f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("applyZafkielStarEffectsOnHit")) continue;
  if (s.includes("applyVerdelettaOnHit")) continue;
  s = s.replace(
    'import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";',
    'import { applyZafkielStarEffectsOnHit } from "../utils/zafkielStars";\nimport { applyVerdelettaOnHit } from "../utils/verdelettaStars";',
  );
  s = s.replace(
    /applyZafkielStarEffectsOnHit\(([^)]*)\);/g,
    "applyZafkielStarEffectsOnHit($1);\n          applyVerdelettaOnHit($1);",
  );
  fs.writeFileSync(p, s, "utf8");
  console.log("patched mode", f);
}

const i18nKeys = {
  "brawler.verdeletta.name": ["Верделетта", "Verdeletta"],
  "brawler.verdeletta.role": ["Контроллер/Призыватель", "Controller/Summoner"],
  "brawler.verdeletta.description": ["Адский церемонимейстер с волшебным пистолетом и армией теней", "Hell ceremony master with a magic pistol and shadow army"],
  "brawler.verdeletta.lore": ["«Добро пожаловать на мой бал. Вход — душа. Выхода нет.»", "Welcome to my ball. Entry — your soul. There is no exit."],
  "brawler.verdeletta.attackName": ["Адское приглашение", "Hell Invitation"],
  "brawler.verdeletta.superName": ["Бал сатаны", "Satan's Ball"],
  "brawler.verdeletta.attackDesc": ["Пуля накладывает Метку на 2 сек. Урон 600, 3 заряда, перезарядка 1.2 сек.", "Bullet applies a 2s Brand. 600 damage, 3 charges, 1.2s reload."],
  "brawler.verdeletta.superDesc": ["Призывает 3 тени-распорядителя. Убийство врага тенью может породить новую (макс. 6).", "Summons 3 steward shadows. A shadow kill may spawn another (max 6)."],
  "star.verdeletta.1.name": ["Бесконечный банкет", "Endless Banquet"],
  "star.verdeletta.1.effect": ["Длительность Метки увеличена до 3 секунд.", "Brand duration increased to 3 seconds."],
  "star.verdeletta.2.name": ["Острые каблуки", "Sharp Heels"],
  "star.verdeletta.2.effect": ["Урон обычной Тени увеличен до 450.", "Normal Shadow damage increased to 450."],
  "star.verdeletta.3.name": ["Танцпол", "Dance Floor"],
  "star.verdeletta.3.effect": ["При спавне любой тени +20% скорости на 2 секунды.", "+20% speed for 2s when any shadow spawns."],
  "star.verdeletta.4.name": ["VIP-ложа", "VIP Box"],
  "star.verdeletta.4.effect": ["Супер призывает 4 тени-распорядителя вместо 3.", "Super summons 4 steward shadows instead of 3."],
  "star.verdeletta.5.name": ["Адский джаз", "Hell Jazz"],
  "star.verdeletta.5.effect": ["Если обычная тень убивает врага — +300 HP и ещё 10 сек жизни.", "If a normal shadow kills an enemy: +300 HP and 10 more seconds."],
  "star.verdeletta.6.name": ["Владыка преисподней", "Lord of the Underworld"],
  "star.verdeletta.6.effect": ["Тени-распорядители: 5400 HP и 750 урона. Макс. 9 теней.", "Steward shadows: 5400 HP and 750 damage. Max 9 shadows."],
};

for (const loc of ["ru", "en"]) {
  const p = path.join(root, `src/i18n/messages/${loc}.json`);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const [k, v] of Object.entries(i18nKeys)) {
    j[k] = v[loc === "ru" ? 0 : 1];
  }
  fs.writeFileSync(p, JSON.stringify(j, null, 2) + "\n", "utf8");
  console.log("i18n", loc);
}
