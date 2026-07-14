/**
 * Rebuilds profileIconsManifest.gen.json from files in public/profile-icons/gen/.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const genDir = path.join(root, "public", "profile-icons", "gen");
const outPath = path.join(root, "src", "data", "profileIconsManifest.gen.json");
const oldPath = outPath;

const oldLabels = new Map();
if (fs.existsSync(oldPath)) {
  try {
    for (const e of JSON.parse(fs.readFileSync(oldPath, "utf8"))) {
      oldLabels.set(e.id, e.label);
    }
  } catch { /* ignore */ }
}

const LABELS = [
  "Звезда", "Череп", "Коготь", "Щит", "Молния", "Кристалл", "Дракон", "Призрак",
  "Ракета", "Корона", "Луна", "Солнце", "Волна", "Пламя", "Лёд", "Лист",
  "Глаз", "Ключ", "Колокол", "Флаг", "Якорь", "Перо", "Кольцо", "Кубик",
  "Робот", "НЛО", "Книга", "Маска", "Крыло", "Лапа", "Комета", "Планета",
];

const REMOVED = new Set(["gen_040.png", "gen_059.png"]);

const files = fs.readdirSync(genDir)
  .filter(f => /^gen_\d{3}\.png$/i.test(f) && !REMOVED.has(f))
  .sort();

const manifest = files.map((file, i) => {
  const num = file.match(/(\d{3})/)[1];
  const id = `gen:${num}`;
  const label = oldLabels.get(id) || LABELS[i % LABELS.length] + (i >= LABELS.length ? ` ${Math.floor(i / LABELS.length) + 1}` : "");
  return {
    id,
    label,
    category: "misc",
    image: `/profile-icons/gen/gen_${num}.png`,
  };
});

fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), "utf8");
console.log(`Manifest: ${manifest.length} icons → ${outPath}`);
