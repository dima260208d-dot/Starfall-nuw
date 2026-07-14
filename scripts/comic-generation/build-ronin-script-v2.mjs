import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildChapters } from "./_brawler-script-v2-lib.mjs";
import { chapterDefs } from "./ronin-v2-pages.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = {
  genkei: "Гэнкэй — наставник ката, седой хвост, голос точильного камня, не хвалит дважды",
  mizunaga: "Лорд Мизунага — предательский сюзерен, золотая накидка, улыбка мёда и яда",
  ashida: "Корпорал Асида — бывший вассал Ронина, шрам через бровь, дрожащая верность",
  rie: "Сестра Риэ — полевая медсестра до Ханы, розовый фартук, сухой юмор",
  koto: "Глашатай Кото — барабанщик Арены, мегафон, кричит как гром над песком",
  vassalCaptain: "Капитан вассалов — нагината, герб Мизунаги на плече, голос без сомнений",
  shadowVoice: "Голос из тени — союзник трио, лицо скрыто до десятой главы",
  hana: "Хана — розовый медик, лечебный пистолет, милосердие сильнее страха",
  goro: "Горо — северный берсерк, двойные топоры, ярость без прошлого",
};

const chapters = buildChapters("ronin", chapterDefs);

const script = {
  brawlerId: "ronin",
  brawlerName: "Ронин",
  lore: "Когда-то Ронин был генералом императорской армии. Преданный собственными лордами, он надел старые доспехи и стал вольным самураем. Его катана разрубает камень, а щит выдерживает залпы из десятка винтовок. Честь требует стоять, даже когда доверять некому.",
  skinRef: "public/dev-notes/brawler-skins/ronin_skin1.png",
  trioId: "oathbound-frontline",
  trioOthers: ["hana", "goro"],
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
      "finished full-color comic book cover, vertical 2:3 poster; hero Ронин huge red-armored samurai with stone-cutting katana and battered shield, imperial betrayal smoke, gold clan seal cracked, palette #B71C1C #FFD700 #FF6F00, title РОНИН Cyrillic, dramatic pose, NO speech balloons, match ronin_skin1.png",
  },
  chapters,
};

const outPath = path.join(__dirname, "ronin-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
