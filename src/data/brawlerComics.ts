import { BRAWLERS, BRAWLER_LORE, type BrawlerStats } from "../entities/BrawlerData";

export const COMIC_CHAPTER_COUNT = 10;
export const COMIC_PAGES_PER_CHAPTER = 10;

export interface BrawlerComicTrio {
  id: string;
  name: string;
  memberIds: [string, string, string];
  theme: string;
}

export interface BrawlerComicPage {
  page: number;
  assetPath: string;
  caption: string;
  storyBeat: string;
  imagePrompt: string;
  negativePrompt: string;
  speechText: string[];
  styleGuide: string;
  continuityNotes: string;
  reviewChecklist: string[];
}

export interface BrawlerComicChapter {
  chapter: number;
  title: string;
  unlockRank: number;
  summary: string;
  pages: BrawlerComicPage[];
}

export interface BrawlerComic {
  brawlerId: string;
  title: string;
  subtitle: string;
  coverAssetPath: string;
  coverPrompt: string;
  palette: {
    primary: string;
    secondary: string;
    accent: string;
  };
  trioId: string;
  chapters: BrawlerComicChapter[];
}

export interface BrawlerComicPromptManifestEntry {
  brawlerId: string;
  brawlerName: string;
  chapter: number;
  chapterTitle: string;
  page: number;
  assetPath: string;
  imagePrompt: string;
  negativePrompt: string;
  speechText: string[];
  styleGuide: string;
  continuityNotes: string;
  reviewChecklist: string[];
}

export interface BrawlerComicPromptManifest {
  version: 1;
  generatedFor: "brawler-comic-image-batches";
  imageCount: number;
  coverImages: Array<{
    brawlerId: string;
    brawlerName: string;
    assetPath: string;
    imagePrompt: string;
    negativePrompt: string;
    styleGuide: string;
    reviewChecklist: string[];
  }>;
  pages: BrawlerComicPromptManifestEntry[];
}

export const COMIC_STYLE_GUIDE = [
  "Full color dynamic action comic page, western superhero pacing mixed with rubber-hose cartoon action energy.",
  "Multi-panel layout with clear gutters, readable silhouettes, cinematic lighting, speed lines, impact shapes, bold hand-lettered sound effects.",
  "Original arena-brawler characters only; do not copy or reference existing copyrighted characters, logos, costumes, or exact poses.",
  "Speech balloons and sound effects should be drawn inside the image when listed in speechText; the UI will not overlay dialogue.",
].join(" ");

export const COMIC_NEGATIVE_PROMPT = [
  "copyrighted characters",
  "existing franchise costumes",
  "photorealistic rendering",
  "single gradient background",
  "blank placeholder art",
  "unreadable character silhouettes",
  "watermark",
  "artist signature",
  "UI overlay text outside the comic panels",
].join(", ");

const COMIC_REVIEW_CHECKLIST = [
  "Looks like a finished color comic page, not a prompt card or gradient placeholder.",
  "Uses multiple panels or a strong comic-page composition with gutters, action lines, and effects.",
  "Main brawler, palette, motifs, and chapter beat are recognizable.",
  "Speech balloons and SFX are legible inside the artwork when requested.",
  "No copied copyrighted characters, logos, watermarks, or external UI captions.",
];

export const BRAWLER_COMIC_TRIOS: BrawlerComicTrio[] = [
  {
    id: "oathbound-frontline",
    name: "Клятва передовой",
    memberIds: ["hana", "ronin", "goro"],
    theme: "милосердие, честь и ярость держат одну линию обороны",
  },
  {
    id: "starbound-scholars",
    name: "Звёздные ученики",
    memberIds: ["yuki", "mirabel", "elian"],
    theme: "храм, библиотека и космос ищут потерянные имена",
  },
  {
    id: "forge-swarm",
    name: "Мастерская роя",
    memberIds: ["kenji", "taro", "oliver"],
    theme: "опасные изобретения становятся защитой, когда у них есть сердце",
  },
  {
    id: "venom-tide",
    name: "Ядовитый прилив",
    memberIds: ["callista", "rin", "octavia"],
    theme: "яд, алхимия и мутировавшая вода ищут лекарство вместо мести",
  },
  {
    id: "storm-moon",
    name: "Буря кровавой луны",
    memberIds: ["airin", "zephyrin", "vittoria"],
    theme: "дым, ветер и проклятая луна дают беглецам второй шанс",
  },
  {
    id: "shadow-grove",
    name: "Тень живого леса",
    memberIds: ["miya", "silven", "lumina"],
    theme: "тень, корни и свет спорят о цене правосудия",
  },
  {
    id: "eternal-ball",
    name: "Бал вечности",
    memberIds: ["zafkiel", "verdeletta", "sora"],
    theme: "время, адский праздник и запретные руны сходятся у ворот Арены",
  },
];

interface ComicSeed {
  motif: string;
  home: string;
  wound: string;
  arenaCall: string;
  rivalForce: string;
  signatureScene: string;
  innerConflict: string;
}

const COMIC_SEEDS: Record<string, ComicSeed> = {
  miya: {
    motif: "фиолетовые тени, сюрикены и разрывы реальности",
    home: "скрытая деревня теневых клинков",
    wound: "пепел уничтоженного клана",
    arenaCall: "разлом, в котором убийца брата оставил знак Арены",
    rivalForce: "охотники в масках без лиц",
    signatureScene: "телепорт за спину врагу среди дождя сюрикенов",
    innerConflict: "месть зовёт громче, чем справедливость",
  },
  ronin: {
    motif: "красные доспехи, золото клана и каменная катана",
    home: "императорский гарнизон",
    wound: "предательство лордов, которым он служил",
    arenaCall: "письмо с печатью турнира, найденное на сломанном щите",
    rivalForce: "отряд бывших вассалов",
    signatureScene: "щит принимает залп, а катана режет землю столбом",
    innerConflict: "честь требует стоять, даже когда доверять некому",
  },
  yuki: {
    motif: "синие кимоно, снежные вихри и лечебный лёд",
    home: "горный храм целителей",
    wound: "исчезновение брата на турнире",
    arenaCall: "ледяной колокольчик брата, звенящий только в сторону Арены",
    rivalForce: "похитители в масках инея",
    signatureScene: "снежное облако лечит союзников под обвалом",
    innerConflict: "ей приходится замораживать тех, кого она мечтала спасать",
  },
  kenji: {
    motif: "жёлтые плащи, искры, катушки и живая молния",
    home: "университет опасных механизмов",
    wound: "изгнание за эксперимент, который почти спас город",
    arenaCall: "контракт на испытание клетки молний перед всем миром",
    rivalForce: "совет профессоров и их охранные дроны",
    signatureScene: "цепная молния прыгает между врагами как хищник",
    innerConflict: "доказать правоту не значит потерять совесть",
  },
  hana: {
    motif: "розовый госпиталь, лечебные пули и цветущий сад",
    home: "Розовый госпиталь на линии фронта",
    wound: "безнадёжный пациент, которого она отказалась бросить",
    arenaCall: "сигнал бедствия из медицинского крыла Арены",
    rivalForce: "наёмники, продающие раненых как трофеи",
    signatureScene: "пули лечат союзников и пробивают броню врагов",
    innerConflict: "добро должно быть достаточно сильным, чтобы ударить первым",
  },
  goro: {
    motif: "северные скалы, двойные топоры и огненная ярость",
    home: "северные вершины без карт",
    wound: "провал в памяти, где спрятано детство",
    arenaCall: "тотем с его старым именем в списке бойцов",
    rivalForce: "клан, который знает его прошлое",
    signatureScene: "топоры вращаются в центре вражеской толпы",
    innerConflict: "победа не отвечает на вопрос, кем он был",
  },
  sora: {
    motif: "синяя мантия, летающая книга и метеоритный дождь",
    home: "дворцовая обсерватория",
    wound: "изгнание за запретные звёздные руны",
    arenaCall: "страница книги, сама открывшая карту Арены",
    rivalForce: "звёздные инквизиторы",
    signatureScene: "пять метеоров падают вокруг раскрытой книги",
    innerConflict: "знание может осветить путь или сжечь дом",
  },
  rin: {
    motif: "зелёные джунгли, ядовитые кинжалы и бесшумный прыжок",
    home: "ядовитые джунгли",
    wound: "секрет формулы, за которым охотятся все кланы",
    arenaCall: "редкое растение, растущее только под аренским куполом",
    rivalForce: "сборщики ядов в броне из костей",
    signatureScene: "кинжал оставляет светящийся яд на бегущей цели",
    innerConflict: "исчезнуть легко, остаться рядом труднее",
  },
  taro: {
    motif: "старый ключ, турели, латунь и упрямый смех",
    home: "мастерская под железной крышей",
    wound: "изобретения, которые украли и превратили в оружие",
    arenaCall: "чертёж турели, выставленный как приз турнира",
    rivalForce: "воры патентов на шагоходах",
    signatureScene: "турель держит проход, пока ключ бьёт искрами",
    innerConflict: "старик боится не смерти, а бесполезности",
  },
  zafkiel: {
    motif: "песочные часы, фиолетовые врата и золотые циферблаты",
    home: "орден Хроностражей",
    wound: "последний пост после падения ордена",
    arenaCall: "аномалия, где прошлое Арены пожирает будущее",
    rivalForce: "разломы времени и гости теневого бала",
    signatureScene: "Врата Вечности откатывают целую атаку назад",
    innerConflict: "если всё предрешено, зачем он всё ещё выбирает",
  },
  verdeletta: {
    motif: "зелёный адский свет, тени-гости и праздничный пистолет",
    home: "главный зал преисподней",
    wound: "протокол праздника, который она однажды нарушила",
    arenaCall: "приглашение на турнир, подписанное её собственной тенью",
    rivalForce: "демоны-распорядители, требующие вернуть порядок",
    signatureScene: "теневой бал раскрывается прямо на поле боя",
    innerConflict: "хаос веселит её, пока не начинает выбирать гостей сам",
  },
  lumina: {
    motif: "золотые нити, белые крылья и светлая клетка",
    home: "земная часовня у обрыва",
    wound: "память о небесах, которую она не может вернуть",
    arenaCall: "душа, застрявшая в сияющей клетке Арены",
    rivalForce: "охотники за падшим светом",
    signatureScene: "золотые нити связывают врагов без смертельного удара",
    innerConflict: "милосердие кажется слабостью только тем, кто боится света",
  },
  oliver: {
    motif: "бронзовые жуки, круглые очки и синий репликатор",
    home: "маленькая мастерская семьи механиков",
    wound: "брат, чья память живёт в жуке-машине",
    arenaCall: "супер, который может вернуть фрагмент голоса брата",
    rivalForce: "коллекционеры боевых механизмов",
    signatureScene: "рой жуков складывается в щит вокруг мальчика",
    innerConflict: "копировать чужой дар проще, чем принять свой",
  },
  callista: {
    motif: "зелёные волосы, цветные линзы и взрывные колбы",
    home: "лаборатория лекарств невозможного действия",
    wound: "взрыв, превративший лекарство в угрозу",
    arenaCall: "реактив Арены, способный стабилизировать её формулу",
    rivalForce: "санитары-цензоры алхимической гильдии",
    signatureScene: "одна колба вспыхивает кислотой, льдом, ядом и лечением",
    innerConflict: "риск ради науки не должен становиться риском ради гордости",
  },
  elian: {
    motif: "звёздное пальто, голубые заряды и гравитационная воронка",
    home: "город под картой созвездий",
    wound: "звезда, упавшая туда, где он дал обещание",
    arenaCall: "аномалия, повторяющая форму его потерянного созвездия",
    rivalForce: "пожиратели орбит",
    signatureScene: "воронка стягивает врагов под голубой взрыв",
    innerConflict: "чем дальше летит заряд, тем тяжелее вина",
  },
  airin: {
    motif: "стимпанк-очки, дымовые капсулы и серебряная эвакуация",
    home: "королевский аэродром в дымных доках",
    wound: "предательство эскадрильи в ловушке",
    arenaCall: "сигнал маяка старого самолёта внутри Арены",
    rivalForce: "дымовые асы-предатели",
    signatureScene: "эвакуационный знак переносит союзников сквозь огонь",
    innerConflict: "она спасает даже тех, кто однажды бросил её",
  },
  silven: {
    motif: "живые корни, древний дуб и зелёные лозы",
    home: "лес, выжженный людьми",
    wound: "сердце, отданное древнему дубу",
    arenaCall: "семя жизни, которое проросло под камнем Арены",
    rivalForce: "лесорубы с огненными пилами",
    signatureScene: "древо жизни растёт посреди боя",
    innerConflict: "лес просит защиты, но не просит ненависти",
  },
  vittoria: {
    motif: "шипованный кастет, вампирский бархат и кровавая луна",
    home: "разрушенное поместье вампирского рода",
    wound: "брат, закрывший её от охотников",
    arenaCall: "луна над Ареной повторяет ночь гибели семьи",
    rivalForce: "охотники с серебряными гарпунами",
    signatureScene: "кастет вспыхивает под багровой луной",
    innerConflict: "она хочет лечить, но проклятие требует крови",
  },
  octavia: {
    motif: "розовые щупальца, чернила и отравленное подземное озеро",
    home: "подземное озеро",
    wound: "мутация после чужих экспериментов",
    arenaCall: "источник чистой воды под аренским фундаментом",
    rivalForce: "алхимики, отравившие её дом",
    signatureScene: "чернильная завеса скрывает союзников от прицелов",
    innerConflict: "чудовище в зеркале всё ещё ищет чудо",
  },
  zephyrin: {
    motif: "полупрозрачное платье, торнадо и серебряный воздух",
    home: "невидимые верхние ветра",
    wound: "одиночество духа, которого никто не мог удержать",
    arenaCall: "покойный штиль в центре Арены, способный остановить её ветер",
    rivalForce: "охотники за духами в стеклянных клетках",
    signatureScene: "торнадо отбрасывает врагов, пока она становится воздухом",
    innerConflict: "быть неуязвимой значит снова остаться одной",
  },
  mirabel: {
    motif: "красная книга, искры знания и ускоренные страницы",
    home: "шепчущая библиотека академии",
    wound: "книга, открывшая тайну слишком рано",
    arenaCall: "запретный том, пишущий новую главу только на Арене",
    rivalForce: "архивариусы, стирающие опасные знания",
    signatureScene: "искры знания ускоряют целую команду",
    innerConflict: "мудрость не равна контролю над чужим выбором",
  },
};

const CHAPTER_FRAMES = [
  {
    title: "Дом до грома",
    summary: (b: BrawlerStats, s: ComicSeed) => `${b.name} живёт среди ${s.home}, пока первые трещины будущей битвы ещё кажутся далёкими.`,
    focus: (s: ComicSeed) => `home origin in ${s.home}`,
  },
  {
    title: "Рана, которая не спит",
    summary: (b: BrawlerStats, s: ComicSeed) => `${b.name} сталкивается с тем, что изменило жизнь: ${s.wound}.`,
    focus: (s: ComicSeed) => `emotional wound, ${s.wound}`,
  },
  {
    title: "Первый ответный удар",
    summary: (b: BrawlerStats, s: ComicSeed) => `${b.name} впервые превращает личную боль в действие и показывает свой стиль боя.`,
    focus: (s: ComicSeed) => `first action sequence with ${s.signatureScene}`,
  },
  {
    title: "След Арены",
    summary: (b: BrawlerStats, s: ComicSeed) => `Зов Арены приходит через ${s.arenaCall}, и путь назад становится невозможен.`,
    focus: (s: ComicSeed) => `the Arena call, ${s.arenaCall}`,
  },
  {
    title: "Охота начинается",
    summary: (b: BrawlerStats, s: ComicSeed) => `${s.rivalForce} вынуждают героя идти на риск и раскрыть новые грани силы.`,
    focus: (s: ComicSeed) => `chased by ${s.rivalForce}`,
  },
  {
    title: "Цена силы",
    summary: (b: BrawlerStats, s: ComicSeed) => `${b.name} понимает, что главный враг прячется внутри: ${s.innerConflict}.`,
    focus: (s: ComicSeed) => `inner conflict, ${s.innerConflict}`,
  },
  {
    title: "Ворота открыты",
    summary: (b: BrawlerStats, s: ComicSeed) => `Путь приводит к воротам турнира, где ${b.name} должен доказать право войти.`,
    focus: () => "arrival at the Arena gates",
  },
  {
    title: "Бой под прожекторами",
    summary: (b: BrawlerStats, s: ComicSeed) => `Первый матч превращается в хаос, но ${s.signatureScene} меняет исход.`,
    focus: (s: ComicSeed) => `first Arena match, ${s.signatureScene}`,
  },
  {
    title: "Союз из трёх искр",
    summary: (b: BrawlerStats) => `${b.name} находит своё трио и видит, что чужие истории отвечают на собственные вопросы.`,
    focus: () => "trio alliance revelation",
  },
  {
    title: "Легенда на табло",
    summary: (b: BrawlerStats) => `${b.name} принимает Арену не как клетку, а как сцену для новой легенды.`,
    focus: () => "final comic climax and future team hook",
  },
] as const;

type ChapterFrame = (typeof CHAPTER_FRAMES)[number];

/** Заголовок комикса в UI игры (не меняет главы и ассеты). */
const BRAWLER_COMIC_TITLE_OVERRIDES: Partial<Record<string, string>> = {
  zafkiel: "Зафкиэль: Врата вечности",
};

/** Уникальные главы комикса — не шаблон «как у Зафкиэля». */
const BRAWLER_CHAPTER_FRAMES: Partial<Record<string, readonly ChapterFrame[]>> = {
  zafkiel: CHAPTER_FRAMES.map((frame, index) =>
    index === 1
      ? {
          ...frame,
          title: "Эхо ордена",
          summary: (b, s) =>
            `${b.name} возвращается к руинам ${s.home}: орден пал, но часы ещё тикают — и долг хранителя никуда не делся.`,
        }
      : frame,
  ),
  miya: [
    {
      title: "Тень в бамбуке",
      summary: (_b, s) => `В ${s.home} Мия сдаёт выпускной бросок и получает письмо брата с Арены — пока на востоке пахнет чужим дымом.`,
      focus: (s) => `ninja village daily life, ${s.home}`,
    },
    {
      title: "Пепел клана",
      summary: (_b, s) => `Мия возвращается с горного патруля и находит ${s.wound}; след ведёт к клану безликих с меткой сакуры.`,
      focus: (s) => `clan massacre, ${s.wound}`,
    },
    {
      title: "Кровь на жетоне",
      summary: (_b, s) => `На тропе убийц Мия находит аренский жетон Рэна — ${s.arenaCall} становится личным.`,
      focus: (s) => `Ren's bloodied arena token, ${s.arenaCall}`,
    },
    {
      title: "След маски",
      summary: (_b, s) => `Фиолетовый разрыв реальности хранит отпечаток маски; Мия читает его как карту, а не как часы.`,
      focus: (s) => `reality scar trail, ${s.motif}`,
    },
    {
      title: "Крыши и сети",
      summary: (_b, s) => `${s.rivalForce} загоняют её на черепичные крыши портового квартала.`,
      focus: (s) => `rooftop chase, ${s.rivalForce}`,
    },
    {
      title: "Две клятвы",
      summary: (_b, s) => `Письма Рэна и голос Шимы спорят внутри Мии: ${s.innerConflict}.`,
      focus: (s) => `letters vs blade, ${s.innerConflict}`,
    },
    {
      title: "Первый песок",
      summary: (b) => `${b.name} впервые ступает на аренский песок под чужим именем, чтобы увидеть маску в толпе.`,
      focus: () => "undercover arena entry",
    },
    {
      title: "Дождь из трёх",
      summary: (_b, s) => `Официальный бой: ${s.signatureScene} — визитная карта ниндзя.`,
      focus: (s) => `arena match, ${s.signatureScene}`,
    },
    {
      title: "Спор трёх путей",
      summary: (b) => `${b.name} встречает силуэты трио «Тень живого леса» — тень, корни и свет спорят о цене кары.`,
      focus: () => "shadow-grove trio silhouettes debate justice",
    },
    {
      title: "Имя на ветру",
      summary: (b) => `Сильвен и Люмина выходят из тени; ${b.name} называет убийцу брата и выбирает правосудие без одиночества.`,
      focus: () => "trio finale, killer named, new legend",
    },
  ],
};

function chapterFramesFor(brawlerId: string): readonly ChapterFrame[] {
  return BRAWLER_CHAPTER_FRAMES[brawlerId] ?? CHAPTER_FRAMES;
}

const PAGE_BEATS = [
  "широкий establishing shot, место истории дышит цветом и угрозой",
  "крупный план героя, эмоция сильнее слов",
  "появляется знак конфликта, свет меняет направление",
  "рывок движения, диагональная композиция, враги входят в кадр",
  "первая контратака показывает характер героя",
  "тихий кадр с личной деталью из прошлого",
  "опасность сжимает пространство, силуэт Арены проступает вдали",
  "герой делает выбор, энергия способности собирается вокруг рук",
  "большой action panel, способность взрывает сцену цветом",
  "клиффхэнгер: следующий ранг обещает новую главу",
] as const;

function trioForBrawler(brawlerId: string): BrawlerComicTrio {
  const trio = BRAWLER_COMIC_TRIOS.find(t => t.memberIds.includes(brawlerId));
  if (!trio) throw new Error(`No comic trio for brawler ${brawlerId}`);
  return trio;
}

function trioNames(trio: BrawlerComicTrio): string {
  return trio.memberIds
    .map(id => BRAWLERS.find(b => b.id === id)?.name ?? id)
    .join(", ");
}

function buildPage(
  brawler: BrawlerStats,
  seed: ComicSeed,
  trio: BrawlerComicTrio,
  chapterIndex: number,
  pageIndex: number,
): BrawlerComicPage {
  const chapter = chapterFramesFor(brawler.id)[chapterIndex];
  const beat = PAGE_BEATS[pageIndex];
  const trioLine = chapterIndex >= 8
    ? ` На фоне уже чувствуется связь трио «${trio.name}»: ${trioNames(trio)}.`
    : "";
  const chapterNumber = chapterIndex + 1;
  const pageNumber = pageIndex + 1;
  const speechText = [
    pageIndex === 0 ? "Здесь начинается мой путь." : "Я не отступлю.",
    pageIndex === 8 ? "SFX: KRAK-BOOM!" : "SFX: WHOOSH!",
  ];

  return {
    page: pageNumber,
    assetPath: `/assets/comics/${brawler.id}/chapter-${String(chapterNumber).padStart(2, "0")}/page-${String(pageNumber).padStart(2, "0")}.png`,
    caption: `${brawler.name}: ${beat}.${trioLine}`,
    storyBeat: `${chapter.title}: ${chapter.summary(brawler, seed)} Страница ${pageNumber} ведёт ритм сцены через ${beat}.`,
    imagePrompt: [
      "finished full-color action comic page, vertical 2:3 page, multi-panel layout",
      `main character: ${brawler.name}, role ${brawler.role}`,
      `visual motifs: ${seed.motif}`,
      `chapter focus: ${chapter.focus(seed)}`,
      `page beat: ${beat}`,
      `palette: ${brawler.color}, ${brawler.secondaryColor}, ${brawler.accentColor}`,
      `include in-art speech balloons and sound effects: ${speechText.join(" | ")}`,
      "dynamic composition, clean readable silhouettes, dramatic lighting, speed lines, bold impact lettering",
    ].join("; "),
    negativePrompt: COMIC_NEGATIVE_PROMPT,
    speechText,
    styleGuide: COMIC_STYLE_GUIDE,
    continuityNotes: [
      `${brawler.name} must keep the same costume language, colors, role fantasy, and motifs across all 100 pages.`,
      `Chapter ${chapterNumber} follows: ${chapter.summary(brawler, seed)}`,
      chapterIndex >= 8 ? `Foreshadow trio «${trio.name}» with ${trioNames(trio)} without changing the page focus.` : `Do not introduce the trio reveal before chapter 9.`,
    ].join(" "),
    reviewChecklist: COMIC_REVIEW_CHECKLIST,
  };
}

function buildComic(brawler: BrawlerStats): BrawlerComic {
  const seed = COMIC_SEEDS[brawler.id];
  if (!seed) throw new Error(`No comic seed for brawler ${brawler.id}`);
  const trio = trioForBrawler(brawler.id);
  const frames = chapterFramesFor(brawler.id);
  const title = BRAWLER_COMIC_TITLE_OVERRIDES[brawler.id] ?? `${brawler.name}: ${frames[9].title}`;

  return {
    brawlerId: brawler.id,
    title,
    subtitle: `Цветной комикс о пути на Арену. Трио: ${trio.name}.`,
    coverAssetPath: `/assets/comics/${brawler.id}/cover.png`,
    coverPrompt: [
      "finished full-color comic book cover, vertical 2:3 poster",
      `hero ${brawler.name}, ${brawler.description}`,
      `core lore: ${BRAWLER_LORE[brawler.id] ?? brawler.description}`,
      `visual motifs: ${seed.motif}`,
      `trio foreshadowing: ${trio.theme}`,
      `game style palette ${brawler.color}, ${brawler.secondaryColor}, ${brawler.accentColor}`,
      "bold action pose, arena lights, dramatic comic lighting, original character design, no watermark",
    ].join("; "),
    palette: {
      primary: brawler.color,
      secondary: brawler.secondaryColor,
      accent: brawler.accentColor,
    },
    trioId: trio.id,
    chapters: frames.map((frame, chapterIndex) => ({
      chapter: chapterIndex + 1,
      title: frame.title,
      unlockRank: (chapterIndex + 1) * 10,
      summary: frame.summary(brawler, seed),
      pages: Array.from({ length: COMIC_PAGES_PER_CHAPTER }, (_, pageIndex) =>
        buildPage(brawler, seed, trio, chapterIndex, pageIndex),
      ),
    })),
  };
}

export const BRAWLER_COMICS: Record<string, BrawlerComic> = Object.fromEntries(
  BRAWLERS.map(brawler => [brawler.id, buildComic(brawler)]),
);

export function getBrawlerComic(brawlerId: string): BrawlerComic {
  return BRAWLER_COMICS[brawlerId] ?? BRAWLER_COMICS[BRAWLERS[0].id];
}

export function getBrawlerComicTrio(brawlerId: string): BrawlerComicTrio {
  return trioForBrawler(brawlerId);
}

export const BRAWLER_COMIC_PROMPT_MANIFEST: BrawlerComicPromptManifest = {
  version: 1,
  generatedFor: "brawler-comic-image-batches",
  imageCount: Object.values(BRAWLER_COMICS).reduce((sum, comic) => (
    sum + 1 + comic.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.pages.length, 0)
  ), 0),
  coverImages: Object.values(BRAWLER_COMICS).map(comic => {
    const brawler = BRAWLERS.find(item => item.id === comic.brawlerId) ?? BRAWLERS[0];
    return {
      brawlerId: comic.brawlerId,
      brawlerName: brawler.name,
      assetPath: comic.coverAssetPath,
      imagePrompt: comic.coverPrompt,
      negativePrompt: COMIC_NEGATIVE_PROMPT,
      styleGuide: COMIC_STYLE_GUIDE,
      reviewChecklist: COMIC_REVIEW_CHECKLIST,
    };
  }),
  pages: Object.values(BRAWLER_COMICS).flatMap(comic => {
    const brawler = BRAWLERS.find(item => item.id === comic.brawlerId) ?? BRAWLERS[0];
    return comic.chapters.flatMap(chapter => chapter.pages.map(page => ({
      brawlerId: comic.brawlerId,
      brawlerName: brawler.name,
      chapter: chapter.chapter,
      chapterTitle: chapter.title,
      page: page.page,
      assetPath: page.assetPath,
      imagePrompt: page.imagePrompt,
      negativePrompt: page.negativePrompt,
      speechText: page.speechText,
      styleGuide: page.styleGuide,
      continuityNotes: page.continuityNotes,
      reviewChecklist: page.reviewChecklist,
    })));
  }),
};

