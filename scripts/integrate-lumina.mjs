import fs from "fs";
import path from "path";

const root = path.resolve(".");

const modesDir = path.join(root, "src/modes");
for (const f of fs.readdirSync(modesDir).filter(x => x.endsWith(".ts"))) {
  const p = path.join(modesDir, f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("applyVerdelettaOnHit")) continue;
  if (s.includes("applyLuminaOnHit")) continue;
  s = s.replace(
    'import { applyVerdelettaOnHit } from "../utils/verdelettaStars";',
    'import { applyVerdelettaOnHit } from "../utils/verdelettaStars";\nimport { applyLuminaOnHit } from "../utils/luminaStars";',
  );
  s = s.replace(
    /applyVerdelettaOnHit\(([^)]*)\);/g,
    "applyVerdelettaOnHit($1);\n          applyLuminaOnHit(attacker as any, b as any, proj, all);",
  );
  fs.writeFileSync(p, s, "utf8");
  console.log("patched mode", f);
}

const i18nKeys = {
  "constellation.lumina": ["Небесная Нить", "Celestial Thread"],
  "brawler.lumina.name": ["Люмина", "Lumina"],
  "brawler.lumina.role": ["Поддержка", "Support"],
  "brawler.lumina.description": ["Мифическая девушка со светящимися крыльями; связывает врагов золотыми нитями", "Mythic girl with glowing wings; binds enemies with golden threads"],
  "brawler.lumina.lore": ["Люмина — дочь падшего ангела и смертной женщины. Она не помнит небес, но её крылья светятся тоской по дому. Говорят, что её световые нити связывают не только врагов, но и потерянные души, помогая им найти покой. В бою она не убивает — она примиряет, запирая противников в золотой клетке правосудия.", "Lumina is the daughter of a fallen angel and a mortal woman. She does not remember heaven, but her wings glow with homesickness. They say her threads bind not only enemies but lost souls, helping them find peace. In battle she does not kill — she reconciles, locking foes in a golden cage of justice."],
  "brawler.lumina.attackName": ["Световая нить", "Light Thread"],
  "brawler.lumina.superName": ["Божественное заточение", "Divine Imprisonment"],
  "brawler.lumina.attackDesc": ["Золотой луч из груди: 200 урона первому врагу на 5 клеток, затем цепь ко второму в радиусе 4 клеток — 100 урона/сек, макс. 3 клетки между ними, 3 сек. 2 заряда, CD 1.5 сек. Супер: 5 попаданий или 3 связки.", "Golden chest beam: 200 damage to first enemy at 5 tiles, then chains a second within 4 tiles — 100 DPS, max 3 tiles apart, 3 sec. 2 charges, 1.5s CD. Super: 5 hits or 3 links."],
  "brawler.lumina.superDesc": ["Золотой купол с рунами (120px, 4 сек): все внутри замедлены на 50% и не могут выйти. Без урона.", "Golden rune dome (120px, 4 sec): everyone inside is slowed 50% and cannot leave. No damage."],
  "star.lumina.1.name": ["Вечная нить", "Eternal Thread"],
  "star.lumina.1.effect": ["Длительность связи увеличена до 4 секунд.", "Link duration increased to 4 seconds."],
  "star.lumina.2.name": ["Разрыв", "Rupture"],
  "star.lumina.2.effect": ["Если враги пытаются разорвать связь, они получают дополнительно 300 урона.", "If enemies try to break the link, they take an extra 300 damage."],
  "star.lumina.3.name": ["Благодать", "Grace"],
  "star.lumina.3.effect": ["Союзники внутри купола не замедляются и получают щит 200 HP на время супера.", "Allies inside the dome are not slowed and gain a 200 HP shield for its duration."],
  "star.lumina.4.name": ["Свет во тьме", "Light in Darkness"],
  "star.lumina.4.effect": ["Урон связи увеличен до 150 урона/сек.", "Link damage increased to 150 DPS."],
  "star.lumina.5.name": ["Владыка купола", "Dome Lord"],
  "star.lumina.5.effect": ["Супер длится 5.5 секунды, радиус купола увеличен до 150px.", "Super lasts 5.5 seconds; dome radius increased to 150px."],
  "star.lumina.6.name": ["Божественное правосудие", "Divine Judgment"],
  "star.lumina.6.effect": ["Если связанные враги умирают, купол взрывается, нанося 500 урона всем врагам внутри.", "If linked enemies die, the dome explodes for 500 damage to all enemies inside."],
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

console.log("Lumina integration done");
