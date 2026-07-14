import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "bootstrap-six-v2-scripts.mjs");
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  `["Night: Airin exhausted, sigil dim but warm.", "Ночь. Знак тусклый, но тёплый.", [["marcus", "Ты доказала не небо. Людей."], ["airin", "Ещё не конец."]]],
        ["Cliffhanger: storm silhouette watches from upper tier.", "Силуэт бури на верхнем ярусе.", [["airin", "Глава VIII. Бой в дымовой завесе. Кто там?"]], "ШШШ…"],`,
  `["Night: Airin exhausted; storm silhouette on upper tier.", "Ночь. Знак тусклый. Силуэт бури на ярусе.", [["marcus", "Ты доказала не небо. Людей."], ["airin", "Глава VIII. Кто там?"]], "ШШШ…"],`,
);

s = s.replace(
  `["Triangle combo.", "Комбо.", [["zephyrin", "Одиночество — общий враг."]], "BOOM!"],
        ["Vow faces chapter 10.",`,
  `["Triangle combo.", "Комбо.", [["zephyrin", "Одиночество — общий враг."]], "BOOM!"],
        ["Hunters flee; storm moon mark burned into sand.", "Знак на песке.", [["smokeSilhouette", "Десятая — лица."], ["moonSilhouette", "И правда."]]],
        ["Vow faces chapter 10.",`,
);

s = s.replace(
  `["Tome closes gently — sleeps.", "Tom спит.", [["tome", "…complete…"]]],
        ["Scoreboard legend.", "Табло.", [["gin", "Записано!"]]],
        ["End card:`,
  `["Tome closes gently — sleeps.", "Tom спит.", [["tome", "…complete…"], ["gin", "Записано!"]]],
        ["End card:`,
);

fs.writeFileSync(p, s, "utf8");
console.log("Patched bootstrap page counts");
