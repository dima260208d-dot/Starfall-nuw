import fs from "fs";
import path from "path";

const root = path.resolve(".");

const modesDir = path.join(root, "src/modes");
for (const f of fs.readdirSync(modesDir).filter(x => x.endsWith(".ts"))) {
  const p = path.join(modesDir, f);
  let s = fs.readFileSync(p, "utf8");
  if (!s.includes("applyLuminaOnHit")) continue;
  if (s.includes("applyMirabelOnHit")) continue;
  s = s.replace(
    'import { applyLuminaOnHit } from "../utils/luminaStars";',
    'import { applyLuminaOnHit } from "../utils/luminaStars";\nimport { applyMirabelOnHit } from "../utils/mirabelMechanics";',
  );
  s = s.replace(
    /applyLuminaOnHit\(([^)]*)\);/g,
    "applyLuminaOnHit($1);\n          applyMirabelOnHit($1);",
  );
  fs.writeFileSync(p, s, "utf8");
  console.log("patched mode", f);
}

const i18nKeys = {
  "constellation.mirabel": ["Книга Знаний", "Tome of Knowledge"],
  "brawler.mirabel.name": ["Мирабель", "Mirabel"],
  "brawler.mirabel.role": ["Поддержка", "Support"],
  "brawler.mirabel.description": ["Редкая девочка с волшебной книгой; искры знаний ускоряют союзников", "Rare girl with a magic book; knowledge sparks speed up allies"],
  "brawler.mirabel.lore": ["Мирабель выросла в библиотеке академии, где каждая книга шептала ей тайны. Она не стреляет огнём — она бросает искры знания, ускоряя союзников быстрее, чем враги успевают понять, что произошло. Её супер «Ускоренное обучение» превращает целую команду в мастеров, чьи следующие удары приходят дважды.", "Mirabel grew up in the academy library where every book whispered secrets. She does not shoot fire — she throws sparks of knowledge, speeding allies before enemies understand what happened. Her Accelerated Learning super turns the whole team into masters whose next strikes come twice."],
  "brawler.mirabel.attackName": ["Искра знаний", "Spark of Knowledge"],
  "brawler.mirabel.superName": ["Ускоренное обучение", "Accelerated Learning"],
  "brawler.mirabel.attackDesc": ["Жёлтая искра из книги на 4.5 клетки: 950 урона. Союзники в 100px от врага получают −0.3 сек. CD атак. 3 заряда, 1.2 сек. Супер: 6 попаданий.", "Yellow spark from her book, 4.5 tiles: 950 damage. Allies within 100px of the hit enemy get −0.3s attack CD. 3 charges, 1.2s. Super: 6 hits."],
  "brawler.mirabel.superDesc": ["Светящаяся книга над союзниками в 500px на 5 сек.: следующая атака каждого двойная, сгорает после выстрела.", "Glowing book over allies within 500px for 5s: each one's next attack is doubled, consumed after firing."],
  "star.mirabel.1.name": ["Сильная искра", "Strong Spark"],
  "star.mirabel.1.effect": ["Урон искры плюс 350.", "Spark damage +350."],
  "star.mirabel.2.name": ["Ускорение союзников", "Ally Acceleration"],
  "star.mirabel.2.effect": ["Сокращение перезарядки 0.5 секунды.", "Cooldown reduction increased to 0.5 seconds."],
  "star.mirabel.3.name": ["Увеличенный радиус", "Expanded Radius"],
  "star.mirabel.3.effect": ["Радиус супера на всю карту.", "Super radius covers the whole map."],
  "star.mirabel.4.name": ["Двойное обучение", "Double Lesson"],
  "star.mirabel.4.effect": ["Бафф на две атаки (два двойных выстрела).", "Buff lasts for two attacks (two double volleys)."],
  "star.mirabel.5.name": ["Вдохновение", "Inspiration"],
  "star.mirabel.5.effect": ["+20% скорости на время баффа.", "+20% speed while buff is active."],
  "star.mirabel.6.name": ["Книга мудрости", "Tome of Wisdom"],
  "star.mirabel.6.effect": ["+15% урона на время баффа.", "+15% damage while buff is active."],
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

console.log("Mirabel integration done");
