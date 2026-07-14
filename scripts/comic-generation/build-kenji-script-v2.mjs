import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChapters } from "./_brawler-script-v2-lib.mjs";
import { chapterDefs } from "./kenji-v2-pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = {
  professorVeldt: "Профессор Вельдт — латунный монокль, изгнал Кендзи, голос как сухой ток",
  labKoji: "Кодзи — лаборант, дрожащие руки, верит в опыт больше, чем в приказы",
  droneCommander: "Командир дронов — гарнитура совета, без лица за визором",
  patentThief: "Вор патентов — чемодан чертежей, улыбка торговца чужими идеями",
  arenaTech: "Техник Арены — каска, кабели, боится искр и восхищается ими",
  sisterMio: "Сестра Мио — младшая, чинит провода, боится, что брат сгорит от правоты",
  koto: "Глашатай Кото — мегафон над решёткой турнира",
  shadowVoice: "Голос из тени — союзник трио, лицо скрыто до десятой главы",
  taro: "Таро — старый инженер, гаечный ключ, турели держат проход",
  oliver: "Оливер — механические жуки, репликатор, память о брате в машине",
};

const chapters = buildChapters("kenji", chapterDefs);

const script = {
  brawlerId: "kenji",
  brawlerName: "Кендзи",
  lore: "Кендзи — гениальный изобретатель, выгнанный из университета за «слишком опасные эксперименты». Его электрошокеры собраны из деталей старых автоматов, а молнии прыгают между врагами как живые. Он выходит на арену, чтобы доказать, что был прав.",
  skinRef: "public/dev-notes/brawler-skins/kenji_skin1.png",
  trioId: "forge-swarm",
  trioOthers: ["taro", "oliver"],
  rules: {
    format: "VERTICAL PORTRAIT 2:3 tall comic page",
    speech: "No character name prefixes in balloons. Use cream/yellow narration boxes.",
    gameBrawlersFromChapter: 10,
    chapter9SilhouettesOnly: true,
    bannedPhrases: [
      "Здесь начинается мой путь",
      "не паникуй",
      "Держись за мою спину",
      "вернул не манекен",
      "Арена не зовёт",
      "обратного тика",
      "сделаю свой тик",
      "боюсь того кем станет",
      "последний пост",
      "невозможное — моя работа",
      "откатил",
      "три секунды запаса",
    ],
  },
  npcs,
  cover: {
    prompt:
      "finished full-color comic book cover, vertical 2:3 poster; hero Кендзи yellow suit with electric gauntlets, university lab sparks, lightning chain between enemies, palette #F9A825 #212121 #40C4FF, title КЕНДЗИ Cyrillic, NO speech balloons, match kenji_skin1.png",
  },
  chapters,
};

const outPath = path.join(__dirname, "kenji-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
