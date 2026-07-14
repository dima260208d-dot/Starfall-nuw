import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "../..");
const outDir = path.resolve(import.meta.dirname, "scripts");
const manifestPath = path.resolve(repoRoot, "scripts", "brawler-comics-manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

const TRIOS = {
  hana: ["hana", "ronin", "goro"],
  ronin: ["hana", "ronin", "goro"],
  goro: ["hana", "ronin", "goro"],
  yuki: ["yuki", "mirabel", "elian"],
  mirabel: ["yuki", "mirabel", "elian"],
  elian: ["yuki", "mirabel", "elian"],
  kenji: ["kenji", "taro", "oliver"],
  taro: ["kenji", "taro", "oliver"],
  oliver: ["kenji", "taro", "oliver"],
  callista: ["callista", "rin", "octavia"],
  rin: ["callista", "rin", "octavia"],
  octavia: ["callista", "rin", "octavia"],
  airin: ["airin", "zephyrin", "vittoria"],
  zephyrin: ["airin", "zephyrin", "vittoria"],
  vittoria: ["airin", "zephyrin", "vittoria"],
  miya: ["miya", "silven", "lumina"],
  silven: ["miya", "silven", "lumina"],
  lumina: ["miya", "silven", "lumina"],
  zafkiel: ["zafkiel", "verdeletta", "sora"],
  verdeletta: ["zafkiel", "verdeletta", "sora"],
  sora: ["zafkiel", "verdeletta", "sora"],
};

const CHAPTER_TITLES = [
  "Дом до грома",
  "Рана, которая не спит",
  "Первый ответный удар",
  "След Арены",
  "Охота начинается",
  "Цена силы",
  "Ворота открыты",
  "Бой под прожекторами",
  "Союз из трёх искр",
  "Легенда на табло",
];

function pagesFor(brawlerName, seed, trioOthers, chapterIdx) {
  const ch = chapterIdx + 1;
  const other1 = trioOthers[0];
  const templates = [
    [
      { narration: [`${seed.home}. Утро, которое ещё кажется обычным.`], dialogue: [{ t: "Сегодня ты выходишь на линию, " + brawlerName + "." }, { t: "Здесь начинается мой путь." }] },
      { narration: ["Первые трещины будущей битвы ещё не слышны."], dialogue: [{ t: "Видишь знак на горизонте?" }, { t: "Он дышит. Как рана, которой ещё нет." }] },
      { narration: ["Тишину рвёт слишком тихий звук."], dialogue: [{ t: "Старший! Что-то треснуло!" }, { t: "Не паникуй. Даже время иногда кашляет." }], sfx: "ТРЕСК!" },
      { narration: ["Учебный зал становится полем испытания."], dialogue: [{ t: "Держись рядом!" }, { t: "Я не отпущу никого в прошлое один." }], sfx: "WHOOSH!" },
      { narration: ["Первый настоящий ответный удар."], dialogue: [{ t: "Ты вернул не манекен — ты вернул надежду." }, { t: "Значит, ещё можно исправлять." }] },
      { narration: ["Ночь. Память стучит в грудь."], dialogue: [{ t: "Они оставили мне не силу — вопрос." }, { t: "…а вопросы не стареют." }] },
      { narration: ["Вдали проступает купол Арены."], dialogue: [{ t: "Ты тоже это слышишь?" }, { t: "Арена не зовёт. Она ждёт." }] },
      { narration: ["Выбор, который нельзя откатить словами."], dialogue: [{ t: "Если выйдешь — обратного тика не будет." }, { t: "Тогда я сделаю свой тик." }] },
      { narration: ["Вспышка силы рвёт привычный ритм."], dialogue: [{ t: "Он откатил взрыв!" }, { t: "Вижу. И боюсь того, кем станет." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Если путь открыт… я не отступлю." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Последний день старого мира."], dialogue: [{ t: "Я вернулся слишком поздно." }, { t: "Ты вернулся — значит, ещё не конец." }] },
      { narration: ["Пепел на перчатках. Память на ладонях."], dialogue: [{ t: "Клятва была держать линию." }, { t: "Линию разорвали." }] },
      { narration: ["Разломы открываются сами."], dialogue: [{ t: "Сдавай знак дома." }, { t: "Забирай, если догонишь." }], sfx: "РРРАЗЛОМ!" },
      { narration: ["Охота началась."], dialogue: [{ t: "Беги. Устанешь — заберём будущее." }], sfx: "WHOOSH!" },
      { narration: ["Первый ответ боли — действием."], dialogue: [{ t: "Ты говоришь про будущее. Я вижу твой шаг." }], sfx: "ВЖУХ!" },
      { narration: ["Знамя под ногами. Клятва внутри."], dialogue: [{ t: "Мы держали пост, пока верили." }, { t: "Я верю. Поэтому стою." }] },
      { narration: ["Арена светится сквозь бурю."], dialogue: [{ t: "Там ответ. Или ловушка." }] },
      { narration: ["Последний запас силы."], dialogue: [{ t: "Каждый выстрел — вычтенная секунда." }] },
      { narration: ["Обвал. Купол времени держит одного."], dialogue: [{ t: "Невозможно…" }, { t: "Невозможное — моя работа." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Я последний пост. Я — стена." }], sfx: "ТИК-ТАК." },
    ],
    [
      { narration: ["Граница, где дом заканчивается."], dialogue: [{ t: "Мы нашли тебя!" }, { t: "Ты пришла. Этого достаточно." }] },
      { narration: ["Впервые злость яснее страха."], dialogue: [{ t: "Нас назвали героями. Нас сделали мишенями." }] },
      { narration: ["Враг входит в кадр."], dialogue: [{ t: "Сдай оружие — и она уйдёт." }, { t: "Она уже не слабая. Она — боец." }], sfx: "ГРРР!" },
      { narration: ["Диагональ боя."], dialogue: [{ t: "Слева! Ещё двое!" }, { t: "Вижу. Держи спину!" }], sfx: "WHOOSH!" },
      { narration: ["Первый удар характера."], dialogue: [{ t: "Виси. Подумай, зачем ты здесь." }], sfx: "СТОП!" },
      { narration: ["Тихая деталь прошлого."], dialogue: [{ t: "Ты всё ещё не сдаёшься?" }, { t: "Я забираю у них будущее. Это хуже." }] },
      { narration: ["Зов Арены в небе."], dialogue: [{ t: "Туда ушёл ответ." }] },
      { narration: ["Сила собирается."], dialogue: [{ t: "Ещё один бой — и я покажу им правду." }] },
      { narration: ["Проблеск супера."], dialogue: [{ t: "Мы уже были у цели!" }, { t: "Были. Теперь опоздали." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Он жив?" }, { t: "Пока да. Время ещё не решило." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Аномалия пожирает будущее."], dialogue: [{ t: "Здесь пахнет старыми боями." }] },
      { narration: ["Приглашение Арены."], dialogue: [{ t: "Кто держит путь — пусть докажет на песке." }, { t: "Докажу. Не ради славы." }] },
      { narration: ["В воронке — застрявшие секунды."], dialogue: [{ t: "Это не призраки." }, { t: "Тогда я вытащу их." }], sfx: "ВЖУУУ!" },
      { narration: ["Охота внутри разлома."], dialogue: [{ t: "Арена тебя не спасёт!" }, { t: "Мне нужен ответ." }], sfx: "WHOOSH!" },
      { narration: ["Спасение чужого мгновения."], dialogue: [{ t: "Ты вытащил голос из петли!" }, { t: "Голос — тоже время." }], sfx: "ВЖУХ!" },
      { narration: ["Клятва на сердце."], dialogue: [{ t: "Я слушал. Теперь отвечаю." }] },
      { narration: ["Купол близко."], dialogue: [{ t: "Ворота откроются на рассвете третьего тика." }] },
      { narration: ["Руны под ногами."], dialogue: [{ t: "Путь назад закрыт." }] },
      { narration: ["Портал рвётся."], dialogue: [{ t: "Я иду с тобой!" }, { t: "Не отставай от секунды." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Если прошлое голодно… я принесу выбор." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Перекрёсток сломанных путей."], dialogue: [{ t: "Тени танцуют без хозяев." }, { t: "Кто-то зовёт без приглашения." }] },
      { narration: ["Охотники разлома."], dialogue: [{ t: "Отдай знак — и мы уйдём." }, { t: "Не смей близко!" }], sfx: "КРЯСЬ!" },
      { narration: ["Три ловушки. Одна секунда."], dialogue: [{ t: "Влево! Я заберу их прошлое!" }], sfx: "WHOOSH!" },
      { narration: ["Бой на обломках."], dialogue: [{ t: "Они множатся!" }, { t: "Урежу им завтра." }], sfx: "БАЦ!" },
      { narration: ["Усиленный заряд."], dialogue: [{ t: "Моя броня ржавеет?!" }, { t: "Время ест всё." }], sfx: "ШШШШ!" },
      { narration: ["Тишина между ударами."], dialogue: [{ t: "Если всё предрешено… зачем выбирать?" }, { t: "Потому что выбор — твоя сила." }] },
      { narration: ["Тени на краю кадра."], dialogue: [{ t: "Приглашения без имени." }, { t: "Не принимай. Ещё рано." }] },
      { narration: ["Последний запас."], dialogue: [{ t: "Каждое зерно — обещание." }] },
      { narration: ["Волна отката."], dialogue: [{ t: "Мы победили в будущем!" }, { t: "Живи там. Здесь — мой тик." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Кто-то ждёт у ворот. Не сегодня." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Зал зеркал возможных будущих."], dialogue: [{ t: "Сколько меня здесь?" }, { t: "Столько, сколько сожалений." }] },
      { narration: ["Тиран. Трус. Мёртвый герой."], dialogue: [{ t: "Кто выбирает — я или отражение?" }] },
      { narration: ["Трещина на вере."], dialogue: [{ t: "Не смотри! Ловушка!" }, { t: "Я уже внутри." }], sfx: "ТРЕСК!" },
      { narration: ["Осколки оживают."], dialogue: [{ t: "Вы — мой страх." }], sfx: "ДЗЫНЬ!" },
      { narration: ["Скорость опережает сомнение."], dialogue: [{ t: "Стреляю в приговор." }], sfx: "ВЖУХ!" },
      { narration: ["Клятва отца/наставника."], dialogue: [{ t: "Прости. Не могу только слушать." }, { t: "Он бы действовал раньше." }] },
      { narration: ["Сердце Арены бьётся под полом."], dialogue: [{ t: "Докажи, что выбор существует." }], sfx: "ТУДУМ." },
      { narration: ["Цена силы."], dialogue: [{ t: "Твои глаза тускнеют!" }, { t: "На миг. Потом рассвет." }] },
      { narration: ["Зеркала падают."], dialogue: [{ t: "Я выбираю. Значит жив." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Следи. Но не решай за меня." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Ворота турнира."], dialogue: [{ t: "Имя и печать. Или разлом." }, { t: "Печать — здесь." }] },
      { narration: ["Знак допуска вспыхивает."], dialogue: [{ t: "Ты правда идёшь…" }, { t: "Кто-то должен доказать, что мы не миф." }] },
      { narration: ["Страж-механизм."], dialogue: [{ t: "Пройди лезвия." }, { t: "Пойду в своём темпе." }], sfx: "ЖЖЖ!" },
      { narration: ["Синий заряд проходит лезвия."], dialogue: [{ t: "Твоя секунда — моя дорога." }], sfx: "ВЖУХ!" },
      { narration: ["Пауза перед бурей."], dialogue: [{ t: "Если что — откати меня." }, { t: "Ты войдёшь сама." }] },
      { narration: ["Толпа за дверью."], dialogue: [{ t: "Арена ждёт историю." }], sfx: "РРРА!" },
      { narration: ["Замок из сжатой минуты."], dialogue: [{ t: "Откройся. Или вернусь в чертёж." }] },
      { narration: ["Вспышка входа."], dialogue: [{ t: "Мы внутри!" }, { t: "Не отступать." }], sfx: "KRAK-BOOM!" },
      { narration: ["Песок помнит каждого."], dialogue: [{ t: "Толпа — твой судья!" }] },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Напишите что угодно. Я перепишу время." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Первый официальный матч."], dialogue: [{ t: "На песке — герой против трёх!" }, { t: "Трое? Три секунды запаса." }] },
      { narration: ["Тишина перед гонгом."], dialogue: [{ t: "Ты не откатишь толпу." }, { t: "Нужен один честный тик." }] },
      { narration: ["Враги на песке."], dialogue: [{ t: "Их супер заряжен!" }, { t: "Слышу. Считаю." }], sfx: "ГОНГ!" },
      { narration: ["Песок взлетает."], dialogue: [{ t: "Влево — откат!" }, { t: "Говорит с боем, как с музыкой!" }], sfx: "БАЦ!" },
      { narration: ["Три заряда — три ответа."], dialogue: [{ t: "Ты только вспомнил удар." }], sfx: "WHOOSH!" },
      { narration: ["Перерыв. Песок на исходе."], dialogue: [{ t: "Смени тактику!" }, { t: "Тактика — открыть врата." }] },
      { narration: ["Толпа требует финала."], dialogue: [{ t: "Толпа требует финала!" }], sfx: "РРРА!" },
      { narration: ["Супер зреет."], dialogue: [{ t: "Входите. Выход — в прошлое." }], sfx: "ВЖУУУ!" },
      { narration: ["Ключевая сцена силы."], dialogue: [{ t: "Мы уже победили!" }, { t: "Стояли. Сидите снова." }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Победа!" }, { t: "Пока тикает — живой." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Буря рун за кулисами. Три искры без имён."], dialogue: [{ t: "Кто-то ломает протокол." }, { t: "Две тени. Книга в воздухе." }] },
      { narration: ["Трио ещё не сложилось — только силуэты."], dialogue: [{ t: "Вы слышите зов?" }, { t: "Слышим праздник без хозяина." }] },
      { narration: ["Общий враг."], dialogue: [{ t: "Назад! Закрою разлом!" }, { t: "Закрывай. Удержим тени." }], sfx: "БАЦ!" },
      { narration: ["Круг защиты."], dialogue: [{ t: "Три времени. Один враг." }, { t: "Они помогают?" }], sfx: "WHOOSH!" },
      { narration: ["Руны-треугольник."], dialogue: [{ t: "Когда покажете лица — запомню." }, { t: "На десятой главе." }] },
      { narration: ["Клятва без имён."], dialogue: [{ t: "Если наши пути сойдутся…" }, { t: "…встретимся у ворот." }] },
      { narration: ["Знак в небе."], dialogue: [{ t: "Что за знак?" }, { t: "Пусть молчит. Рано." }] },
      { narration: ["Три искры бьют разом."], dialogue: [{ t: "Союзники — чтобы выбрать." }], sfx: "KRAK-BOOM!" },
      { narration: ["Знак трёх на песке."], dialogue: [{ t: "Кто они?" }, { t: "Те, кто придёт в финале." }] },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "До финала. Там — встречи." }], sfx: "ТИК." },
    ],
    [
      { narration: ["Финал. Табло — алтарь имён."], dialogue: [{ t: "Арена зовёт союзников!" }, { t: "Пора показать лицо легенды." }] },
      { narration: [`Союзник трио появляется — match ${other1}_skin1.png design.`], dialogue: [{ t: "Наконец полный состав!" }, { t: "Ты из девятой главы." }] },
      { narration: ["Второй союзник трио появляется."], dialogue: [{ t: "Наши пути сходятся." }, { t: "Трио собрано. Вперёд." }] },
      { narration: ["Трио на песке против врага."], dialogue: [{ t: "Все на танец!" }, { t: "Мы — выбор." }, { t: "Выберем вместе." }], sfx: "ГОНГ!" },
      { narration: ["Комбо суперов троих."], dialogue: [{ t: "Мой удар!" }, { t: "Мой зал!" }, { t: "Наша глава!" }], sfx: "KRAK-BOOM!" },
      { narration: ["Пауза после бури."], dialogue: [{ t: "Арена — сцена." }, { t: "Страница пишется." }, { t: "Праздник… почти по правилам." }] },
      { narration: ["Имя на табло."], dialogue: [{ t: "Легенда записана!" }, { t: "Помню дорогу." }] },
      { narration: ["Сияние силы и памяти."], dialogue: [{ t: "Ты сделал то, чего боялись." }, { t: "То, что требовал выбор." }] },
      { narration: ["Финальный всплеск."], dialogue: [{ t: "Каждая секунда — мой ход!" }, { t: "Каждый гость — мой!" }, { t: "Каждая звезда — наша!" }], sfx: "KRAK-BOOM!" },
      { narration: [`Глава ${ch}. ${CHAPTER_TITLES[chapterIdx]}.`], dialogue: [{ t: "Следующий тик — начало." }], sfx: "ТИК." },
    ],
  ];
  return templates[chapterIdx].map((t, i) => ({
    page: i + 1,
    chapter: ch,
    chapterTitle: CHAPTER_TITLES[chapterIdx],
    narration: t.narration,
    dialogue: t.dialogue.map(d => d.t),
    sfx: t.sfx ?? null,
    scene: `${seed.motif}; ${CHAPTER_TITLES[chapterIdx]} beat ${i + 1}`,
  }));
}

const skip = new Set(["zafkiel"]);
const all = {};

for (const cover of manifest.coverImages) {
  if (skip.has(cover.brawlerId)) continue;
  const pages = manifest.pages.filter(p => p.brawlerId === cover.brawlerId);
  const seedLine = pages[0]?.imagePrompt?.split(";").find(s => s.includes("visual motifs")) ?? "";
  const seed = {
    motif: seedLine.replace("visual motifs:", "").trim() || cover.brawlerName,
    home: pages[0]?.continuityNotes?.split("Chapter 1")[0] ?? cover.brawlerName,
  };
  const trio = TRIOS[cover.brawlerId] ?? [cover.brawlerId, cover.brawlerId, cover.brawlerId];
  const trioOthers = trio.filter(id => id !== cover.brawlerId);
  const chapters = {};
  for (let c = 0; c < 10; c++) {
    chapters[String(c + 1)] = { title: CHAPTER_TITLES[c], pages: pagesFor(cover.brawlerName, seed, trioOthers, c) };
  }
  all[cover.brawlerId] = {
    brawlerId: cover.brawlerId,
    brawlerName: cover.brawlerName,
    skinRef: `public/dev-notes/brawler-skins/${cover.brawlerId}_skin1.png`,
    trioOthers,
    cover: { assetPath: cover.assetPath, prompt: cover.imagePrompt },
    chapters,
  };
}

fs.mkdirSync(outDir, { recursive: true });
for (const [id, data] of Object.entries(all)) {
  fs.writeFileSync(path.join(outDir, `${id}-page-script.json`), JSON.stringify(data, null, 2), "utf8");
}
fs.writeFileSync(path.join(outDir, "all-brawlers-index.json"), JSON.stringify(Object.keys(all), null, 2), "utf8");
console.log("Wrote scripts for", Object.keys(all).length, "brawlers");
