import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChapters } from "./_brawler-script-v2-lib.mjs";
import { chapterDefs } from "./yuki-v2-pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = {
  abbessYoko: "Настоятельница Ёко — седые косы, синее кимоно храма, голос колокола без металла",
  brotherHaru: "Брат Хару — старший посох льда, тёплый смех, исчез на турнире",
  frostCaptain: "Капитан инея — маска из замёрзшего стекла, голос как треск льда",
  kidnapper: "Похититель — двойная маска инея, молчит, оставляет след снежинок",
  shrineBoy: "Мальчик храма — босые ноги на снегу, верит в колокол брата",
  koto: "Глашатай Кото — барабан Арены, кричит сквозь метель",
  scholarGhost: "Призрак учёного — шёпот из библиотечных полок, без лица",
  shadowVoice: "Голос из тени — союзник трио, лицо скрыто до десятой главы",
  mirabel: "Мирабель — красная книга, искры знания, ускоряет союзников",
  elian: "Элиан — звёздное пальто, гравитационная воронка, ищет потерянные созвездия",
};

const chapters = buildChapters("yuki", chapterDefs);

const script = {
  brawlerId: "yuki",
  brawlerName: "Юки",
  lore: "Юки родилась в горном храме, где училась искусству целительной магии льда. Она пришла в Арену, чтобы найти брата, пропавшего в одном из турниров. До тех пор она лечит союзников и замораживает любого, кто встанет на пути.",
  skinRef: "public/dev-notes/brawler-skins/yuki_skin1.png",
  trioId: "starbound-scholars",
  trioOthers: ["mirabel", "elian"],
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
      "finished full-color comic book cover, vertical 2:3 poster; hero Юки girl in blue kimono with ice staff and snowflake, mountain temple blizzard, brother's ice bell glowing toward Arena dome, palette #0288D1 #E1F5FE #B2EBF2, title ЮКИ Cyrillic, NO speech balloons, match yuki_skin1.png",
  },
  chapters,
};

const outPath = path.join(__dirname, "yuki-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
