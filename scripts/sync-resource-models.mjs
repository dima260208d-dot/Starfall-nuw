/**
 * Копирует GLB из папки «Новые модельки» в public/models под именами,
 * которые ожидает игра (старые файлы с теми же именами перезаписываются).
 * Запуск: node scripts/sync-resource-models.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DST = path.join(ROOT, "public", "models");

const SRC_DEFAULT = path.join("C:", "Users", "Дмитрий", "Downloads", "Новые модельки");
const SRC = process.env.NEW_MODELS_DIR
  ? path.resolve(process.env.NEW_MODELS_DIR)
  : SRC_DEFAULT;

/** Имя файла в папке пользователя → имя в public/models */
const MAP = {
  "монета.glb": "coin.glb",
  "кристал.glb": "gem.glb",
  "поинт прокачки.glb": "powerpoint.glb",
  "бокс усиления.glb": "power_box.glb",
  "банка усиления.glb": "power_jar.glb",
  "обычный сундук.glb": "chest_common.glb",
  "редкий сундук.glb": "chest_rare.glb",
  "эпический сундук.glb": "chest_epic.glb",
  "мега сундук.glb": "chest_mega.glb",
  "легендарный сундук.glb": "chest_legendary.glb",
  "мифический сундук.glb": "chest_mythic.glb",
  "ультралегендарный сундук.glb": "chest_ultralegendary.glb",
  "кубок.glb": "trophy.glb",
};

function main() {
  if (!fs.existsSync(SRC)) {
    console.error("Папка с новыми моделями не найдена:", SRC);
    console.error("Укажите путь: NEW_MODELS_DIR=... node scripts/sync-resource-models.mjs");
    process.exit(1);
  }
  fs.mkdirSync(DST, { recursive: true });
  for (const [from, to] of Object.entries(MAP)) {
    const srcPath = path.join(SRC, from);
    if (!fs.existsSync(srcPath)) {
      console.error("Нет файла:", srcPath);
      process.exit(1);
    }
    const dstPath = path.join(DST, to);
    fs.copyFileSync(srcPath, dstPath);
    console.log("OK", to, "<-", from);
  }
  console.log("Готово:", DST);
}

main();
