/**
 * Builds profileIconsManifest.gen.json with 100 entries (gen:001 … gen:100).
 * Run before batch image generation.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(__dirname, "..", "src", "data", "profileIconsManifest.gen.json");

const LABELS = [
  "Звезда", "Череп", "Коготь", "Щит", "Молния", "Кристалл", "Дракон", "Призрак",
  "Ракета", "Корона", "Луна", "Солнце", "Волна", "Пламя", "Лёд", "Лист",
  "Глаз", "Ключ", "Колокол", "Флаг", "Якорь", "Перо", "Кольцо", "Кубик",
  "Робот", "НЛО", "Книга", "Маска", "Крыло", "Лапа", "Комета", "Планета",
  "Метеор", "Трофей", "Медаль", "Сердце", "Лук", "Меч", "Лук", "Сфера",
  "Портал", "Руна", "Тотем", "Кристалл-2", "Нова", "Пульсар", "Туман", "Шторм",
  "Сакура", "Оникс", "Янтарь", "Нефрит", "Рубин", "Сапфир", "Аметист", "Опал",
  "Феникс", "Ворон", "Медведь", "Волк", "Лиса", "Кот", "Сова", "Змея",
  "Краб", "Осьминог", "Рыба", "Акула", "Кит", "Черепаха", "Жук", "Паук",
  "Гриб", "Цветок", "Дерево", "Гора", "Вулкан", "Песок", "Снег", "Радуга",
  "Облако", "Гром", "Вихрь", "Ореол", "Сигил", "Печать", "Амулет", "Талисман",
  "Капсула", "Чип", "Антенна", "Спутник", "Лазер", "Плазма", "Нано", "Кибер",
  "Глитч", "Пиксель", "Геймпад", "Куб", "Пирамида", "Призма", "Орб", "Спираль",
];

const manifest = Array.from({ length: 100 }, (_, i) => {
  const n = String(i + 1).padStart(3, "0");
  const labelBase = LABELS[i % LABELS.length];
  const label = i >= LABELS.length ? `${labelBase} ${Math.floor(i / LABELS.length) + 1}` : labelBase;
  return {
    id: `gen:${n}`,
    label,
    category: "misc",
    image: `/profile-icons/gen/gen_${n}.png`,
  };
});

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Wrote ${manifest.length} entries → ${out}`);
