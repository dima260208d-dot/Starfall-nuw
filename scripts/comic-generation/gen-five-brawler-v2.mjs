import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ru = JSON.parse(fs.readFileSync(path.join(__dirname, "../../src/i18n/messages/ru.json"), "utf8"));

const TARGET_IDS = ["verdeletta", "lumina", "oliver", "callista", "elian"];

const BANNED = [
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
];

const RULES = {
  format: "VERTICAL PORTRAIT 2:3 tall comic page",
  speech: "No character name prefixes in balloons. Use cream/yellow narration boxes.",
  gameBrawlersFromChapter: 10,
  chapter9SilhouettesOnly: true,
  bannedPhrases: BANNED,
};

function d(speaker, text) {
  return { speaker, text };
}

function pg(n, scene, narration, dialogue, sfx = null) {
  return { page: n, scene, narration: [narration], dialogue, sfx };
}

function ch(title, pages) {
  return { title, pages };
}

function ch9(hero, a, b, motif) {
  const sv = "shadowVoice";
  return ch("Спор трёх путей", [
    pg(1, `Arena backstage mist — SHADOWED trio, ${motif}.`, "Закулисье. Туман. Три силуэта у трещины.", [d(hero, "Кто там — без приглашения?"), d(sv, "Три пути. Один зал. Выбери.")]),
    pg(2, `${a.sil} and ${b.sil} SILHOUETTE — NOT full faces.`, "Два силуэта по бокам. Лица скрыты.", [d(hero, "Ещё охотники?"), d(sv, "Охотники на ложь. Не на тебя.")]),
    pg(3, "Hunters attack silhouettes; hero breaks nets.", "Охотники бросаются на силуэты.", [d(hero, "Если вы против них — говорите быстрее.")], "КЛАНГ!"),
    pg(4, `Triangle: ${motif}.`, "Три цвета в тумане сходятся.", [d(sv, "Месть — дорога без выхода."), d(hero, "Выход найду сам.")]),
    pg(5, "Silhouettes hold line; hero strikes captain.", "Силуэты держат линию.", [d("hunterCaptain", "Троих… как?"), d(hero, "Трое — мой любимый расклад.")], "WHOOSH!"),
    pg(6, "Quiet vow exchange, faces hidden.", "Тихий спор трёх идей.", [d(sv, "Убьёшь врага — станешь легендой."), d(hero, "Легенда — не пустота.")]),
    pg(7, `Sky marks: ${a.sym}, ${b.sym}, hero symbol.`, "В небе проступают три знака.", [d(hero, "Три пути. Один враг. Пока сходимся.")]),
    pg(8, "Combined strike cuts arena nets.", "Комбо рвёт сети.", [d(sv, "Вместе — до ворот."), d(hero, "После — каждый своей дорогой.")], "КРАК-БУМ!"),
    pg(9, "Triangle burned into sand.", "На песке — треугольный знак.", [d("herald", "Тебя объявят союзником тени!"), d(hero, "Объявят — не значит узнают.")]),
    pg(10, "Silhouettes depart; hero with mark on glove.", "Силуэты уходят тремя тропами.", [d(hero, "Спор трёх путей. Ответ — завтра."), d(sv, "Завтра мы снова станем тенью.")], "ШШШ…"),
  ]);
}

function ch10(hero, trio, rival, combo, sky, finTitle) {
  const [a, b] = trio;
  return ch(finTitle, [
    pg(1, "Arena ceremony: golden scoreboard, trio rumor.", "Церемония. Слухи о троице гремят.", [d("herald", "Верхний круг открыт. Финал — сегодня."), d(hero, "Сегодня зал полон.")]),
    pg(2, `FULL COLOR: ${a.id} — match ${a.id}_skin1.png.`, `${a.ru} выходит — полный облик.`, [d(a.id, a.l1), d(hero, a.l2)]),
    pg(3, `FULL COLOR: ${b.id} — match ${b.id}_skin1.png.`, `${b.ru} — полный дизайн.`, [d(b.id, b.l1), d(hero, b.l2)]),
    pg(4, "Trio vs hunters on sand — all FULL faces.", "Трое на песке. Лица видны.", [d(hero, "Слева — сети. Режем вместе."), d(a.id, a.bat), d(b.id, b.bat)], "КЛАНГ!"),
    pg(5, `Team combo: ${combo}.`, "Комбо суперов троих.", [d(hero, "Сейчас!"), d(a.id, a.sup), d(b.id, b.sup)], "КРАК-БУМ!"),
    pg(6, `${rival.id} descends upper gate.`, `${rival.ru} спускается.`, [d(rival.id, rival.l1), d(hero, rival.l2)]),
    pg(7, "Arena edge: three paths debate.", "Три голоса — три пути.", [d(a.id, a.deb), d(b.id, b.deb), d(hero, "Мой путь — мой выбор.")]),
    pg(8, `Night sky: ${sky} over Arena.`, "Ночное небо над куполом.", [d(rival.sp, rival.sl), d(hero, "Ношу память. Маску сниму.")]),
    pg(9, "Final splash: trio vs enemy wave.", "Финальный залп.", [d(hero, "Вперёд!"), d(rival.id, rival.fin), d(b.id, "Не сегодня!")], "ВЖУХ-ВЖУХ!"),
    pg(10, "End card: hero forward, trio behind.", "Конец главы X.", [d(hero, "Имя на табло — не конец."), d(a.id, "Мы рядом."), d(b.id, "До конца пути.")], "ВЕТЕР…"),
  ]);
}

const BRAWLERS = {
  hana: {
    id: "hana",
    name: "Хана",
    trioId: "oathbound-frontline",
    trioOthers: ["ronin", "goro"],
    lore: "Хана — фронтовой медик из Розового госпиталя. Лечебные пули лечат союзников и пробивают броню врагов. Она ни разу не сдалась перед безнадёжным пациентом и верит, что добро должно быть достаточно сильным, чтобы ударить первым.",
    skinRef: "public/dev-notes/brawler-skins/hana_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Хана pink medic coat healing pistol, blooming garden hospital, wounded soldiers, palette #E91E8C #FCE4EC #FF80AB, title ХАНА Cyrillic, NO speech balloons, match hana_skin1.png",
    npcs: {
      yuko: "Юко — главная сестра: седая коса, строгий розовый халат",
      mika: "Мика — юный пациент: бинты, упрямые глаза",
      vendrick: "Вендрик — капитан наёмников: трофейные жетоны, жестокая ухмылка",
      drSato: "Доктор Сато — полевой хирург: очки, усталые руки",
      herald: "Глашатай Арены — золотой рупор, аренская куртка",
      hunterCaptain: "Капитан охотников — белая маска, сети",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Розовый рассвет", "Пульс без ответа", "Выстрел милосердия", "Сирена крыла", "Трофейные охотники", "Добро с курком", "Песок полевого врача", "Шов на арене", "Три стража линии", "Клятва передовой"],
    ch9: () => ch9("hana", { sil: "red-armored katana", sym: "katana" }, { sil: "dual-axe giant", sym: "axe" }, "pink medic + crimson armor + mountain fury"),
    ch10: () =>
      ch10(
        "hana",
        [
          { id: "ronin", ru: "Ронин", l1: "Линия держится, когда честь не спит.", l2: "Честь слышна. Лечи дальше.", bat: "Щит держит.", sup: "Катана!", deb: "Суд — сталью." },
          { id: "goro", ru: "Горо", l1: "Ярость помнит твой сад. Мы обещали стычку.", l2: "Сад — не слабость.", bat: "Топоры крутятся.", sup: "Ярость!", deb: "Победа — топором." },
        ],
        { id: "vendrick", ru: "Вендрик", l1: "Сдай раненых — купишь жизнь!", l2: "Жизнь не продаётся.", fin: "Трофеи поглотят вас!", sp: "mika", sl: "Не превращай милосердие в товар." },
        "healing garden + stone katana + berserker spin",
        "pink hospital + red armor + northern peaks",
        "Клятва передовой",
      ),
  },
  goro: {
    id: "goro",
    name: "Горо",
    trioId: "oathbound-frontline",
    trioOthers: ["hana", "ronin"],
    lore: "Горо — горный варвар с северных вершин. Он не помнит детства, но помнит вкус победы. Двойные топоры выкованы его руками; ярость берсерка делает его лучшим ближним бойцом Арены.",
    skinRef: "public/dev-notes/brawler-skins/goro_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3; hero Горо giant bearded barbarian dual axes, northern peaks, fire rage, palette #8D4E2B #FF3D00 #BF360C, title ГОРО Cyrillic, NO speech balloons, match goro_skin1.png",
    npcs: {
      braggi: "Брагги — кузнец-старейшина: седой, молот, знает старые имена",
      skald: "Скальд — певец памяти: лира, шрамы, поёт забытые имена",
      krell: "Крелл — охотник клана: костяная броня, знает прошлое Горо",
      totemKeeper: "Хранитель тотема — маска медведя, посох, молчалив",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска, сети",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Вершина без имени", "Пепел памяти", "Вихрь двух топоров", "Тотем в списке", "Клан старого знака", "Ярость и пустота", "Ворота северного ветра", "Берсерк на песке", "Три огня линии", "Имя в камне"],
    ch9: () => ch9("goro", { sil: "pink medic coat", sym: "bloom" }, { sil: "red-armored katana", sym: "katana" }, "mountain fury + pink medic + crimson honor"),
    ch10: () =>
      ch10(
        "goro",
        [
          { id: "hana", ru: "Хана", l1: "Линия держится, когда ярость слушает.", l2: "Слушаю. Режу дальше.", bat: "Сад держит.", sup: "Цвети!", deb: "Лечить — не слабость." },
          { id: "ronin", ru: "Ронин", l1: "Честь помнит твои топоры.", l2: "Честь — тяжелее камня.", bat: "Щит держит.", sup: "Катана!", deb: "Суд — сталью." },
        ],
        { id: "krell", ru: "Крелл", l1: "Вернись, утраченный! Имя — наше!", l2: "Имя — моё. Не ваше.", fin: "Память поглотит тебя!", sp: "skald", sl: "Не носи чужое имя как кандалы." },
        "berserker spin + blooming garden + stone katana",
        "northern peaks + pink hospital + red armor",
        "Имя в камне",
      ),
  },
  sora: {
    id: "sora",
    name: "Сора",
    trioId: "eternal-ball",
    trioOthers: ["zafkiel", "verdeletta"],
    lore: "Сора — придворный маг, изгнанный за запретные звёздные руны. Летающая книга шепчет формулы, метеоритный дождь шрамит арену. Знание может осветить путь или сжечь дом.",
    skinRef: "public/dev-notes/brawler-skins/sora_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3; hero Сора blue robe floating spellbook, meteor rain, observatory, palette #1A237E #FFD700 #FF6F00, title СОРА Cyrillic, NO speech balloons, match sora_skin1.png",
    npcs: {
      archivistLune: "Архивариус Люн — седой, лунные очки, хранитель запретных полок",
      inquisitorVex: "Инквизитор Векс — белая маска со звездой, жжёт руны",
      starApprentice: "Звёздный ученик Эли — роба, страх и зависть",
      observatoryGuard: "Страж обсерватории — копьё, печать двора",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Книга на балконе", "Пепел запретных рун", "Пять огненных трещин", "Страница зовёт", "Инквизиторы звёзд", "Знание как пожар", "Ворота небесного круга", "Метеоры на песке", "Бал трёх теней", "Руна на табло"],
    ch9: () => ch9("sora", { sil: "clock-halo hourglass", sym: "hourglass" }, { sil: "green hell invitation", sym: "invitation" }, "violet runes + gold clocks + green hell"),
    ch10: () =>
      ch10(
        "sora",
        [
          { id: "zafkiel", ru: "Зафкиэль", l1: "Время пришло на бал. Часы не опаздывают.", l2: "Часы тикают. Руны — мои.", bat: "Откат держит.", sup: "Стоп!", deb: "Суд — секундой." },
          { id: "verdeletta", ru: "Верделетта", l1: "Руны помнят ваш зал. Мы обещали стычку.", l2: "Зал — не тюрьма. Я пришёл.", bat: "Тени танцуют.", sup: "Бал!", deb: "Хаос — приглашение." },
        ],
        { id: "inquisitorVex", ru: "Векс", l1: "Изгнанник… вернулся за вторым небом?", l2: "За страницей. Своей.", fin: "Руны сгорят!", sp: "archivistLune", sl: "Не сжигай дом ради одной формулы." },
        "meteor rain + eternity gate + shadow ball",
        "observatory + clock citadel + hell ballroom",
        "Руна на табло",
      ),
  },
  rin: {
    id: "rin",
    name: "Рин",
    trioId: "venom-tide",
    trioOthers: ["callista", "octavia"],
    lore: "Рин выросла в ядовитых джунглях. Каждый кинжал смазан личным ядом, формулу которого не знает никто. Она появляется бесшумно, отравляет цель и исчезает — но на Арене исчезнуть труднее, чем остаться.",
    skinRef: "public/dev-notes/brawler-skins/rin_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3; hero Рин green hair poison daggers, jungle mist, glowing venom, palette #2E7D32 #8BC34A #CE93D8, title РИН Cyrillic, NO speech balloons, match rin_skin1.png",
    npcs: {
      elderShade: "Старейшина Тень — лицо в татуировках лиан, хранитель формулы",
      formulaThief: "Вор формулы Сай — перчатки, алхимические флаконы",
      boneCollector: "Сборщик Костей — броня из костей, сети для токсинов",
      jungleGuide: "Проводник Ива — бесшумные шаги, знает тропы",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Туман формулы", "Секрет в листе", "Укус без звука", "Цветок под куполом", "Сборщики костяной брони", "Исчезнуть или остаться", "Ворота зелёного яруса", "Яд на песке", "Прилив трёх сил", "Лекарство в табло"],
    ch9: () => ch9("rin", { sil: "green hair flask", sym: "flask" }, { sil: "tentacle ink veil", sym: "ink" }, "jungle venom + acid flask + ink tide"),
    ch10: () =>
      ch10(
        "rin",
        [
          { id: "callista", ru: "Каллиста", l1: "Формула зовёт. Мы обещали стычку у ворот.", l2: "Формула — моя. Союз — наш.", bat: "Колба вспыхивает.", sup: "Реактив!", deb: "Риск — ради жизни." },
          { id: "octavia", ru: "Октавия", l1: "Вода помнит твой яд. Вместе — до конца.", l2: "Вода и яд — не враги.", bat: "Чернила прикрывают.", sup: "Завеса!", deb: "Исцеление — в глубине." },
        ],
        { id: "formulaThief", ru: "Сай", l1: "Сдай формулу — купишь джунгли!", l2: "Джунгли не продаются.", fin: "Яд поглотит вас!", sp: "elderShade", sl: "Не стань ядом, который сам боишься." },
        "poison cloud + explosive flask + ink veil",
        "jungle canopy + alchemy lab + underground lake",
        "Лекарство в табло",
      ),
  },
  taro: {
    id: "taro",
    name: "Таро",
    trioId: "forge-swarm",
    trioOthers: ["kenji", "oliver"],
    lore: "Таро — пожилой инженер, собравший первый шагоход в шесть лет. Гаечный ключ — оружие пострашнее меча, турели держат позиции часами. Он боится не смерти, а бесполезности.",
    skinRef: "public/dev-notes/brawler-skins/taro_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3; hero Таро elderly engineer wrench turrets brass, workshop, palette #5D4037 #CD9B39 #8D6E63, title ТАРО Cyrillic, NO speech balloons, match taro_skin1.png",
    npcs: {
      youngTaro: "Юный Таро — флешбэк: очки, первый ключ, упрямство",
      patentThief: "Вор патентов Гиз — перчатки, чемодан чертежей",
      munitionsBroker: "Брокер Ос — золотые зубы, торгует чужими идеями",
      workshopApprentice: "Ученик Пем — роба, восхищение и страх",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Ключ в шесть лет", "Украденный чертёж", "Турель у порога", "Приз на витрине", "Охотники за патентами", "Смех старика", "Ворота мастерской", "Латунь на песке", "Рой трёх искр", "Шестерня на табло"],
    ch9: () => ch9("taro", { sil: "yellow lightning coils", sym: "coil" }, { sil: "bronze beetle swarm", sym: "beetle" }, "brass wrench + lightning cage + beetle shield"),
    ch10: () =>
      ch10(
        "taro",
        [
          { id: "kenji", ru: "Кендзи", l1: "Клетка молний помнит вашу мастерскую.", l2: "Мастерская — в сердце.", bat: "Молния прыгает.", sup: "Клетка!", deb: "Доказать — не сломать." },
          { id: "oliver", ru: "Оливер", l1: "Жуки помнят твой ключ. Мы обещали стычку.", l2: "Ключ — не игрушка.", bat: "Рой держит.", sup: "Щит!", deb: "Память — дар." },
        ],
        { id: "patentThief", ru: "Гиз", l1: "Сдай чертежи — купишь молодость!", l2: "Молодость не купить.", fin: "Патенты поглотят вас!", sp: "youngTaro", sl: "Не превращай изобретение в чужое оружие." },
        "turret line + lightning cage + beetle swarm",
        "iron workshop + university coils + family garage",
        "Шестерня на табло",
      ),
  },
  verdeletta: {
    id: "verdeletta",
    name: "Верделетта",
    trioId: "eternal-ball",
    trioOthers: ["zafkiel", "sora"],
    lore: ru["brawler.verdeletta.lore"],
    skinRef: "public/dev-notes/brawler-skins/verdeletta_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Верделетта hell ceremony masteress, green hell light, shadow guests, invitation pistol, palette #2E7D32 #1B5E20 #69F0AE, title ВЕРДЕЛЕТТА Cyrillic, NO speech balloons, match verdeletta_skin1.png",
    npcs: {
      brasso: "Брассо — демон-распорядитель: латунная маска, протокол преисподней",
      mora: "Мора — барменша на границе: зелёный фартук, адские слухи",
      gatekeeper: "Привратник преисподней — книга гостей, дымовые рога",
      unpaidGuest: "Гость без билета — тень живёт отдельно от тела",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников протокола — белая маска, цепи",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Зал, который не спит", "Билет без имени", "Протокол преисподней", "Бал на крыше", "Тень шевелится", "Цена входа", "Первый песок", "Охота распорядителей", "Спор трёх путей", "Бал вечности"],
    ch9: () => ch9("verdeletta", { sil: "clock-halo hourglass", sym: "hourglass" }, { sil: "floating rune book", sym: "rune page" }, "green hell + white-gold clock + violet runes"),
    ch10: () => ch10("verdeletta", [
      { id: "zafkiel", ru: "Зафкиэль", l1: "Время пришло на бал. Часы не опаздывают.", l2: "Часы тикают. Я — не секунда.", bat: "Откат держит.", sup: "Стоп!", deb: "Суд — секундой." },
      { id: "sora", ru: "Сора", l1: "Руны помнят ваш зал. Мы обещали стычку.", l2: "Руны — не приглашения. Но я пришла.", bat: "Страница режет.", sup: "Печать!", deb: "Запрет — свитком." },
    ], { id: "brasso", ru: "Брассо", l1: "Последний танец — по протоколу!", l2: "Протокол — не музыка.", fin: "Цепи поглотят бал!", sp: "gatekeeper", sl: "Не превращай гостей в пепел." }, "invitation mark + clock rewind + rune seal", "green hell fire + clock halo + violet runes", "Бал вечности"),
  },
  lumina: {
    id: "lumina",
    name: "Люмина",
    trioId: "shadow-grove",
    trioOthers: ["miya", "silven"],
    lore: ru["brawler.lumina.lore"],
    skinRef: "public/dev-notes/brawler-skins/lumina_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Lumina mythic girl glowing wings golden threads, palette #ECEFF1 #FFD54F #FFFFFF, title ЛЮМИНА Cyrillic, NO speech balloons, match lumina_skin1.png",
    npcs: {
      sisterMaris: "Сестра Марис — монахиня часовни у обрыва",
      lostSoul: "Потерянная душа — просит покоя, полупрозрачная",
      lightHunter: "Охотник за падшим светом — чёрный плащ",
      penitent: "Кающийся воин — шрамы, ищет прощения",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска, сети",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Часовня у обрыва", "Крылья без неба", "Нить к потерянным", "Охотники света", "Золотая клетка", "Цена милосердия", "Первый суд на песке", "Бой без крови", "Спор трёх путей", "Свет на табло"],
    ch9: () => ch9("lumina", { sil: "ninja shuriken fan", sym: "shuriken" }, { sil: "tree-antler silhouette", sym: "oak leaf" }, "purple shadow + green roots + gold light"),
    ch10: () => ch10("lumina", [
      { id: "miya", ru: "Мия", l1: "Тень с бамбуком. Мы обещали стычку у ворот.", l2: "Обещание держу. Свет — впереди.", bat: "Лезвие держит.", sup: "Разрыв!", deb: "Клинок — моим дыханием." },
      { id: "silven", ru: "Сильвен", l1: "Корни помнят ваш свет. Вместе — до конца.", l2: "Корни и свет — не враги.", bat: "Корни держат.", sup: "Рост!", deb: "Суд — корнями." },
    ], { id: "lightHunter", ru: "Патриарх света", l1: "Падшая… вернулась за вторым сиянием?", l2: "За именем. Твоим.", fin: "Свет поглотит крылья!", sp: "lostSoul", sl: "Не носи чужую ярость как вторые крылья." }, "golden dome + shuriken fan + life tree", "chapel cliff + oak crown + golden cage", "Свет на табло"),
  },
  oliver: {
    id: "oliver",
    name: "Оливер",
    trioId: "forge-swarm",
    trioOthers: ["kenji", "taro"],
    lore: ru["brawler.oliver.lore"],
    skinRef: "public/dev-notes/brawler-skins/oliver_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Oliver russet hair round glasses bronze beetles blue replicator, palette #795548 #FFD54F #42A5F5, title ОЛИВЕР Cyrillic, NO speech balloons, match oliver_skin1.png",
    npcs: {
      emma: "Эмма — мать механика: пайка, чай, тревожные руки",
      beetleBrother: "Жук-брат — бронзовый, хранит голос памяти",
      collector: "Коллекционер механизмов — витрина, холодные глаза",
      rivalTinker: "Пакс — соперник-ученик: зависть к репликатору",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Мастерская на рассвете", "Жук, который помнит", "Репликатор молчит", "Коллекционер пришёл", "Рой на крыше", "Цена копии", "Первый бой на песке", "Супер чужого", "Спор трёх путей", "Сердце роя"],
    ch9: () => ch9("oliver", { sil: "yellow lightning cage", sym: "coil" }, { sil: "brass wrench silhouette", sym: "wrench" }, "bronze beetles + lightning cage + brass forge"),
    ch10: () => ch10("oliver", [
      { id: "kenji", ru: "Кенджи", l1: "Клетка молний помнит твой рой.", l2: "Молния и жуки — союз.", bat: "Молния прыгает.", sup: "Клетка!", deb: "Доказать — не сломать." },
      { id: "taro", ru: "Таро", l1: "Ключ помнит твоих жуков. Стычка у ворот.", l2: "Ключ — не игрушка.", bat: "Турель держит.", sup: "Огонь!", deb: "Изобретение — с сердцем." },
    ], { id: "collector", ru: "Коллекционер", l1: "Отдай репликатор и жуков!", l2: "Брат — не вещь.", fin: "Жуки — в витрину!", sp: "beetleBrother", sl: "Не продавай память за болт." }, "beetle swarm + lightning cage + turret line", "family garage + university lab + iron workshop", "Сердце роя"),
  },
  callista: {
    id: "callista",
    name: "Каллиста",
    trioId: "venom-tide",
    trioOthers: ["rin", "octavia"],
    lore: ru["brawler.callista.lore"],
    skinRef: "public/dev-notes/brawler-skins/callista_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Callista green hair lens goggles explosive flasks, palette #43A047 #FFFFFF #A5D6A7, title КАЛЛИСТА Cyrillic, NO speech balloons, match callista_skin1.png",
    npcs: {
      professorVoss: "Профессор Восс — наставник до взрыва лаборатории",
      censor: "Цензор гильдии — белые перчатки, запреты",
      patientZero: "Первый пациент — шрамы реакции, надежда",
      remy: "Реми — ассистент: дрожит, но верит",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Лаборатория до грома", "Осколки формулы", "Линзы видят боль", "Гильдия пришла", "Кислота и лёд", "Риск ради науки", "Первый реактив на песке", "Смесь без имени", "Спор трёх путей", "Лекарство на табло"],
    ch9: () => ch9("callista", { sil: "poison vial silhouette", sym: "vial" }, { sil: "ink tide trident", sym: "wave" }, "green acid + violet poison + blue tide"),
    ch10: () => ch10("callista", [
      { id: "rin", ru: "Рин", l1: "Яд и лекарство — соседи на полке.", l2: "Соседи — не враги.", bat: "Флакон держит.", sup: "Капля!", deb: "Правда — в дозе." },
      { id: "octavia", ru: "Октавия", l1: "Вода смывает осколки лаборатории.", l2: "Смыть — не забыть.", bat: "Прилив держит.", sup: "Волна!", deb: "Месть — не лекарство." },
    ], { id: "censor", ru: "Цензор", l1: "Сдай все рецепты гильдии!", l2: "Наука — не тайна для трусов.", fin: "Смесь поглотит вас!", sp: "professorVoss", sl: "Не взрывай ради гордости." }, "mega-mix + poison cloud + tidal veil", "lab ruins + jungle vial + moonlit lake", "Лекарство на табло"),
  },
  elian: {
    id: "elian",
    name: "Элиан",
    trioId: "starbound-scholars",
    trioOthers: ["yuki", "mirabel"],
    lore: ru["brawler.elian.lore"],
    skinRef: "public/dev-notes/brawler-skins/elian_skin1.png",
    cover: "finished full-color comic book cover, vertical 2:3 poster; hero Elian star coat blue charges gravity vortex, palette #1565C0 #FFD54F #E3F2FD, title ЭЛИАН Cyrillic, NO speech balloons, match elian_skin1.png",
    npcs: {
      directorKael: "Директор Каэль — обсерватория, строгий плащ",
      orbitEater: "Разведчик пожирателей орбит — трещины в небе",
      chartSpirit: "Дух карты — шёпот созвездий",
      nova: "Нова — соперник-ученик: зависть к звёздам",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    titles: ["Карта над городом", "Звезда, что упала", "Заряд созревает", "Пожиратели орбит", "Воронка на мосту", "Вина дальнего выстрела", "Первый матч на песке", "Созвездие врага", "Спор трёх путей", "Имя на звёздах"],
    ch9: () => ch9("elian", { sil: "ice healer swirl", sym: "snowflake" }, { sil: "floating spellbook", sym: "book page" }, "blue star charge + ice healing + violet pages"),
    ch10: () => ch10("elian", [
      { id: "yuki", ru: "Юки", l1: "Лёд помнит твою звезду. Стычка у ворот.", l2: "Холод — не пустота.", bat: "Иней держит.", sup: "Буря!", deb: "Исцеление — терпением." },
      { id: "mirabel", ru: "Мирабель", l1: "Книга хранит твои неба. Вместе — до конца.", l2: "Страницы — не цепи.", bat: "Строка режет.", sup: "Глава!", deb: "Истина — в тексте." },
    ], { id: "orbitEater", ru: "Пожиратель", l1: "Звёзды — моя трапеза!", l2: "Не сегодня.", fin: "Орбиты сожрут вас!", sp: "chartSpirit", sl: "Не неси вину как второе созвездие." }, "gravity vortex + ice storm + book seal", "observatory dome + mountain temple + library light", "Имя на звёздах"),
  },
};

function loreStory(b) {
  const hero = b.id;
  const npcKeys = Object.keys(b.npcs).filter((k) => !["herald", "hunterCaptain", "shadowVoice"].includes(k));
  const scenes = [
    (loc) => `Wide establishing: ${loc}, ${b.name} center frame, signature motif.`,
    (loc) => `Close-up: ${b.name} trains signature power at ${loc}.`,
    (loc) => `Flashback inset at ${loc} — wound that drives the arc.`,
    (loc) => `Ally scene at ${loc}; enemy scouts on horizon.`,
    (loc) => `First counterattack at ${loc}; crowd or witnesses react.`,
    (loc) => `Night at ${loc}; memory and doubt.`,
    (loc) => `Arena dome visible from ${loc}; call answered.`,
    (loc) => `Commitment at ${loc}; no turning back.`,
    (loc) => `Power flash at ${loc}; super move foreshadowed.`,
    (loc) => `Cliffhanger at ${loc}; chapter end.`,
  ];
  const narr = [
    (t, loc) => `${t}. ${loc} — утро ещё кажется обычным.`,
    (t) => `${t}. Первые трещины будущей битвы ещё не слышны.`,
    (t) => `${t}. Тишину рвёт слишком тихий звук.`,
    (t) => `${t}. Поле испытания становится судом.`,
    (t) => `${t}. Первый настоящий ответ.`,
    (t) => `${t}. Ночь. Память стучит в грудь.`,
    (t) => `${t}. Вдали — купол Арены.`,
    (t) => `${t}. Выбор, который нельзя стереть словами.`,
    (t) => `${t}. Вспышка силы рвёт привычный ритм.`,
    (t, ch) => `Глава ${ch}. ${t}.`,
  ];
  const sfx = [null, null, "ТРЕСК!", "WHOOSH!", null, null, null, null, "KRAK-BOOM!", "ШШШ…"];
  const locs = [
    ["главный зал", "переулок живых", "трибунал", "крыша", "зеркальный переулок", "алтарь долга", "нижний круг", "средний круг"],
    ["часовня", "пепелище", "лесной алтарь", "рынок", "крыши", "два алтаря", "песок", "арена"],
    ["мастерская", "комната брата", "лаборатория", "рынок", "крыша", "клятва", "песок", "арена"],
    ["лаборатория", "руины", "подвал", "гильдия", "колбы", "риск", "песок", "арена"],
    ["обсерватория", "обрыв", "купол", "мост", "воронка", "вина", "песок", "арена"],
  ];
  const locIdx = { verdeletta: 0, lumina: 1, oliver: 2, callista: 3, elian: 4 }[hero] ?? 0;
  const locsFor = locs[locIdx];
  const loreBits = b.lore.split(/[.!?…]+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const npcPrompts = [
    "Сегодня линия на тебе",
    "Видишь знак на горизонте",
    "Что-то треснуло",
    "Держись рядом",
    "Ты вернула надежду",
    "Они оставили вопрос",
    "Ты тоже это слышишь",
    "Если выйдешь — пути назад не будет",
    "Она удержала удар",
    "Если путь открыт",
  ];
  const heroPrompts = [
    "Не отпущу",
    "Знак дышит раньше раны",
    "Смотри на трещину",
    "Я не один",
    "Ещё можно исправлять",
    "Вопросы не стареют",
    "Арена ждёт — отвечу",
    "Проложу новый путь",
    "Боюсь только пустоты",
    "Не отступлю",
  ];
  const lineAt = (ci, pi) => {
    const idx = ci * 10 + pi;
    const bit = loreBits[idx % loreBits.length] ?? b.titles[ci];
    const loc = locsFor[ci];
    return {
      npc: `${npcPrompts[pi]} — ${loc}? ${bit.slice(0, 48)}…`,
      hero: `${heroPrompts[pi]}. ${bit.slice(-42)}`,
    };
  };
  return b.titles.slice(0, 8).map((title, ci) => {
    const loc = locsFor[ci];
    const pages = scenes.map((sc, pi) => {
      const n1 = npcKeys[(ci * 10 + pi) % npcKeys.length];
      const lines = lineAt(ci, pi);
      return pg(
        pi + 1,
        sc(loc),
        pi === 9 ? narr[pi](title, ci + 1) : narr[pi](title, loc),
        pi % 3 === 2 ? [d(hero, lines.hero)] : [d(n1, lines.npc), d(hero, lines.hero)],
        sfx[pi],
      );
    });
    return ch(title, pages);
  });
}

function buildChapters18(b) {
  if (STORY[b.id]) return STORY[b.id]();
  return loreStory(b);
}

const STORY = {
  hana() {
    return [
      ch("Розовый рассвет", [
        pg(1, "Wide dawn: Pink Hospital between trenches, flower garden.", "Розовый госпиталь на линии фронта. Сад цветёт — линия жива.", [d("yuko", "Смена начинается, Хана."), d("hana", "Пульс сада ровнее пульса фронта.")]),
        pg(2, "Close: Hana checks healing pistol beside blooming beds.", "Лечебный пистолет. Два режима — один выбор в секунду.", [d("drSato", "Сегодня много раненых."), d("hana", "Тогда много ответов.")]),
        pg(3, "Training ward: heal dummy then pierce armor plate.", "Учебный зал. Мишень принимает и шов, и дырку.", [d("mika", "Ты правда лечишь и бьёшь?"), d("hana", "Добро без силы — только совет.")]),
        pg(4, "Night: distress signal from Arena medical wing.", "Сигнал бедствия с медкрыла Арены.", [d("yuko", "Это не наш фронт."), d("hana", "Боль — не знает границ.")]),
        pg(5, "Chart of hopeless patient she refused to abandon.", "Карта безнадёжного пациента. Крест не поставлен.", [d("hana", "Пока дышит — стреляю в жизнь.")]),
        pg(6, "Mercenaries sell wounded tags on black market.", "Наёмники торгуют жетонами раненых.", [d("drSato", "Трофеи… люди…"), d("hana", "Закончится на моём прицеле.")]),
        pg(7, "Hana plants garden seed in ammo pouch.", "Семя в кармане — обещание вернуться.", [d("mika", "Ты уходишь?"), d("hana", "Ухожу лечить больше, чем один зал.")]),
        pg(8, "Super preview: Blooming Garden over triage tent.", "Цветущий сад накрывает перевязочную.", [d("hana", "Держитесь в круге!")], "КРАК!"),
        pg(9, "Arena dome glows pink beyond trenches.", "Купол пульсирует розовым.", [d("yuko", "Там ответ. Или ловушка."), d("hana", "Ловушки тоже нуждаются в враче.")]),
        pg(10, "Cliffhanger: Hana walks toward dome.", "Она идёт к куполу.", [d("hana", "Розовый рассвет закончился. Путь — нет.")], "ШШШ…"),
      ]),
      ch("Пульс без ответа", [
        pg(1, "Emergency: hopeless patient flatlines.", "Безнадёжный пациент. Линия ровная.", [d("drSato", "Хана… не трать заряды."), d("hana", "Трачу.")]),
        pg(2, "Flashback: Mika saved from same diagnosis.", "Память: она уже побеждала этот приговор.", [d("mika", "Ты не сдалась тогда."), d("hana", "Не сдамся сейчас.")]),
        pg(3, "Healing burst — heartbeat returns.", "Лечебная вспышка. Пульс возвращается.", [d("yuko", "Как?!"), d("hana", "График приёма — без отказов.")], "ВЖУХ!"),
        pg(4, "Vendrick watches — wants patient as trophy.", "Вендрик смотрит из окна.", [d("vendrick", "Продам дороже."), d("hana", "Пациент не товар.")]),
        pg(5, "Mercenary raid; Hana shoots armor.", "Налёт. Пули режут броню.", [d("vendrick", "Сдай аптечку!"), d("hana", "Сначала сдай оружие.")], "БУМ!"),
        pg(6, "Mika under bed; garden dome covers.", "Сад прикрывает ребёнка.", [d("hana", "Дыши. Цветы не предают.")]),
        pg(7, "Patient whispers Arena coordinates.", "Пациент шепчет координаты Арены.", [d("mika", "Он видел купол…"), d("hana", "Зов услышан.")]),
        pg(8, "Yuko gives field medic seal.", "Печать полевого врача.", [d("yuko", "Верни сад."), d("hana", "Расширенным.")]),
        pg(9, "Vendrick vows catch at gates.", "Клятва у ворот.", [d("vendrick", "На Арене раненые — валюта.")]),
        pg(10, "Hospital scarred; Hana on road.", "Госпиталь в шрамах.", [d("hana", "Глава II. Пульс без ответа — ответ дан.")], "ШШШ…"),
      ]),
      ch("Выстрел милосердия", [
        pg(1, "Forest trail: wounded soldiers ambushed.", "Тропа. Засада на раненых.", [d("drSato", "Мы опоздали!"), d("hana", "Опоздание — не приговор.")]),
        pg(2, "Hana heals ally then shoots mercenary armor.", "Лечит союзника — бьёт броню врага.", [d("hana", "Один курок — два смысла.")], "ВЖУХ!"),
        pg(3, "Signature: healing bullet through plate.", "Лечебная пуля пробивает сталь.", [d("vendrick", "Как?!"), d("hana", "Добро достаточно острое.")]),
        pg(4, "Rescued soldier carries Arena flyer.", "Листовка Арены в крови.", [d("drSato", "Медкрыло зовёт."), d("hana", "Слышу.")]),
        pg(5, "Night camp: inner conflict — strike first?", "Ночь. Добро должно бить первым?", [d("hana", "Милосердие без курка — мишень.")]),
        pg(6, "Vendrick bounty poster with her face.", "Плакат с её лицом.", [d("mika", "Тебя ищут!"), d("hana", "Пусть ищут. Я ищу виновных.")]),
        pg(7, "Garden super heals three at once.", "Сад лечит троих.", [d("hana", "В круге — дышите!")], "КРАК!"),
        pg(8, "Arena transit checkpoint ahead.", "КПП к куполу.", [d("yuko", "Голос письма: осторожно."), d("hana", "Осторожность — не отступление.")]),
        pg(9, "Dome silhouette through rain.", "Купол в дожде.", [d("hana", "Сирена ближе.")]),
        pg(10, "Cliff: pistol raised to sky.", "Пистолет к небу.", [d("hana", "Глава III. Выстрел милосердия — моя визитка.")], "ШШШ…"),
      ]),
      ch("Сирена крыла", [
        pg(1, "Arena medical wing ruins: siren wails.", "Руины медкрыла. Сирена воет.", [d("herald", "Эвакуация провалена!"), d("hana", "Эвакуация — моя смена.")]),
        pg(2, "Trapped medics behind collapsed beam.", "Медики под балкой.", [d("drSato", "Не выдержим!"), d("hana", "Выдержите. Я уже здесь.")]),
        pg(3, "Healing shots stabilize while cutting debris.", "Пули стабилизируют — режет обломки.", [d("hana", "Пульс сначала. Камень — потом.")], "КРАК!"),
        pg(4, "Arena call confirmed — wing was bait.", "Медкрыло — приманка.", [d("vendrick", "Раненые — наживка!"), d("hana", "Наживка кусается.")]),
        pg(5, "Rescued medic gives upper tier map.", "Карта верхнего яруса.", [d("drSato", "Там торгуют людьми."), d("hana", "Там закончу торг.")]),
        pg(6, "Register alias Pink Surgeon.", "Псевдоним «Розовый хирург».", [d("herald", "Первый бой — завтра."), d("hana", "Завтра — рано. Сегодня — швы.")]),
        pg(7, "Vendrick seen with arena patron.", "Вендрик у покровителя.", [d("hana", "Вытащу на песок.")]),
        pg(8, "Night: tends child gladiator in slums.", "Лечит ребёнка-гладиатора.", [d("mika", "Голос письма: не бросай."), d("hana", "Не бросаю.")]),
        pg(9, "Garden blooms on rooftop.", "Сад на крыше.", [d("hana", "Цветы видят купол.")]),
        pg(10, "Walks to lower gate at dawn.", "Рассвет у ворот.", [d("hana", "Глава IV. Сирена смолкла. Я — ответ.")]),
      ]),
      ch("Трофейные охотники", [
        pg(1, "Slum market: wounded sold in cages.", "Рынок. Раненые в клетках.", [d("vendrick", "Лоты свежие!"), d("hana", "Свежесть — не оправдание.")]),
        pg(2, "Hana buys time with healing burst on guard.", "Лечит стража — выигрывает секунды.", [d("hana", "Спасибо не нужно. Отойди.")], "ВЖУХ!"),
        pg(3, "Frees prisoners; vendrick hunts.", "Освобождение. Погоня.", [d("vendrick", "Ты портишь товар!")], "WHOOSH!"),
        pg(4, "Alley fight: shoot knee plates not hearts.", "Стреляет в колени брони.", [d("hana", "Живите. Свидетельствуйте.")]),
        pg(5, "Child prisoner knows vendrick ledger.", "Ребёнок знает книгу учёта.", [d("mika", "Он записал имена…"), d("hana", "Имена — мой список.")]),
        pg(6, "Hunter captain with nets for wounded.", "Капитан с сетями.", [d("hunterCaptain", "Сдай беглецов!"), d("hana", "Сдай сети.")]),
        pg(7, "Garden dome traps captain.", "Купол ловит капитана.", [d("hana", "Отдыхай. Подумай.")], "КРАК!"),
        pg(8, "Map to trophy vault under arena.", "Тайник трофеев под ареной.", [d("drSato", "Туда нельзя."), d("hana", "Туда — именно.")]),
        pg(9, "Prepares medic kit and ammo.", "Аптечка и патроны.", [d("hana", "Два кармана. Одна цель.")]),
        pg(10, "Lower gate opens.", "Нижние ворота.", [d("hana", "Глава V. Охота на охотников.")], "ШШШ…"),
      ]),
      ch("Добро с курком", [
        pg(1, "Shrine tent: oath to heal and protect.", "Шатёр-клятва.", [d("yuko", "Ты клялась не стрелять."), d("hana", "Клялась не бросать.")]),
        pg(2, "Flashback: first kill shot saved ward.", "Память: выстрел спас зал.", [d("drSato", "Тогда ты плакала."), d("hana", "Плакала — не отступила.")]),
        pg(3, "Debate with Sato: mercy vs force.", "Спор: милость или сила.", [d("drSato", "Добро не стреляет!"), d("hana", "Добро без силы — жертва.")]),
        pg(4, "Mika brings flower from hospital garden.", "Цветок из сада.", [d("mika", "Он выжил."), d("hana", "Значит, клятва жива.")]),
        pg(5, "Writes two oaths on bandage.", "Две клятвы на бинте.", [d("hana", "Лечить. Бить за жизнь.")]),
        pg(6, "Vendrick offer: join trophy trade.", "Предложение Вендрика.", [d("vendrick", "Богатство за союз."), d("hana", "Богатство не лечит.")]),
        pg(7, "Nightmare: patients as merchandise.", "Кошмар: пациенты как товар.", [d("hana", "Проснусь — и изменю.")]),
        pg(8, "Arena tribunal grants trial by combat.", "Трибунал: бой за право суда.", [d("herald", "Победи — получишь голос."), d("hana", "Голос — шов на ране Арены.")]),
        pg(9, "Walks to sand with pistol and seeds.", "Песок. Пистолет и семена.", [d("hana", "Добро с курком — не противоречие.")]),
        pg(10, "Gate guard salutes medic seal.", "Страж чтит печать.", [d("hana", "Глава VI. Цена силы — ответственность.")]),
      ]),
      ch("Песок полевого врача", [
        pg(1, "Lower ring: Hana vs chain gladiator.", "Нижний круг.", [d("herald", "«Розовый хирург»!"), d("hana", "Сниму броню — не жизнь.")]),
        pg(2, "Heals fallen foe to shock crowd.", "Лечит поверженного врага.", [d("vendrick", "Предательство стиля!"), d("hana", "Стиль — жизнь.")]),
        pg(3, "Shoots armor joints; enemy yields.", "Стреляет в суставы брони.", [d("hana", "Сдавайся. Живи.")], "ВЖУХ!"),
        pg(4, "Crowd splits — some cheer mercy.", "Толпа расколота.", [d("mika", "Они видят!")]),
        pg(5, "Captain backstage: sell her to vendrick.", "Сделка за голову.", [d("hunterCaptain", "Цена за медика."), d("hana", "Цена — мой прицел.")]),
        pg(6, "Tends arena slave fighter.", "Лечит раба-бойца.", [d("hana", "Арена жрёт. Я — противоядие.")]),
        pg(7, "Night training: heal and harm same target.", "Тренировка двух режимов.", [d("hana", "Один вдох — два выбора.")]),
        pg(8, "Signs fight vs Trophy Lord.", "Вызов «Лорду трофеев».", [d("herald", "Это Вендрик.")]),
        pg(9, "Garden blooms on sand practice.", "Сад на тренировочном песке.", [d("hana", "Песок впитает цветы.")]),
        pg(10, "Upper tier glows.", "Верхний ярус.", [d("hana", "Глава VII. Песок принимает шов.")], "ШШШ…"),
      ]),
      ch("Шов на арене", [
        pg(1, "Mid ring: Vendrick with trophy hooks.", "Вендрик с крюками.", [d("vendrick", "Раненые — моя валюта!"), d("hana", "Валюта — твой конец.")]),
        pg(2, "Hooks snag medics in stands.", "Крюки тянут медиков.", [d("hana", "Руки прочь от моих.")], "РВАНЬ!"),
        pg(3, "Healing volley saves crowd.", "Лечебный залп в толпу.", [d("hana", "Живите! Свидетельствуйте!")], "ВЖУХ!"),
        pg(4, "Garden dome on sand — super.", "Цветущий сад на песке.", [d("hana", "Круг жизни!")], "КРАК-БУМ!"),
        pg(5, "Vendrick mask cracks — arena broker.", "Под маской — брокер Арены.", [d("hana", "Пешка. Покровитель прячется.")]),
        pg(6, "Tribunal opens upper gate.", "Верхний ярус открыт.", [d("herald", "Финал — на рассвете!")]),
        pg(7, "Hunters surround quarters.", "Окружение.", [d("hunterCaptain", "Ты сломала торговлю!"), d("hana", "Торговля сломала людей.")]),
        pg(8, "Escapes via rooftop garden.", "Побег по крыше.", [d("hana", "Цветы — лестница.")], "ВЖУХ!"),
        pg(9, "Rain roof toward upper tier.", "Крыша под дождём.", [d("hana", "Финал ждёт шов.")]),
        pg(10, "Chapter VIII end.", "Глава VIII.", [d("hana", "Шов на арене — не метафора.")], "ДОЖДЬ…"),
      ]),
    ];
  },
  goro() {
    return [
      ch("Вершина без имени", [
        pg(1, "Wide: northern peaks above clouds, forge smoke.", "Северные вершины без карт. Туман ниже — мир.", [d("braggi", "Сегодня куёшь или помнишь?"), d("goro", "Кую. Память — пустая.")]),
        pg(2, "Goro spins dual axes at training stones.", "Двойные топоры рубят валуны.", [d("skald", "Ритм как сердце."), d("goro", "Сердце помнит. Голова — нет.")]),
        pg(3, "Flashback shard: child hand on axe — face blurred.", "Осколок: детская рука на топоре. Лица нет.", [d("goro", "Кто я был?")]),
        pg(4, "Totem pole shows scratched fighter list.", "Тотем со списком бойцов.", [d("totemKeeper", "Имя стёрто ветром."), d("goro", "Ветер вернёт — или я.")]),
        pg(5, "Krell watches from ridge — clan hunter.", "Крелл на гребне.", [d("krell", "Ты наш. Утраченный."), d("goro", "Ваш — не значит помню.")]),
        pg(6, "Braggi hands newly forged axe pair.", "Новая пара топоров.", [d("braggi", "Они тяжелее прошлых."), d("goro", "Тяжесть — честная.")]),
        pg(7, "Avalanche reveals Arena dome far south.", "Лавина открывает вид на купол.", [d("skald", "Там имя на камне."), d("goro", "Камень не врёт.")]),
        pg(8, "Berserker rage flicker — eyes orange.", "Вспышка ярости.", [d("goro", "Пламя без прошлого.")], "ГРРР!"),
        pg(9, "Night: name carved on totem matches arena poster.", "Имя на тотеме = афиша Арены.", [d("totemKeeper", "Список зовёт.")]),
        pg(10, "Goro walks down mountain.", "Спуск с вершины.", [d("goro", "Вершина без имени. Внизу — ответ.")], "ШШШ…"),
      ]),
      ch("Пепел памяти", [
        pg(1, "Village raid: clan burns memory shrine.", "Клан сжигает святилище памяти.", [d("krell", "Вернись домой!"), d("goro", "Дом — пепел.")], "БУМ!"),
        pg(2, "Skald wounded; Goro shields with axes.", "Скальд ранен. Топоры — щит.", [d("skald", "Пой… имя…"), d("goro", "Пою топором.")]),
        pg(3, "Memory void — childhood blank.", "Провал: детство пусто.", [d("goro", "Что вы забрали?")]),
        pg(4, "Finds arena fighter token with old name.", "Жетон бойца со старым именем.", [d("braggi", "Это ты. До снега."), d("goro", "Снег стёр. Сталь — нет.")]),
        pg(5, "Krell reveals clan erased his past.", "Крелл: клан стёр его прошлое.", [d("krell", "Ты был нашим вождем."), d("goro", "Был — не значит помню.")]),
        pg(6, "Axe spin clears raiders.", "Вихрь топоров.", [d("goro", "Пепел не ответ.")], "ВЖУХ!"),
        pg(7, "Totem piece in pocket — promise.", "Кусок тотема в кармане.", [d("totemKeeper", "Верни имя на камень.")]),
        pg(8, "Leaves burning peaks.", "Уходит с гор.", [d("braggi", "Топоры помнят руки."), d("goro", "Руки — помнят победу.")]),
        pg(9, "Arena road through pass.", "Дорога к куполу.", [d("skald", "Песок хранит имена.")]),
        pg(10, "Silhouette against snow and dome.", "Силуэт на снегу.", [d("goro", "Глава II. Пепел памяти. Имя — впереди.")], "ШШШ…"),
      ]),
      ch("Вихрь двух топоров", [
        pg(1, "Pass ambush: bone-armor collectors.", "Засада сборщиков.", [d("krell", "Беги!"), d("goro", "Бегу вперёд.")]),
        pg(2, "360 axe spin — signature debut.", "Вихрь 360° — визитка.", [d("goro", "Два топора — один круг.")], "ВЖУХ!"),
        pg(3, "Enemy shields shatter twice.", "Щиты ломаются дважды.", [d("goro", "Ни один не выдержал.")]),
        pg(4, "Skald records fight in song.", "Скальд записывает бой.", [d("skald", "Песня без имени — пока.")]),
        pg(5, "Finds arena registration booth in pass.", "Стоянка регистрации.", [d("herald", "Имя?"), d("goro", "Скажу на песке.")]),
        pg(6, "Krell offers clan deal — memory for loyalty.", "Сделка клана.", [d("krell", "Вернись — вспомнишь."), d("goro", "Вспомню сам.")]),
        pg(7, "Night rage training — orange aura.", "Ночная ярость.", [d("goro", "Пламя не спрашивает кто я.")], "ГРРР!"),
        pg(8, "Totem name glows on poster.", "Имя на афише светится.", [d("totemKeeper", "Список ждёт.")]),
        pg(9, "Dome close.", "Купол близко.", [d("goro", "Тотем в списке — зов.")]),
        pg(10, "Axe over shoulder to gates.", "Топор на плече.", [d("goro", "Глава III. Вихрь — мой язык.")], "ШШШ…"),
      ]),
      ch("Тотем в списке", [
        pg(1, "Arena outer wall: fighter list carved.", "Список бойцов на стене.", [d("goro", "Имя… знакомое пустое.")]),
        pg(2, "Clerk finds his totem mark.", "Клерк узнаёт метку тотема.", [d("herald", "Старое имя в базе!"), d("goro", "Старое — не мёртвое.")]),
        pg(3, "Register alias Mountain Break.", "Псевдоним «Горный излом».", [d("goro", "Имя на ветру. Пока.")]),
        pg(4, "Krell in crowd — watching.", "Крелл в толпе.", [d("krell", "Домой, утраченный.")]),
        pg(5, "Patent of past fights — empty pages.", "Архив боёв — пустые страницы.", [d("skald", "Кто-то стёр историю.")]),
        pg(6, "Braggi letter: axes were child's size once.", "Письмо: топоры детского размера.", [d("goro", "Руки выросли. Память — нет.")]),
        pg(7, "Inquisitor of memory hunters offers trade.", "Охотники за памятью.", [d("hunterCaptain", "Сдай тотем!"), d("goro", "Тотем — мой якорь.")]),
        pg(8, "Axe carves own mark beside old name.", "Режет новую метку рядом.", [d("goro", "Два имени. Одно тело.")]),
        pg(9, "Lower gate opens.", "Ворота.", [d("herald", "На песок!")]),
        pg(10, "Steps on sand.", "Первый шаг на песок.", [d("goro", "Глава IV. Тотем ответил.")]),
      ]),
      ch("Клан старого знака", [
        pg(1, "Slums: krell gang hunts goro.", "Крелл и банда.", [d("krell", "Вернись!"), d("goro", "Вернусь с именем.")]),
        pg(2, "Chase on rooftops — axes cut nets.", "Крыши. Сети рвутся.", [d("goro", "Сети для слабых.")], "РВАНЬ!"),
        pg(3, "Skald captured as bait.", "Скальд в заложниках.", [d("skald", "Пой без меня!"), d("goro", "Пойду с тобой.")]),
        pg(4, "Rescue spin attack.", "Спасение вихрем.", [d("goro", "Круг — мой ответ.")], "ВЖУХ!"),
        pg(5, "Krell shows photo shard — child goro.", "Осколок: детское лицо.", [d("krell", "Это ты."), d("goro", "Лицо… почти.")]),
        pg(6, "Clan knows his past — won't tell free.", "Клан знает — молчит.", [d("braggi", "Плати кровью."), d("goro", "Плачу победой.")]),
        pg(7, "Totem ritual flash — almost remembers.", "Ритуал. Почти вспомнил.", [d("totemKeeper", "Ещё шаг.")]),
        pg(8, "Hunter captain joins krell.", "Капитан с Креллом.", [d("hunterCaptain", "Память — товар.")]),
        pg(9, "Map to memory vault under arena.", "Хранилище памяти под ареной.", [d("goro", "Там — имя.")]),
        pg(10, "Night eyes glow.", "Ночь. Глаза оранжевые.", [d("goro", "Глава V. Клан старого знака.")], "ШШШ…"),
      ]),
      ch("Ярость и пустота", [
        pg(1, "Cave shrine: empty mirror.", "Пещера. Пустое зеркало.", [d("goro", "Победа не отвечает, кем я был.")]),
        pg(2, "Flashback voice only — no face.", "Голос без лица.", [d("skald", "Голос памяти: стой!"), d("goro", "Стою. Не помню зачем.")]),
        pg(3, "Berserker super preview — speed and damage.", "Ярость берсерка.", [d("goro", "Пламя заполняет пустоту.")], "КРАК!"),
        pg(4, "Skald argues: name vs victory.", "Спор.", [d("skald", "Имя важнее победы?"), d("goro", "Победа — пока единственное имя.")]),
        pg(5, "Carves two notches on axe — rage and truth.", "Две насечки.", [d("goro", "Ярость. Правда.")]),
        pg(6, "Krell offer: memory restore if surrender.", "Предложение Крелла.", [d("krell", "Сдайся — вспомнишь."), d("goro", "Вспомню на песке.")]),
        pg(7, "Dream: axes forged by child hands.", "Сон: детские руки куют.", [d("braggi", "Голос кузни: это ты.")]),
        pg(8, "Tribunal trial by combat for memory vault.", "Трибунал: бой за хранилище.", [d("herald", "Победи — открой архив.")]),
        pg(9, "Walks to gate in calm rage.", "Спокойная ярость.", [d("goro", "Пустота — не слабость.")]),
        pg(10, "Northern wind at gate.", "Северный ветер.", [d("goro", "Глава VI. Ярость и пустота — союзники.")]),
      ]),
      ch("Ворота северного ветра", [
        pg(1, "Lower ring entry — crowd roars.", "Нижний круг.", [d("herald", "«Горный излом»!"), d("goro", "Излом — начало.")]),
        pg(2, "First foe: shield wall.", "Стена щитов.", [d("goro", "Два удара. Два щита. Ноль.")]),
        pg(3, "Spin breaks wall — signature.", "Вихрь ломает стену.", [d("goro", "Круг завершён.")], "ВЖУХ!"),
        pg(4, "Crowd chants unknown old name.", "Толпа скандирует старое имя.", [d("skald", "Они помнят!"), d("goro", "Я — почти.")]),
        pg(5, "Krell watches from VIP.", "Крелл в ложе.", [d("krell", "Ещё один бой — и сдашься.")]),
        pg(6, "Child fighter saved from tramplers.", "Спас ребёнка.", [d("goro", "Арена жрёт малых.")]),
        pg(7, "Night training rage control.", "Контроль ярости.", [d("braggi", "Голос: не стань пеплом."), d("goro", "Пепел — не цель.")]),
        pg(8, "Signs fight vs Memory Lord.", "Вызов «Лорду памяти».", [d("herald", "Крелл на песке!")]),
        pg(9, "Axes sharpened.", "Заточка.", [d("goro", "Сталь помнит руку.")]),
        pg(10, "Upper tier calls.", "Верхний ярус.", [d("goro", "Глава VII. Ветер с севера.")], "ШШШ…"),
      ]),
      ch("Берсерк на песке", [
        pg(1, "Mid ring: Krell in bone armor.", "Крелл на песке.", [d("krell", "Имя принадлежит клану!"), d("goro", "Имя — моё. Клан — нет.")]),
        pg(2, "Brutal exchange — shields useless.", "Обмен ударами.", [d("goro", "Щиты — ложь.")], "КЛАНГ!"),
        pg(3, "Berserker super — orange trail.", "Ярость берсерка на песке.", [d("goro", "ПЛАМЯ!")], "КРАК-БУМ!"),
        pg(4, "Memory shard flies from krell mask.", "Осколок памяти из маски.", [d("goro", "Лицо… моё?")]),
        pg(5, "Wins — spares krell.", "Победа без убийства.", [d("goro", "Живи. Расскажи правду.")]),
        pg(6, "Vault opens — name almost readable.", "Хранилище. Имя почти ясно.", [d("totemKeeper", "Ещё один бой.")]),
        pg(7, "Hunters mass.", "Окружение.", [d("hunterCaptain", "Память — наша!"), d("goro", "Память — моя работа.")]),
        pg(8, "Escape over net tower.", "Побег.", [d("goro", "Вверх — как с вершины.")], "ВЖУХ!"),
        pg(9, "Rain on upper walkway.", "Дождь.", [d("goro", "Имя в камне — близко.")]),
        pg(10, "Finale eve.", "Глава VIII.", [d("goro", "Берсерк на песке — не конец.")], "ДОЖДЬ…"),
      ]),
    ];
  },
  sora() {
    return [
      ch("Книга на балконе", [
        pg(1, "Palace observatory balcony at dusk, floating book.", "Дворцовая обсерватория. Книга парит у звёзд.", [d("archivistLune", "Сегодня — только разрешённые страницы, Сора."), d("sora", "Разрешённые — скучные.")]),
        pg(2, "Fire orb practice over city lights.", "Огненный шар над городом.", [d("starApprentice", "Учитель… это запретно?"), d("sora", "Запрет — приглашение.")]),
        pg(3, "Book whispers star rune.", "Книга шепчет звёздную руну.", [d("sora", "Формула дышит.")]),
        pg(4, "Observatory guard knocks — inspection.", "Страж стучит.", [d("observatoryGuard", "Двор приказал проверку!"), d("sora", "Звёзды не ждут приказов.")]),
        pg(5, "Hidden page glows — Arena map.", "Страница сама открыла карту Арены.", [d("sora", "Карта… живая.")]),
        pg(6, "Lune warns: inquisitors coming.", "Люн: инквизиторы идут.", [d("archivistLune", "Сожги страницу!"), d("sora", "Сожгу дом — не знание.")]),
        pg(7, "Meteor scorch on practice dome.", "Пробный метеор.", [d("sora", "Пять огней — урок.")], "БУМ!"),
        pg(8, "Exile edict arrives.", "Указ об изгнании.", [d("observatoryGuard", "Ты изгнан!"), d("sora", "Небо шире дворца.")]),
        pg(9, "Pack book; stars reflect in eyes.", "Книга в рюкзаке.", [d("starApprentice", "Я… останусь."), d("sora", "Останься живым.")]),
        pg(10, "Leaves balcony toward Arena glow.", "Уходит к куполу.", [d("sora", "Книга на балконе — глава I.")], "ШШШ…"),
      ]),
      ch("Пепел запретных рун", [
        pg(1, "Night raid: inquisitors burn archive.", "Инквизиторы жгут архив.", [d("inquisitorVex", "Руны — ересь!"), d("sora", "Ересь — слепота.")], "БУМ!"),
        pg(2, "Lune trapped under beam.", "Люн под балкой.", [d("archivistLune", "Беги!"), d("sora", "Книга — щит.")]),
        pg(3, "Fireball frees path.", "Огненный шар прочищает путь.", [d("sora", "Пепел — не конец.")], "ВЖУХ!"),
        pg(4, "Ash of forbidden rune on palm.", "Пепел руны на ладони.", [d("sora", "Знание ожогом — знакомо.")]),
        pg(5, "Vex marks him for Arena bounty.", "Векс объявляет награду.", [d("inquisitorVex", "На Арене сожгу публично.")]),
        pg(6, "Apprentice Eli guilt — leaked location.", "Эли предал место.", [d("starApprentice", "Я… боялся…"), d("sora", "Страх — не приговор.")]),
        pg(7, "Book page shows medical wing? No — star gate.", "Страница указывает ворота.", [d("sora", "Зов услышан.")]),
        pg(8, "Lune gives moon spectacles — see rifts.", "Лунные очки.", [d("archivistLune", "Видь разрывы.")]),
        pg(9, "Road to dome.", "Дорога.", [d("sora", "Изгнание — не смерть.")]),
        pg(10, "Meteor trail in sky.", "След метеора.", [d("sora", "Глава II. Пепел учит.")], "ШШШ…"),
      ]),
      ch("Пять огненных трещин", [
        pg(1, "Wasteland: five meteor scars in pentagon.", "Пять трещин — пентаграмма.", [d("sora", "Книга узнаёт землю.")]),
        pg(2, "Practice meteor rain — super preview.", "Метеоритный дождь.", [d("sora", "Пять огней!")], "КРАК-БУМ!"),
        pg(3, "Hunters flee scorched ring.", "Охотники бегут.", [d("hunterCaptain", "Это не маг — это катастрофа!")]),
        pg(4, "Rune in crater matches book page.", "Руна в кратере = страница.", [d("sora", "Карта пишет сама.")]),
        pg(5, "Vex scouts from ridge.", "Векс на гребне.", [d("inquisitorVex", "Ересьник!")]),
        pg(6, "Debate: knowledge burns or saves.", "Спор.", [d("starApprentice", "Ты сжёг лабораторию…"), d("sora", "Сжёг цепи.")]),
        pg(7, "Night reading — book opens Arena tier.", "Книга открывает ярус Арены.", [d("sora", "Страница зовёт.")]),
        pg(8, "Register alias Star Scribe.", "Псевдоним «Звёздный писец».", [d("herald", "Опасный маг?"), d("sora", "Опасный — слепой.")]),
        pg(9, "Gate near.", "Ворота.", [d("sora", "Пентаграмма завершена.")]),
        pg(10, "Fireball over shoulder.", "Шар за спиной.", [d("sora", "Глава III. Пять трещин — подпись.")], "ШШШ…"),
      ]),
      ch("Страница зовёт", [
        pg(1, "Arena archive: living page crawls on wall.", "Живая страница на стене.", [d("sora", "Ты звал?")]),
        pg(2, "Page shows star gate coordinates.", "Координаты звёздных ворот.", [d("archivistLune", "Голос письма: осторожно."), d("sora", "Осторожность — не страх.")]),
        pg(3, "Vex trap — nullify runes circle.", "Круг обнуления рун.", [d("inquisitorVex", "Без книги — ты никто!")]),
        pg(4, "Book eats nullify circle.", "Книга поглощает круг.", [d("sora", "Голод знания.")], "КРАК!"),
        pg(5, "Rescued scholars point to upper tier.", "Учёные указывают вверх.", [d("starApprentice", "Там Векс.")]),
        pg(6, "Meteor marks gate.", "Метеор на воротах.", [d("sora", "Приглашение принято.")]),
        pg(7, "Slum chase — fireballs vs nets.", "Погоня.", [d("sora", "Сети горят.")], "ВЖУХ!"),
        pg(8, "Lune letter: don't burn home.", "Письмо Люна.", [d("sora", "Дом — в страницах.")]),
        pg(9, "Lower sand visible.", "Песок.", [d("herald", "На круг!")]),
        pg(10, "Steps in.", "Входит.", [d("sora", "Глава IV. Страница — дверь.")]),
      ]),
      ch("Инквизиторы звёзд", [
        pg(1, "Market: rune hunters sell star shards.", "Охотники продают осколки.", [d("inquisitorVex", "Ересь на вес!"), d("sora", "Ересь — в ваших весах.")]),
        pg(2, "Free captive mage.", "Освобождение.", [d("sora", "Знание — не клетка.")]),
        pg(3, "Vex army enters slums.", "Армия Векса.", [d("inquisitorVex", "Сожги изгнанника!")], "БУМ!"),
        pg(4, "Meteor rain covers escape.", "Дождь метеоров — прикрытие.", [d("sora", "Пять огней — занавес.")], "КРАК-БУМ!"),
        pg(5, "Book gains new page from victory.", "Новая страница.", [d("sora", "Книга пишет сама.")]),
        pg(6, "Hunter captain alliance with Vex.", "Союз с капитаном.", [d("hunterCaptain", "Руны — товар.")]),
        pg(7, "Star apprentice redeems — helps.", "Эли помогает.", [d("starApprentice", "Исправлю.")]),
        pg(8, "Map to observatory under arena.", "Обсерватория под ареной.", [d("sora", "Звёзды под песком.")]),
        pg(9, "Prepares spells.", "Подготовка.", [d("sora", "Инквизиция — не небо.")]),
        pg(10, "Gate opens.", "Ворота.", [d("sora", "Глава V. Охота на звёзды.")], "ШШШ…"),
      ]),
      ch("Знание как пожар", [
        pg(1, "Burned library dream.", "Сон: сожжённая библиотека.", [d("archivistLune", "Голос: не сжигай."), d("sora", "Не сожгу — освещу.")]),
        pg(2, "Flashback exile — almost saved city.", "Изгнание: почти спас город.", [d("observatoryGuard", "Ты чуть не спас нас!"), d("sora", "Чуть — не значит нет.")]),
        pg(3, "Inner conflict: light path or burn.", "Знание — пожар или фонарь?", [d("sora", "Пожар без света — пепел.")]),
        pg(4, "Carves rune on book cover — oath.", "Клятва на обложке.", [d("sora", "Светить. Не жечь дом.")]),
        pg(5, "Vex offer: join inquisitors.", "Предложение Векса.", [d("inquisitorVex", "Стань судьёй ереси."), d("sora", "Суд — у звёзд.")]),
        pg(6, "Night meteor over child district — saved.", "Метеор спас район.", [d("sora", "Контроль — учусь.")]),
        pg(7, "Tribunal grants star gate trial.", "Трибунал: бой за ворота.", [d("herald", "Победи — открой небо.")]),
        pg(8, "Book whispers trio names.", "Книга шепчет троицу.", [d("sora", "Часы… бал… странно.")]),
        pg(9, "Walks to sand.", "К песку.", [d("sora", "Знание — мой щит.")]),
        pg(10, "Observatory dome under arena glows.", "Купол под ареной.", [d("sora", "Глава VI. Пожар под контролем.")]),
      ]),
      ch("Ворота небесного круга", [
        pg(1, "Lower ring: Sora vs rune nullifier.", "Нижний круг.", [d("herald", "«Звёздный писец»!"), d("sora", "Пишу победу.")]),
        pg(2, "Fireballs break nullifier rods.", "Шары ломают стержни.", [d("sora", "Нуль — пустота.")], "ВЖУХ!"),
        pg(3, "Crowd fears meteors.", "Толпа боится.", [d("starApprentice", "Контроль!")]),
        pg(4, "Controlled meteor on sand edge only.", "Метеор на краю.", [d("sora", "Пять огней — по кругу.")], "КРАК!"),
        pg(5, "Win declared.", "Победа.", [d("herald", "Проходит!")]),
        pg(6, "Vex backstage threat.", "Угроза.", [d("inquisitorVex", "Сожгу книгу!"), d("sora", "Книга — не бумага.")]),
        pg(7, "Heals fallen foe with warm light page.", "Страница тепла.", [d("sora", "Знание лечит.")]),
        pg(8, "Signs Vex duel.", "Вызов Векса.", [d("herald", "Финал!")]),
        pg(9, "Night study star gate.", "Ночь. Ворота.", [d("sora", "Небесный круг близко.")]),
        pg(10, "Upper tier stars align.", "Звёзды выстроились.", [d("sora", "Глава VII. Ворота дрожат.")], "ШШШ…"),
      ]),
      ch("Метеоры на песке", [
        pg(1, "Mid ring: Vex with star mask.", "Векс на песке.", [d("inquisitorVex", "Ересь сгорит!"), d("sora", "Ересь — ваш страх.")]),
        pg(2, "Nullify field — book counters.", "Поле обнуления.", [d("sora", "Страница — щит!")], "КРАК!"),
        pg(3, "Meteor rain finale on sand.", "Метеоритный дождь.", [d("sora", "Пять огней!")], "КРАК-БУМ!"),
        pg(4, "Vex mask cracks — court inquisitor.", "Под маской — дворцовый.", [d("sora", "Пешка. Двор прячется.")]),
        pg(5, "Star gate opens one breath.", "Ворота открылись на миг.", [d("archivistLune", "Голос: не входи слепо.")]),
        pg(6, "Tribunal upper access.", "Верхний ярус.", [d("herald", "Финал трио!")]),
        pg(7, "Hunters surround.", "Окружение.", [d("hunterCaptain", "Руны — наши!"), d("sora", "Руны — у тех, кто читает.")]),
        pg(8, "Escape on book flight.", "Полёт на книге.", [d("sora", "Страница — крыло.")], "ВЖУХ!"),
        pg(9, "Rain roof.", "Крыша.", [d("sora", "Бал близко.")]),
        pg(10, "Chapter VIII.", "Глава VIII.", [d("sora", "Метеоры на песке — пролог.")], "ДОЖДЬ…"),
      ]),
    ];
  },
  rin() {
    return [
      ch("Туман формулы", [
        pg(1, "Jungle dawn: toxic mist, glowing plants.", "Ядовитые джунгли. Туман формулы.", [d("elderShade", "Не касайся листа, Рин."), d("rin", "Лист касается меня.")]),
        pg(2, "Rin coats dagger with personal venom.", "Смазывает кинжал ядом.", [d("jungleGuide", "Формула — только твоя."), d("rin", "И только моя ответственность.")]),
        pg(3, "Silent leap between branches.", "Бесшумный прыжок.", [d("rin", "Шаг без звука — дом.")]),
        pg(4, "Thief Sai watches from vine.", "Сай на лиане.", [d("formulaThief", "Формула стоит целое королевство.")]),
        pg(5, "Rare plant pulses — arena dome reflected.", "Редкое растение отражает купол.", [d("elderShade", "Растёт только под аренским куполом."), d("rin", "Значит, иду под купол.")]),
        pg(6, "Bone collectors approach village.", "Сборщики в костяной броне.", [d("boneCollector", "Сдай формулу!")]),
        pg(7, "Poison dagger leaves glowing trail on fleeing foe.", "Светящийся след яда.", [d("rin", "Метка видна в тумане.")], "ВЖУХ!"),
        pg(8, "Elder gives vial — last seed of antidote.", "Флакон противоядия.", [d("elderShade", "Не для врагов — для ошибок.")]),
        pg(9, "Jungle burns far — arena call.", "Джунгли горят вдали.", [d("rin", "Формула не горит.")]),
        pg(10, "Leaves canopy toward dome.", "Уходит из кроны.", [d("rin", "Туман расступается.")], "ШШШ…"),
      ]),
      ch("Секрет в листе", [
        pg(1, "Raid: collectors burn formula grove.", "Сожжённая роща.", [d("boneCollector", "Без листа — без яда!")], "БУМ!"),
        pg(2, "Elder poisoned — rin injects partial cure.", "Старейшина отравлен.", [d("rin", "Держи дыхание.")], "ВЖУХ!"),
        pg(3, "Secret: formula in her blood.", "Секрет: формула в крови.", [d("elderShade", "Никто не должен знать…"), d("rin", "Знаю. Молчу.")]),
        pg(4, "Sai steals leaf copy — fake.", "Сай крадёт подделку.", [d("formulaThief", "Есть!"), d("rin", "Настоящее — во мне.")]),
        pg(5, "Chase through roots.", "Погоня.", [d("rin", "Ты взял пустоту.")], "WHOOSH!"),
        pg(6, "Guide Iv wounded.", "Ива ранена.", [d("jungleGuide", "Иди без меня."), d("rin", "Исчезнуть — не бросить.")]),
        pg(7, "Arena poster: rare plant prize.", "Приз — растение под куполом.", [d("rin", "Приз — мой ключ.")]),
        pg(8, "Poison cloud hides escape.", "Облако яда.", [d("rin", "Туман — союзник.")], "КРАК!"),
        pg(9, "Road to gates.", "Дорога.", [d("elderShade", "Голос: не стань ядом.")]),
        pg(10, "Eyes glow purple-green.", "Глаза светятся.", [d("rin", "Глава II. Секрет в листе — во мне.")], "ШШШ…"),
      ]),
      ch("Укус без звука", [
        pg(1, "Border ambush: collectors with nets.", "Засада с сетями.", [d("boneCollector", "Живая формула!")]),
        pg(2, "Silent kill — dagger poison glow on runner.", "Укус без звука. След светится.", [d("rin", "Беги — свети.")], "ВЖУХ!"),
        pg(3, "Signature: target poisoned mid-leap.", "Яд на бегущей цели.", [d("formulaThief", "Как?!")]),
        pg(4, "Sai offers sell formula to arena.", "Сай торгует с Ареной.", [d("formulaThief", "Цена — твоя кровь.")]),
        pg(5, "Rin takes antidote vial — won't use on enemies.", "Противоядие — для ошибок.", [d("rin", "Яд — не приговор.")]),
        pg(6, "Register alias Silent Bloom.", "Псевдоним «Безмолвный цветок».", [d("herald", "Убийца?"), d("rin", "Хранитель.")]),
        pg(7, "Rare plant scent leads to lower gate.", "Запах растения.", [d("jungleGuide", "Туда.")]),
        pg(8, "Night: poison cloud practice.", "Тренировка облака.", [d("rin", "Граница яда.")], "КРАК!"),
        pg(9, "Dome roots visible under sand.", "Корни под песком.", [d("rin", "Растение зовёт.")]),
        pg(10, "Dagger twirl.", "Кинжал.", [d("rin", "Глава III. Укус — подпись.")], "ШШШ…"),
      ]),
      ch("Цветок под куполом", [
        pg(1, "Arena greenhouse under dome: rare plant.", "Теплица под куполом.", [d("rin", "Цветок… жив.")]),
        pg(2, "Plant tied to formula — must not die.", "Растение связано с формулой.", [d("elderShade", "Голос: береги.")]),
        pg(3, "Sai tries steal plant.", "Сай крадёт.", [d("formulaThief", "Моё!"), d("rin", "Чужое.")], "ВЖУХ!"),
        pg(4, "Guards with bone armor.", "Стража.", [d("boneCollector", "Сдайся!")]),
        pg(5, "Poison cloud secures plant.", "Облако прикрывает цветок.", [d("rin", "Дыши меньше.")], "КРАК!"),
        pg(6, "Herald announces bloom trial fight.", "Бой за цветок.", [d("herald", "Победитель — доступ.")]),
        pg(7, "Iv brings elder message: stay.", "Сообщение: остаться.", [d("jungleGuide", "Они хотят, чтобы ты исчезла."), d("rin", "Исчезнуть легко. Остаться — долг.")]),
        pg(8, "Map venom vault.", "Хранилище ядов.", [d("rin", "Там Сай.")]),
        pg(9, "Gate to sand.", "Песок.", [d("rin", "Купол — крыша сада.")]),
        pg(10, "Plant petal in hair.", "Лепесток в волосах.", [d("rin", "Глава IV. Цветок под куполом.")]),
      ]),
      ch("Сборщики костяной брони", [
        pg(1, "Slum hunt: bone collectors sell poisons.", "Рынок ядов.", [d("boneCollector", "Свежие токсины!"), d("rin", "Свежесть — не оправдание.")]),
        pg(2, "Frees captive alchemists.", "Освобождение.", [d("rin", "Формулы — не цепи.")]),
        pg(3, "Sai alliance with collectors.", "Союз Сая.", [d("formulaThief", "Кровь Рин — ключ!")]),
        pg(4, "Trap net — cloud escape.", "Сеть. Облако.", [d("rin", "Яд режет верёвки.")], "РВАНЬ!"),
        pg(5, "Child poisoned by stolen vial.", "Ребёнок отравлен.", [d("rin", "Противоядие — сейчас!")], "ВЖУХ!"),
        pg(6, "Sai offers cure for formula.", "Сделка.", [d("formulaThief", "Формула за жизнь."), d("rin", "Жизнь — не товар.")]),
        pg(7, "Hunter captain joins.", "Капитан.", [d("hunterCaptain", "Яд — оружие Арены!")]),
        pg(8, "Plan: venom vault heist.", "План.", [d("jungleGuide", "Опасно."), d("rin", "Опаснее молчать.")]),
        pg(9, "Night blades sharpen.", "Ночь.", [d("rin", "Костяная броня — хрупкая.")]),
        pg(10, "Lower gate.", "Ворота.", [d("rin", "Глава V. Охота на сборщиков.")], "ШШШ…"),
      ]),
      ch("Исчезнуть или остаться", [
        pg(1, "Shrine root: choice altar.", "Алтарь выбора.", [d("elderShade", "Исчезни — живи."), d("rin", "Жить — не прятаться.")]),
        pg(2, "Flashback: left jungle once — returned.", "Уходила — вернулась.", [d("jungleGuide", "Ты осталась тогда."), d("rin", "Останусь сейчас.")]),
        pg(3, "Inner conflict: vanish easy, stay hard.", "Исчезнуть легко. Остаться труднее.", [d("rin", "Трудное — правильное.")]),
        pg(4, "Writes formula not on paper — on leaf only.", "Формула только на листе, не на бумаге.", [d("rin", "Кровь — не чернила для продажи.")]),
        pg(5, "Sai capture attempt — fails.", "Попытка похищения.", [d("formulaThief", "Кровь!"), d("rin", "Не сегодня.")], "ВЖУХ!"),
        pg(6, "Debate Iv: revenge vs cure.", "Спор.", [d("jungleGuide", "Отравь их всех!"), d("rin", "Яд — не судья.")]),
        pg(7, "Tribunal: fight for formula rights.", "Трибунал.", [d("herald", "Победи — владей формулой.")]),
        pg(8, "Antidote vial half empty.", "Флакон наполовину пуст.", [d("rin", "Ошибки ещё будут.")]),
        pg(9, "Walks to sand visible.", "К песку.", [d("rin", "Остаюсь.")]),
        pg(10, "Green mist at gate.", "Туман у ворот.", [d("rin", "Глава VI. Выбор сделан.")]),
      ]),
      ch("Ворота зелёного яруса", [
        pg(1, "Lower ring: rin vs toxin gladiator.", "Нижний круг.", [d("herald", "«Безмолвный цветок»!"), d("rin", "Цветёт без звука.")]),
        pg(2, "Dagger poison stacks.", "Яд накладывается.", [d("rin", "Счёт идёт.")], "ВЖУХ!"),
        pg(3, "Cloud super preview.", "Облако яда.", [d("rin", "Дыши осторожно.")], "КРАК!"),
        pg(4, "Win — crowd uneasy.", "Победа.", [d("boneCollector", "Монстр!"), d("rin", "Хранитель.")]),
        pg(5, "Sai backstage deal.", "Сделка.", [d("formulaThief", "Кровь за жизнь!"), d("rin", "Жизнь не торг.")]),
        pg(6, "Heals poisoned slave fighter.", "Лечит раба.", [d("rin", "Противоядие — для ошибок.")]),
        pg(7, "Night silent drills.", "Ночь.", [d("elderShade", "Голос: не исчезай в ненависти.")]),
        pg(8, "Signs Sai duel.", "Вызов Сая.", [d("herald", "Финал яда!")]),
        pg(9, "Plant petal glows.", "Лепесток.", [d("rin", "Цветок жив.")]),
        pg(10, "Upper tier.", "Верх.", [d("rin", "Глава VII. Зелёный ярус.")], "ШШШ…"),
      ]),
      ch("Яд на песке", [
        pg(1, "Mid ring: Sai with stolen vials.", "Сай на песке.", [d("formulaThief", "Формула — моя!"), d("rin", "Формула — живая.")]),
        pg(2, "Cloud vs vial storm.", "Буря флаконов.", [d("rin", "Облако!")], "КРАК-БУМ!"),
        pg(3, "Dagger disarms — poison glow trail.", "След яда.", [d("formulaThief", "Горит!")], "ВЖУХ!"),
        pg(4, "Sai falls — antidote offered.", "Противоядие врагу.", [d("rin", "Живи. Расскажи.")]),
        pg(5, "Vault opens — plant safe.", "Растение цело.", [d("elderShade", "Голос: молодец.")]),
        pg(6, "Tribunal upper gate.", "Верхний ярус.", [d("herald", "Трио прилив!")]),
        pg(7, "Collectors surround.", "Окружение.", [d("boneCollector", "Яд — наш!"), d("rin", "Яд — ответственность.")]),
        pg(8, "Rooftop escape cloud.", "Побег.", [d("rin", "Туман — дорога.")], "ВЖУХ!"),
        pg(9, "Rain.", "Дождь.", [d("rin", "Прилив близко.")]),
        pg(10, "Chapter VIII.", "Глава VIII.", [d("rin", "Яд на песке — урок.")], "ДОЖДЬ…"),
      ]),
    ];
  },
  taro() {
    return [
      ch("Ключ в шесть лет", [
        pg(1, "Flashback wide: workshop, six-year-old Taro with wrench.", "Мастерская. Шесть лет. Первый ключ.", [d("youngTaro", "Он греется!"), d("taro", "Голос памяти: греется — значит, живёт.")]),
        pg(2, "Present old Taro tunes turret prototype.", "Старик настраивает турель.", [d("workshopApprentice", "Мастер, это опасно!"), d("taro", "Опасное — интересное.")]),
        pg(3, "Wrench spark attack on scrap armor.", "Искры с ключа.", [d("taro", "Ключ режет металл мягче меча.")], "ВЖУХ!"),
        pg(4, "Broker Os offers buy patents.", "Брокер Ос.", [d("munitionsBroker", "Золото за чертежи!"), d("taro", "Идеи не продаются.")]),
        pg(5, "Stolen turret design on black market.", "Украденный чертёж на рынке.", [d("patentThief", "Уже копируют!"), d("taro", "Копии — без души.")]),
        pg(6, "Arena poster: turret prize display.", "Приз — чертёж на витрине Арены.", [d("taro", "Мой чертёж… как трофей.")]),
        pg(7, "Sets mini turret at door.", "Турель у порога.", [d("taro", "Гость вежливый — живёт.")]),
        pg(8, "Laugh echoes — old man's joy.", "Смех старика.", [d("workshopApprentice", "Вы смеётесь в войну?"), d("taro", "Смеюсь, чтобы не ржаветь.")]),
        pg(9, "Dome glow through roof hole.", "Купол через дыру в крыше.", [d("taro", "Витрина зовёт.")]),
        pg(10, "Walks with wrench and blueprint tube.", "Уходит с чертежами.", [d("taro", "Ключ в шесть лет — глава I.")], "ШШШ…"),
      ]),
      ch("Украденный чертёж", [
        pg(1, "Raid: Giz steals master blueprint.", "Гиз крадёт мастер-чертёж.", [d("patentThief", "Моё!"), d("taro", "Твоё — без меня.")], "БУМ!"),
        pg(2, "Turret auto-fires — misses thief.", "Турель стреляет.", [d("taro", "Старая. Нужен прицел.")]),
        pg(3, "Flashback: first walker at six.", "Шагоход в шесть лет.", [d("youngTaro", "Он шагает!"), d("taro", "Шаг — начало.")]),
        pg(4, "Broker funds hunters.", "Ос платит охотникам.", [d("munitionsBroker", "Патенты — валюта!")]),
        pg(5, "Pem injured defending workshop.", "Пем ранен.", [d("workshopApprentice", "Мастер…"), d("taro", "Держи. Ключ лечит металл, не плоть.")]),
        pg(6, "Wrench duel with thief agent.", "Дуэль ключом.", [d("taro", "Латунь помнит руку.")], "КЛАНГ!"),
        pg(7, "Copy blueprint left — original gone.", "Подделка осталась.", [d("taro", "Настоящее — в голове.")]),
        pg(8, "Arena invite in stolen tube.", "Приглашение в тубусе.", [d("herald", "Голос афиши: приз ждёт.")]),
        pg(9, "Pack tools.", "Инструменты.", [d("taro", "Украденный — верну.")]),
        pg(10, "Road to dome.", "Дорога.", [d("taro", "Глава II. Чертёж зовёт.")], "ШШШ…"),
      ]),
      ch("Турель у порога", [
        pg(1, "Bridge choke: deploy turret.", "Турель у порога моста.", [d("taro", "Добро пожаловать. Не стреляй.")]),
        pg(2, "Hunters charge — turret holds hours.", "Турель держит часами.", [d("hunterCaptain", "Сломайте!"), d("taro", "Латунь терпелива.")], "БРРР!"),
        pg(3, "Wrench repairs mid-fight.", "Ремонт в бою.", [d("taro", "Ключ — лучший друг.")]),
        pg(4, "Giz copies fail explode.", "Копии взрываются.", [d("patentThief", "Почему?!"), d("taro", "Без души — без стабильности.")]),
        pg(5, "Register alias Iron Gardener.", "Псевдоним «Железный садовник».", [d("herald", "Старик на песке?"), d("taro", "Старик — не слабый.")]),
        pg(6, "Broker offer join arena R&D.", "Предложение Ос.", [d("munitionsBroker", "Богатство!"), d("taro", "Богатство не чинит.")]),
        pg(7, "Night: builds second turret.", "Вторая турель.", [d("workshopApprentice", "Нужен сон!"), d("taro", "Сон — после победы.")]),
        pg(8, "Prize display seen through gate.", "Витрина приза.", [d("taro", "Чертёж смотрит на меня.")]),
        pg(9, "Gate queue.", "Очередь.", [d("taro", "Турель — визитка.")]),
        pg(10, "Enters.", "Вход.", [d("taro", "Глава III. Порог пройден.")], "ШШШ…"),
      ]),
      ch("Приз на витрине", [
        pg(1, "Arena showroom: stolen blueprint in glass.", "Витрина с чертежом.", [d("taro", "Моя подпись… кривая копия.")]),
        pg(2, "Clerk says legal — forged transfer.", "Подделанный перевод прав.", [d("munitionsBroker", "Законно!"), d("taro", "Закон без совести — сломан.")]),
        pg(3, "Wrench taps glass — crack pattern.", "Трещина на стекле.", [d("taro", "Стекло — как их совесть.")]),
        pg(4, "Giz appears — mock bow.", "Гиз кланяется.", [d("patentThief", "Спасибо за идеи!")]),
        pg(5, "Turret deploy in hall — controlled.", "Турель в зале.", [d("taro", "Демонстрация.")], "БРРР!"),
        pg(6, "Crowd loves old engineer.", "Толпа за старика.", [d("workshopApprentice", "Они смеются с вами!")]),
        pg(7, "Hunter captain seizes display.", "Капитан охраняет витрину.", [d("hunterCaptain", "Приз — наш!")]),
        pg(8, "Plan heist during fight night.", "План.", [d("taro", "Верню на песке.")]),
        pg(9, "Sand below.", "Песок.", [d("herald", "Бой!")]),
        pg(10, "Wrench ready.", "Ключ.", [d("taro", "Глава IV. Витрина — вызов.")]),
      ]),
      ch("Охотники за патентами", [
        pg(1, "Slum: patent hunters auction copies.", "Аукцион копий.", [d("patentThief", "Лоты!"), d("taro", "Подделки горят.")]),
        pg(2, "Frees captive inventors.", "Освобождает изобретателей.", [d("taro", "Идеи — не цепи.")]),
        pg(3, "Giz and Os alliance.", "Союз Гиза и Оса.", [d("munitionsBroker", "Рынок решит!")]),
        pg(4, "Dual turret crossfire alley.", "Две турели.", [d("taro", "Перекрёстный огонь чести.")], "БРРР!"),
        pg(5, "Pem builds signal beacon.", "Маяк.", [d("workshopApprentice", "Сигнал Кендзи?"), d("taro", "Искра найдёт друга.")]),
        pg(6, "Hunter nets on turrets.", "Сети.", [d("hunterCaptain", "Сломайте машины!"), d("taro", "Машины — не я.")]),
        pg(7, "Wrench cuts net motors.", "Режет моторы сетей.", [d("taro", "Ключ — хирург.")], "ВЖУХ!"),
        pg(8, "Map patent vault under arena.", "Хранилище патентов.", [d("taro", "Там оригинал.")]),
        pg(9, "Night oil and brass.", "Ночь. Масло.", [d("taro", "Старею — не ржавею.")]),
        pg(10, "Gate.", "Ворота.", [d("taro", "Глава V. Охота на охотников.")], "ШШШ…"),
      ]),
      ch("Смех старика", [
        pg(1, "Bench shrine: fear uselessness.", "Страх бесполезности.", [d("taro", "Старик боится не смерти — пустоты.")]),
        pg(2, "Flashback six: walker saves town.", "Шагоход спас город.", [d("youngTaro", "Он смешной и сильный!"), d("taro", "Смех — не слабость.")]),
        pg(3, "Inner conflict: retire or prove.", "Уйти или доказать?", [d("taro", "Докажу на песке.")]),
        pg(4, "Carves notch on wrench — oath.", "Насечка на ключе.", [d("taro", "Чинить мир.")]),
        pg(5, "Os offer youth serum for patents.", "Сыворотка молодости.", [d("munitionsBroker", "Вечность!"), d("taro", "Вечность без пользы — ржавчина.")]),
        pg(6, "Laugh on rooftop — trio signal seen.", "Смех. Сигнал троицы.", [d("taro", "Искры и жуки — друзья.")]),
        pg(7, "Tribunal: fight for patent vault.", "Трибунал.", [d("herald", "Победи — верни имя чертежа.")]),
        pg(8, "Pem: you're not useless.", "Пем.", [d("workshopApprentice", "Вы нужны.")]),
        pg(9, "Walks with turret cart.", "Тележка турелей.", [d("taro", "Смех — топливо.")]),
        pg(10, "Gate opens.", "Ворота.", [d("taro", "Глава VI. Смех громче страха.")]),
      ]),
      ch("Ворота мастерской", [
        pg(1, "Lower ring: Taro vs walker copy.", "Копия шагохода.", [d("herald", "«Железный садовник»!"), d("taro", "Подделка против оригинала.")]),
        pg(2, "Turret line holds lane.", "Линия турелей.", [d("taro", "Держать — моя специальность.")], "БРРР!"),
        pg(3, "Wrench smashes copy knee.", "Ключ ломает сустав.", [d("taro", "Без души — без колен.")], "КЛАНГ!"),
        pg(4, "Crowd chants old legend.", "Легенда.", [d("workshopApprentice", "Они знают вас!")]),
        pg(5, "Giz VIP booth.", "Гиз в ложе.", [d("patentThief", "Ещё один чертёж!")]),
        pg(6, "Fixes child toy mech between rounds.", "Чинит игрушку ребёнку.", [d("taro", "Арена жрёт. Я чиню.")]),
        pg(7, "Night upgrade turrets.", "Апгрейд.", [d("taro", "Старик учится быстрее молодых.")]),
        pg(8, "Signs Giz duel.", "Вызов Гиза.", [d("herald", "Финал патентов!")]),
        pg(9, "Brass gleam.", "Латунь.", [d("taro", "Мастерская — в кармане.")]),
        pg(10, "Upper tier.", "Верх.", [d("taro", "Глава VII. Ворота открыты.")], "ШШШ…"),
      ]),
      ch("Латунь на песке", [
        pg(1, "Mid ring: Giz in powered exo.", "Гиз в экзоскелете.", [d("patentThief", "Молодость и сила!"), d("taro", "Сила без смеха — пустая.")]),
        pg(2, "Turret wall vs missiles.", "Стена турелей.", [d("taro", "Держать!")], "БРРР-БУМ!"),
        pg(3, "Wrench overload exo joint.", "Перегруз сустава.", [d("taro", "Латунь знает слабость.")], "КРАК!"),
        pg(4, "Original blueprint falls from exo.", "Оригинал выпал.", [d("taro", "Оригинал снова в моих руках.")]),
        pg(5, "Spares Giz — laugh.", "Щадит. Смеётся.", [d("taro", "Живи. Изобретай сам.")]),
        pg(6, "Vault opens — workshop patent restored.", "Патент восстановлен.", [d("herald", "Закон признал!")]),
        pg(7, "Hunters seize — riot.", "Бунт.", [d("hunterCaptain", "Патенты — наш бизнес!"), d("taro", "Бизнес — не сердце.")]),
        pg(8, "Rooftop turret escape.", "Побег.", [d("taro", "Старик бегает быстро.")], "ВЖУХ!"),
        pg(9, "Rain on brass.", "Дождь на латуни.", [d("taro", "Рой близко.")]),
        pg(10, "Chapter VIII.", "Глава VIII.", [d("taro", "Латунь на песке — звон победы.")], "ДОЖДЬ…"),
      ]),
    ];
  },
};

function assemble(b) {
  const ch18 = buildChapters18(b);
  if (ch18.length !== 8) throw new Error(`${b.id}: expected 8 chapters, got ${ch18.length}`);
  const all = [...ch18, b.ch9(), b.ch10()];
  return Object.fromEntries(all.map((c, i) => [String(i + 1), c]));
}

function writeBuildScript(b) {
  const chapters = assemble(b);
  const body = `import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = ${JSON.stringify(b.npcs, null, 2)};
const chapters = ${JSON.stringify(chapters, null, 2)};
const script = {
  brawlerId: ${JSON.stringify(b.id)},
  brawlerName: ${JSON.stringify(b.name)},
  lore: ${JSON.stringify(b.lore)},
  skinRef: ${JSON.stringify(b.skinRef)},
  trioId: ${JSON.stringify(b.trioId)},
  trioOthers: ${JSON.stringify(b.trioOthers)},
  rules: ${JSON.stringify(RULES, null, 2)},
  npcs,
  cover: { prompt: ${JSON.stringify(b.cover)} },
  chapters,
};
const outPath = path.join(__dirname, "${b.id}-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
`;
  const out = path.join(__dirname, `build-${b.id}-script-v2.mjs`);
  fs.writeFileSync(out, body, "utf8");
  return out;
}

for (const id of TARGET_IDS) {
  const b = BRAWLERS[id];
  if (!b) throw new Error(`Missing brawler config: ${id}`);
  const p = writeBuildScript(b);
  console.log("Generated", p);
  const run = spawnSync(process.execPath, [p], { cwd: __dirname, encoding: "utf8" });
  if (run.status !== 0) {
    console.error(run.stderr || run.stdout);
    process.exit(1);
  }
  console.log(run.stdout.trim());
}
