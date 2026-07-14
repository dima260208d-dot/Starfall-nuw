/**
 * Publish AI-generated portrait backgrounds from assets/ to public/.
 * Resizes to exact card dimensions (666×680 @2x, ratio 333:340).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const srcDir = path.join(root, "assets");
const outBgDir = path.join(root, "public", "portrait-bg");
const outUiDir = path.join(root, "public", "ui");
const manifestPath = path.join(root, "src", "data", "portraitBackgroundsManifest.gen.json");

const BG_W = 666;
const BG_H = 680;
const TAB_W = 256;
const TAB_H = 171;

const LABELS = [
  "Туманность",
  "Закат",
  "Аврора",
  "Подводный мир",
  "Зачарованный лес",
  "Неон-город",
  "Сакура",
  "Вулкан",
  "Ледяной дворец",
  "Золотой храм",
  "Пустыня",
  "Гроза",
  "Тропики",
  "Лунный лес",
  "Зимняя ночь",
  "Космос",
  "Кристальная пещера",
  "Тёмный замок",
  "Цветущий луг",
  "Храм джунглей",
  "Северное сияние",
  "Звёздный дождь",
  "Дзен-сад",
  "Стимпанк",
  "Осенняя роща",
  "Коралловый риф",
  "Логово дракона",
  "Лавандовые поля",
  "Synthwave",
  "Парящие острова",
  "Светящийся лес",
  "Библиотека",
  "Додзё",
  "Конфетный мир",
  "Витражи",
  "Каньон",
  "Бальный зал",
  "Арктика",
  "Море и шторм",
  "Башня мага",
  "Бамбуковая роща",
  "Египет",
  "Особняк",
  "Стадион",
  "Поляна светлячков",
  "Лёд и лава",
  "Небесное царство",
  "Демонический мир",
  "Храм стражей",
  "Легендарный свет",
];

async function main() {
  fs.mkdirSync(outBgDir, { recursive: true });
  fs.mkdirSync(outUiDir, { recursive: true });

  const manifest = [];

  for (let i = 1; i <= 50; i++) {
    const num = String(i).padStart(3, "0");
    const src = path.join(srcDir, `pbg-${num}.png`);
    if (!fs.existsSync(src)) {
      console.error("Missing:", src);
      process.exit(1);
    }
    const out = path.join(outBgDir, `pbg-${num}.png`);
    await sharp(src)
      .resize(BG_W, BG_H, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(out);
    manifest.push({
      id: `pbg:${num}`,
      label: LABELS[i - 1],
      image: `/portrait-bg/pbg-${num}.png`,
      free: i === 1,
    });
    console.log("published pbg-" + num + ".png");
  }

  const tabSrc = path.join(srcDir, "custom-tab-backgrounds.png");
  if (fs.existsSync(tabSrc)) {
    await sharp(tabSrc)
      .resize(TAB_W, TAB_H, { fit: "cover", position: "centre" })
      .png({ compressionLevel: 9 })
      .toFile(path.join(outUiDir, "custom-tab-backgrounds.png"));
    console.log("published custom-tab-backgrounds.png");
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log("manifest updated,", manifest.length, "entries");
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
