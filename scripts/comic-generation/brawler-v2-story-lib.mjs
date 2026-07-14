import { callistaChapters18, elianChapters18 } from "./callista-elian-v2-pages.mjs";

/** Lore-unique chapter/page data for v2 comic scripts (no Zafkiel template). */

export const BANNED_PHRASES = [
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

export const STANDARD_RULES = {
  format: "VERTICAL PORTRAIT 2:3 tall comic page",
  speech: "No character name prefixes in balloons. Use cream/yellow narration boxes.",
  gameBrawlersFromChapter: 10,
  chapter9SilhouettesOnly: true,
  bannedPhrases: BANNED_PHRASES,
};

export function pg(n, scene, narration, dialogue, sfx = null) {
  return { page: n, scene, narration: [narration], dialogue, sfx };
}

export function d(speaker, text) {
  return { speaker, text };
}

/** @param {string} hero speaker id */
export function ch9Pages(hero, trio, shadowVoice, motif) {
  const [a, b] = trio;
  const silA = a.silhouette;
  const silB = b.silhouette;
  return [
    pg(1, `Arena backstage mist: green/purple/gold fog, roots through floor — SHADOWED trio scene, ${motif}.`, "Закулисье. Туман. Три силуэта у трещины в полу.", [d(hero, "Кто там — без приглашения?"), d(shadowVoice, "Три пути. Один зал. Выбери.")]),
    pg(2, `${silA} SILHOUETTE and ${silB} SILHOUETTE flank shadow — NOT full faces, only outlines.`, "Два силуэта по бокам. Лица скрыты туманом.", [d(hero, "Ещё охотники?"), d(shadowVoice, "Охотники на ложь. Не на тебя.")]),
    pg(3, "Arena hunters attack all three silhouettes; hero strikes to break nets.", "Охотники Арены бросаются на силуэты. Герой режет сети.", [d(hero, "Если вы против них — говорите быстрее.")], "КЛАНГ!"),
    pg(4, `Triangle composition: ${motif} protective circle — silhouettes only.`, "Три цвета в тумане сходятся в круг.", [d(shadowVoice, "Месть — дорога без выхода."), d(hero, "Выход найду сам.")]),
    pg(5, "Silhouettes hold line while hero strikes hunter captain.", "Силуэты держат линию. Герой бьёт капитана.", [d("hunterCaptain", "Троих… невозможно…"), d(hero, "Невозможное — мой репертуар.")], "WHOOSH!"),
    pg(6, "Quiet vow exchange: three ideas, faces hidden.", "Тихий спор: три идеи, лица скрыты.", [d(shadowVoice, "Убьёшь врага — станешь легендой. Или пустотой."), d(hero, "Пустота не принимает приглашений.")]),
    pg(7, `Sky triangle: ${a.symbol}, ${b.symbol}, ${hero} symbol burn into mist.`, "В небе проступают три знака.", [d(hero, "Три пути. Один враг. Пока сходимся.")]),
    pg(8, "Combined strike: hero power + root/light/time thread cuts nets.", "Комбо: удар героя, нити союзников, рвутся сети.", [d(shadowVoice, "Вместе — до ворот."), d(hero, "После — каждый своей дорогой.")], "КРАК-БУМ!"),
    pg(9, "Triangle mark burned into Arena sand; herald watches.", "На песке — треугольный знак. Глашатай затаил дыхание.", [d("herald", "Тебя объявят союзником тени!"), d(hero, "Объявят — не значит узнают.")]),
    pg(10, "Silhouettes depart three ways; hero alone with mark on glove.", "Силуэты уходят тремя тропами. На перчатке — знак.", [d(hero, "Спор трёх путей. Ответ — на песке завтра."), d(shadowVoice, "Завтра мы снова станем тенью.")], "ШШШ…"),
  ];
}

export function ch10Pages(hero, heroName, trio, rival, combo, coverMotif) {
  const [a, b] = trio;
  return [
    pg(1, "Arena ceremony wide: golden scoreboard, herald announces trio alliance rumor.", "Церемония. Слухи о троице гремят громче барабанов.", [d("herald", "Верхний круг открыт. Финал — сегодня."), d(hero, "Сегодня зал полон. Без пустых стульев.")]),
    pg(2, `FULL COLOR: ${a.name} steps from portal — match ${a.id}_skin1.png FULL design.`, `Из портала выходит ${a.nameRu} — полный облик, не силуэт.`, [d(a.id, a.line1), d(hero, a.line2)]),
    pg(3, `FULL COLOR: ${b.name} descends — match ${b.id}_skin1.png FULL design.`, `Спускается ${b.nameRu} — полный дизайн, лицо видно.`, [d(b.id, b.line1), d(hero, b.line2)]),
    pg(4, "Trio vs arena hunters on sand — SAME wide composition, all FULL faces.", "Трое на песке против охотников. Все лица видны.", [d(hero, "Слева — сети. Режем вместе."), d(a.id, a.battle), d(b.id, b.battle)], "КЛАНГ!"),
    pg(5, `Team fight: ${combo} combo layout.`, "Комбо суперов троих.", [d(hero, "Сейчас!"), d(a.id, a.super), d(b.id, b.super)], "КРАК-БУМ!"),
    pg(6, `Upper gate: ${rival.name} descends in full regalia.`, `${rival.nameRu} спускается с верхнего яруса.`, [d(rival.id, rival.line1), d(hero, rival.line2)]),
    pg(7, "Arena edge debate: three voices, three paths.", "Край арены. Три голоса — три пути.", [d(a.id, a.debate), d(b.id, b.debate), d(hero, "Мой путь — мой выбор.")]),
    pg(8, `Night sky: ${coverMotif} merge over Arena dome.`, "Ночное небо: мотивы троицы сливаются над куполом.", [d(rival.spirit || "herald", rival.spiritLine || "Не носи чужую боль как маску."), d(hero, "Ношу память. Маску сниму.")]),
    pg(9, "Final splash: trio vs enemy wave — hero leads.", "Финальный залп: герой ведёт, союзники прикрывают.", [d(hero, "Вперёд!"), d(rival.id, rival.final), d(b.id, "Не сегодня!")], "ВЖУХ-ВЖУХ-ВЖУХ!"),
    pg(10, "End card: hero walks forward, trio behind, wind takes token.", "Конец главы X. Знак уносит ветер — не прощание.", [d(hero, "Имя на табло — не конец."), d(a.id, "Мы рядом."), d(b.id, "До конца пути.")], "ВЕТЕР…"),
  ];
}

export const BRAWLER_CONFIGS = {
  verdeletta: {
    brawlerId: "verdeletta",
    brawlerName: "Верделетта",
    lore: "Верделетта — адский церемонимейстер. Она организует хаотичные торжества в преисподней и устраивает «вечеринки» в мире живых. Её пистолет — инструмент приглашения. Тени находят тех, кто не заплатил за вход.",
    skinRef: "public/dev-notes/brawler-skins/verdeletta_skin1.png",
    trioId: "eternal-ball",
    trioOthers: ["zafkiel", "sora"],
    palette: "#2E7D32 #1B5E20 #69F0AE",
    coverPrompt:
      "finished full-color comic book cover, vertical 2:3 poster; hero Верделетта hell ceremony masteress, green hell light, shadow guests, invitation pistol, palette #2E7D32 #1B5E20 #69F0AE, title ВЕРДЕЛЕТТА Cyrillic, NO speech balloons, match verdeletta_skin1.png",
    npcs: {
      brasso: "Брассо — демон-распорядитель: латунная маска, строгий протокол, ненавидит хаос",
      mora: "Мора — смертная барменша: знает адские слухи, зелёный фартук, острый язык",
      gatekeeper: "Привратник преисподней — рога из дыма, книга гостей, не улыбается",
      unpaidGuest: "Гость без билета — тень живёт отдельно от тела, глаза пустые",
      herald: "Глашатай Арены — золотой рупор, аренская куртка, кричит как гром",
      hunterCaptain: "Капитан охотников протокола — белая маска, цепи, охотится на нарушителей",
      shadowVoice: "Голос из тени — один из троицы, лицо скрыто",
    },
    chapterTitles: [
      "Зал, который не спит",
      "Билет без имени",
      "Протокол преисподней",
      "Бал на крыше",
      "Тень шевелится",
      "Цена входа",
      "Первый песок",
      "Охота распорядителей",
      "Спор трёх путей",
      "Бал вечности",
    ],
    chapters18: [
      [
        pg(1, "Wide: hell ballroom chandeliers drip green fire, Verdeletta adjusts invitation pistol.", "Главный зал преисподней. Люстры капают зелёным огнём.", [d("brasso", "Сегодня по протоколу — тишина."), d("verdeletta", "Тишина скучна. Включи музыку.")]),
        pg(2, "Close: invitation shot marks a sinner — green rune flares on chest.", "Выстрел-приглашение. На груди гостя вспыхивает руна.", [d("verdeletta", "Ты в списке. Не опаздывай.")]),
        pg(3, "Training: shadow guest materializes beside Verdeletta, bows wrong way.", "Тень-гостья материализуется и кланяется не туда.", [d("brasso", "Она снова ломает этикет!"), d("verdeletta", "Этикет для тех, кто боится веселья.")]),
        pg(4, "Mora's bar at hell border: whispers of living-world parties.", "Бар на границе. Мора слышала о балах в мире живых.", [d("mora", "Ты зовёшь смертных без разрешения?"), d("verdeletta", "Разрешение — для скучных.")]),
        pg(5, "Verdeletta finds Arena invite signed by her own shadow.", "Приглашение на Арену. Подпись — её собственная тень.", [d("verdeletta", "Моя тень подписала раньше меня. Дерзко.")]),
        pg(6, "Gatekeeper blocks exit — guest book shows unpaid names.", "Привратник закрывает ворота. В книге — должники.", [d("gatekeeper", "Сначала закрой зал. Потом уходи."), d("verdeletta", "Зал никогда не закрывается.")]),
        pg(7, "Shadow guest over limit — oldest fades screaming.", "Шестая тень. Самая старая исчезает с криком.", [d("brasso", "Лимит — шесть! Ты снова перешла черту!"), d("verdeletta", "Черта — для тех, кто считает.")]),
        pg(8, "Verdeletta packs invitation pistol; green light on horizon.", "Она берёт пистолет. На горизонте — купол Арены.", [d("mora", "Тени последуют за тобой."), d("verdeletta", "Пусть. Бал без гостей — не бал.")]),
        pg(9, "Night: moving shadow detaches from drunk demon.", "Ночь. Тень отделяется от пьяного демона.", [d("unpaidGuest", "Я… не платил…"), d("verdeletta", "Тогда танцуй быстрее.")]),
        pg(10, "Cliffhanger: Verdeletta steps toward Arena road, shadows dance behind.", "Она выходит на дорогу. Тени пляшут следом.", [d("verdeletta", "Следующий зал — на песке.")], "ШШШ…"),
      ],
      [
        pg(1, "Alley in living world: Verdeletta opens pop-up hell ballroom.", "Переулок в мире живых. Вспыхивает теневой зал.", [d("mora", "Здесь нельзя!"), d("verdeletta", "Здесь как раз можно.")], "БУМ!"),
        pg(2, "Unpaid guest's shadow crawls on wall separately.", "Тень гостя ползёт по стене отдельно от тела.", [d("unpaidGuest", "Она… меня не слушает…"), d("verdeletta", "Тени слушают только музыку.")]),
        pg(3, "Brasso arrives with protocol chains.", "Брассо приходит с цепями протокола.", [d("brasso", "Закрыть бал! Немедленно!"), d("verdeletta", "Закрыть — значит обидеть гостей.")]),
        pg(4, "Shadow guests pin protocol hunters with dance moves.", "Тени гостей путают охотников танцем.", [d("verdeletta", "Шаг влево — и вы свободны. Шучу.")], "ВЖУХ!"),
        pg(5, "Guest without ticket melts into floor shadow.", "Гость без билета тает в пол.", [d("unpaidGuest", "Я не хотел…"), d("verdeletta", "Никто не хочет. Все приходят.")]),
        pg(6, "Mora hides survivors in bar cellar.", "Мора прячет выживших в подвале бара.", [d("mora", "Ты превращаешь город в ад."), d("verdeletta", "Город и так пахнет дымом.")]),
        pg(7, "Invitation mark spreads — green runes on walls.", "Метки расползаются по стенам.", [d("brasso", "Это уже не бал. Это охота."), d("verdeletta", "Охота — тоже развлечение.")]),
        pg(8, "Verdeletta reads shadow-signed Arena ticket again.", "Билет на Арену. Подпись тени дрожит.", [d("verdeletta", "Ты хочешь, чтобы я пришла. Я приду.")]),
        pg(9, "Protocol captain vows to stop her at gates.", "Капитан клянётся остановить её у ворот.", [d("hunterCaptain", "На Арене — закон."), d("verdeletta", "На Арене — сцена.")]),
        pg(10, "Wide: pop-up ballroom collapses; Verdeletta walks toward dome.", "Зал схлопывается. Она идёт к куполу.", [d("verdeletta", "Глава II. Билет без имени. Имя напишу сама.")], "ШШШ…"),
      ],
      [
        pg(1, "Hell tribunal: stewards demand Verdeletta return.", "Трибунал преисподней. Распорядители требуют возврата.", [d("brasso", "Ты нарушила протокол трижды."), d("verdeletta", "Протокол нарушил мой вечер.")]),
        pg(2, "Flashback: first party that escaped hell gates.", "Память: первый бал, вырвавшийся за ворота.", [d("gatekeeper", "Это было ошибкой."), d("verdeletta", "Ошибки веселее правил.")]),
        pg(3, "Verdeletta summons three steward shadows — super preview.", "Три тени-распорядителя. Медленные, но мощные.", [d("brasso", "Ты зовёшь их на песок?!"), d("verdeletta", "Они любят дирижировать.")], "КРАК!"),
        pg(4, "Steward shadow kills mock enemy — another spawns.", "Распорядитель убивает манекен — рождается ещё один.", [d("verdeletta", "Каждая смерть — новый гость.")]),
        pg(5, "Gatekeeper shows debt list: unpaid souls in thousands.", "Список должников — тысячи имён.", [d("gatekeeper", "Тени найдут каждого."), d("verdeletta", "Пусть найдут. Я найду Арену.")]),
        pg(6, "Mora smuggles Verdeletta through service tunnel.", "Мора проводит через служебный ход.", [d("mora", "Если поймают — не знаю тебя."), d("verdeletta", "Ты уже знаешь. Этого хватит.")]),
        pg(7, "Protocol hunters ambush tunnel.", "З засада в туннеле.", [d("hunterCaptain", "Сдавай пистолет!"), d("verdeletta", "Пистолет — приглашение. Не отнимай у гостей.")], "WHOOSH!"),
        pg(8, "Shadow guests hold line; Verdeletta escapes.", "Тени держат линию. Она вырывается.", [d("verdeletta", "Спасибо за танец, Брассо.")]),
        pg(9, "Arena outer wall: green fire reflects in her eyes.", "Стена Арены. Зелёный огонь в глазах.", [d("herald", "Следующий боец — без псевдонима?"), d("verdeletta", "Псевдоним — «Хозяйка зала».")]),
        pg(10, "Registration: clerk stamps invite — shadow laughs.", "Регистрация. Тень смеётся за спиной.", [d("verdeletta", "Глава III. Протокол можно нарушить. Бал — нет.")]),
      ],
      [
        pg(1, "Rooftop party: living city skyline, shadow orchestra.", "Бал на крыше. Теневой оркестр.", [d("mora", "Соседи вызывают стражу!"), d("verdeletta", "Стража — тоже гости.")]),
        pg(2, "Citizen sees own shadow bow to Verdeletta.", "Горожанин видит: его тень кланяется ей.", [d("unpaidGuest", "Это… я?"), d("verdeletta", "Ты опоздал. Тень — пунктуальнее.")]),
        pg(3, "Invitation shot marks rooftop guard.", "Метка на стражнике крыши.", [d("verdeletta", "VIP-билет. Не промахнись.")], "ВЖУХ!"),
        pg(4, "Brasso crashes party through chimney.", "Брассо падает из трубы.", [d("brasso", "Хватит!"), d("verdeletta", "Никогда не хватит.")], "БУМ!"),
        pg(5, "Dance floor becomes battlefield — shadows vs chains.", "Танцпол — поле боя. Тени против цепей.", [d("verdeletta", "Медленный вальс, быстрый конец.")]),
        pg(6, "Mora throws guest list into wind.", "Мора бросает список гостей в ветер.", [d("mora", "Ты теряешь контроль."), d("verdeletta", "Контроль — для скучных залов.")]),
        pg(7, "Moving shadows hunt unpaid across rooftops.", "Тени охотятся на должников по крышам.", [d("unpaidGuest", "Я заплачу!"), d("verdeletta", "Плати танцем.")]),
        pg(8, "Verdeletta sees Arena scoreboard glow green.", "Табло Арены вспыхивает зелёным.", [d("herald", "Теневой бал замечен!"), d("verdeletta", "Наконец-то аплодисменты.")]),
        pg(9, "She marks Arena gates with invitation rune.", "Руна приглашения на воротах.", [d("gatekeeper", "Это не вход."), d("verdeletta", "Это приглашение.")]),
        pg(10, "Sunrise: party ends; one shadow remains loyal.", "Рассвет. Остаётся одна верная тень.", [d("verdeletta", "Глава IV. Бал на крыше. Следующий — внутри.")], "ШШШ…"),
      ],
      [
        pg(1, "Mirror alley: citizen watches shadow move alone.", "Зеркальный переулок. Тень движется одна.", [d("unpaidGuest", "Она идёт без меня…"), d("verdeletta", "Значит, ты уже опоздал.")]),
        pg(2, "Verdeletta explains omen — chosen for next ball.", "Примета: тень шевелится — выбран для бала.", [d("mora", "Это жестоко."), d("verdeletta", "Жестоко — отказать без танца.")]),
        pg(3, "Shadow guest copies citizen's face wrong.", "Тень копирует лицо криво.", [d("verdeletta", "Гости не обязаны быть похожими.")]),
        pg(4, "Hunter captain tracks shadow trail to Arena slums.", "Капитан идёт по следу тени.", [d("hunterCaptain", "Бал закончится на песке."), d("verdeletta", "Песок — отличный паркет.")]),
        pg(5, "Verdeletta traps hunter in dance circle.", "Круг танца ловит охотника.", [d("verdeletta", "Раз, два — и ты гость.")], "WHOOSH!"),
        pg(6, "Brasso offers deal: return or exile.", "Брассо предлагает сделку.", [d("brasso", "Вернись — забудем."), d("verdeletta", "Забыть — не мой жанр.")]),
        pg(7, "Citizen's shadow merges back — screams.", "Тень возвращается в тело. Крик.", [d("unpaidGuest", "Больше… не хочу…"), d("verdeletta", "Никто не хочет. Все приходят.")]),
        pg(8, "Verdeletta feels protocol wound — first doubt.", "Впервые — сомнение. Протокол ранит.", [d("verdeletta", "Может, лимит гостей… не враг.")]),
        pg(9, "Arena lower tier lights invite her.", "Нижний ярус зовёт огнями.", [d("herald", "Боец «Хозяйка зала» — на регистрации!")]),
        pg(10, "She walks into Arena mist, shadows waltz.", "Туман Арены. Тени вальсируют.", [d("verdeletta", "Глава V. Тень шевелится. Я — дирижёр.")]),
      ],
      [
        pg(1, "Flashback: first protocol breach — laughter in silence hall.", "Память: первый смех в зале тишины.", [d("gatekeeper", "Ты смеялась на похоронах демона."), d("verdeletta", "Похороны — тоже бал.")]),
        pg(2, "Present: Verdeletta counts shadow guests like coins.", "Она считает теней, как монеты.", [d("brasso", "Каждый гость — долг."), d("verdeletta", "Долг — мотивация танцевать.")]),
        pg(3, "Unpaid soul offers soul coin — rejected.", "Душа предлагает монету — отказ.", [d("unpaidGuest", "Возьми всё!"), d("verdeletta", "Мне нужен танец, не медь.")]),
        pg(4, "Mora reveals Arena ticket price: one true name.", "Цена билета — одно настоящее имя.", [d("mora", "Арена берёт имя."), d("verdeletta", "У меня их много.")]),
        pg(5, "Verdeletta writes alias on sand — green fire.", "Псевдоним горит на песке.", [d("verdeletta", "«Зелёный вальс». Пойдёт.")]),
        pg(6, "Steward shadows practice formation.", "Распорядители строятся.", [d("brasso", "Они убьют тебя на арене."), d("verdeletta", "Они дирижируют моей победой.")]),
        pg(7, "Hunter captain breaks one shadow — Verdeletta bleeds.", "Охотник ломает тень. Она кровоточит зелёным.", [d("verdeletta", "Мои гости — моя кровь.")]),
        pg(8, "She pays debt with own invitation mark.", "Она платит меткой на себе.", [d("gatekeeper", "Безумие."), d("verdeletta", "Безумие — вход бесплатный.")]),
        pg(9, "Arena gate opens to green spotlight.", "Ворота. Зелёный прожектор.", [d("herald", "Выход на песок!")]),
        pg(10, "Verdeletta steps in — crowd roars.", "Она выходит. Толпа ревёт.", [d("verdeletta", "Глава VI. Цена входа оплачена.")], "РРРА!"),
      ],
      [
        pg(1, "Lower ring sand: Verdeletta vs chain fighter.", "Нижний круг. Противник с цепями.", [d("herald", "Первый бой «Зелёного вальса»!"), d("verdeletta", "Музыка — громче.")]),
        pg(2, "Invitation shots mark both enemies.", "Две метки. Две тени.", [d("verdeletta", "Гости, занимайте места.")], "ВЖУХ!"),
        pg(3, "Shadow guests flank; crowd chants.", "Тени фланируют. Толпа поёт.", [d("mora", "Они любят её!"), d("brasso", "Они любят катастрофу.")]),
        pg(4, "Enemy cuts shadow — Verdeletta falters.", "Враг режет тень. Она дрогнула.", [d("verdeletta", "Мои гости не одноразовые.")]),
        pg(5, "Super preview: three stewards on sand.", "Три распорядителя на песке.", [d("verdeletta", "Открытие главного зала!")], "КРАК-БУМ!"),
        pg(6, "Victory: herald declares winner.", "Победа. Глашатай объявляет.", [d("herald", "«Зелёный вальс» проходит дальше!")]),
        pg(7, "Hunter captain offers truce — trap.", "Капитан предлагает перемирие — ловушка.", [d("hunterCaptain", "Сдай пистолет."), d("verdeletta", "Без дирижёра оркестр молчит.")]),
        pg(8, "Child fighter's shadow dances alone — guilt.", "Тень ребёнка танцует одна.", [d("verdeletta", "Арена жрёт малых. Я — не протокол.")]),
        pg(9, "Night training: sixth shadow limit.", "Ночь. Лимит шести теней.", [d("brasso", "Ты сдержалась."), d("verdeletta", "Пока.")]),
        pg(10, "Signs next fight vs Protocol Lord.", "Следующий — «Лорд протокола».", [d("verdeletta", "Глава VII. Первый песок пройден.")], "ШШШ…"),
      ],
      [
        pg(1, "Mid ring: Protocol Lord in white chains.", "Средний круг. Лорд протокола в цепях.", [d("hunterCaptain", "Верни порядок!"), d("verdeletta", "Порядок — скучный гость.")]),
        pg(2, "Lord summons anti-shadow nets.", "Сети против теней.", [d("verdeletta", "Сети — некрасивые занавесы.")], "РВАНЬ!"),
        pg(3, "Stewards break nets; Verdeletta marks lord.", "Распорядители рвут сети. Метка на лорде.", [d("verdeletta", "Ты приглашён. Не опаздывай.")]),
        pg(4, "Lord is brasso in disguise — reveal.", "Лорд срывает маску — Брассо.", [d("brasso", "Я должен остановить тебя."), d("verdeletta", "Ты должен дирижировать.")]),
        pg(5, "Emotional beat: old friends across sand.", "Песок между старыми друзьями.", [d("brasso", "Протокол спасал нас."), d("verdeletta", "Бал спасал меня.")]),
        pg(6, "Verdeletta wins without killing — cage of dance.", "Победа без смерти — клетка танца.", [d("verdeletta", "Живи. Дирижируй следующий раз.")]),
        pg(7, "Tribunal grants upper gate access.", "Трибунал открывает верхний ярус.", [d("herald", "Финал — на рассвете!")]),
        pg(8, "Hunters mass outside quarters.", "Охотники окружают.", [d("hunterCaptain", "Ты сломала все правила."), d("verdeletta", "Правила — не мои гости.")]),
        pg(9, "Shadow ball escape through ceiling.", "Побег через потолок — теневой бал.", [d("verdeletta", "До финала. Не опаздывайте.")], "ВЖУХ!"),
        pg(10, "Rain-slick roof toward upper tier.", "Крыша под дождём. Верхний ярус.", [d("verdeletta", "Глава VIII. Охота закончится на сцене.")], "ДОЖДЬ…"),
      ],
    ],
    ch9: () =>
      ch9Pages("verdeletta", [
        { id: "zafkiel", silhouette: "clock-halo", symbol: "hourglass" },
        { id: "sora", silhouette: "floating rune book", symbol: "rune page" },
      ], "shadowVoice", "green hell + white-gold clock + violet runes"),
    ch10: () =>
      ch10Pages(
        "verdeletta",
        "Верделетта",
        [
          {
            id: "zafkiel",
            name: "Zafkiel",
            nameRu: "Зафкиэль",
            line1: "Время пришло на бал. Часы не опаздывают.",
            line2: "Часы тикают. Я — не секунда.",
            battle: "Откат держит линию.",
            super: "Стоп!",
            debate: "Суд — секундой.",
          },
          {
            id: "sora",
            name: "Sora",
            nameRu: "Сора",
            line1: "Руны помнят ваш зал. Мы обещали стычку.",
            line2: "Руны — не приглашения. Но я пришла.",
            battle: "Страница режет.",
            super: "Печать!",
            debate: "Запрет — свитком.",
          },
        ],
        {
          id: "brasso",
          name: "Protocol Brasso",
          nameRu: "Брассо",
          line1: "Последний танец — по протоколу!",
          line2: "Протокол — не музыка.",
          final: "Цепи поглотят бал!",
          spirit: "gatekeeper",
          spiritLine: "Не превращай гостей в пепел.",
        },
        "invitation mark + clock rewind + rune seal",
        "green hell fire + clock halo + violet runes"
      ),
  },

  lumina: {
    brawlerId: "lumina",
    brawlerName: "Люмина",
    lore: "Люмина — дочь падшего ангела и смертной. Крылья светятся тоской по небу. Золотые нити связывают врагов и потерянные души. Она примиряет, а не убивает.",
    skinRef: "public/dev-notes/brawler-skins/lumina_skin1.png",
    trioId: "shadow-grove",
    trioOthers: ["miya", "silven"],
    palette: "#ECEFF1 #FFD54F #FFFFFF",
    coverPrompt:
      "finished full-color comic book cover, vertical 2:3; hero Lumina mythic girl glowing wings, golden threads, white wings, palette #ECEFF1 #FFD54F #FFFFFF, title ЛЮМИНА Cyrillic, NO speech balloons, match lumina_skin1.png",
    npcs: {
      sisterMaris: "Сестра Марис — монахиня часовни: серая ряса, мягкий голос, знает падших",
      lostSoul: "Потерянная душа — полупрозрачная, просит покоя",
      lightHunter: "Охотник за светом — чёрный плащ, ненавидит крылья",
      penitent: "Кающийся воин — шрамы, ищет прощения",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска, сети",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    chapterTitles: [
      "Часовня у обрыва",
      "Крылья без неба",
      "Нить к потерянным",
      "Охотники света",
      "Золотая клетка",
      "Цена милосердия",
      "Первый суд на песке",
      "Бой без крови",
      "Спор трёх путей",
      "Свет на табло",
    ],
    chapters18: [
      [
        pg(1, "Wide: cliff chapel at dawn, Lumina wings glow gold.", "Часовня у обрыва. Крылья светятся золотом.", [d("sisterMaris", "Сегодня — тишина, Люмина."), d("lumina", "Тишина громче моих крыльев.")]),
        pg(2, "Close: golden thread between two sparrows.", "Золотая нить между двумя воробьями.", [d("lumina", "Связь — не клетка. Мост.")]),
        pg(3, "Flashback inset: fallen angel father fades into sky.", "Память: отец-ангел растворяется в небе.", [d("lostSoul", "Он… ушёл вверх?"), d("lumina", "Вверх — не всегда дом.")]),
        pg(4, "Sister Maris rings bell — Arena call in sound.", "Колокол звенит в сторону Арены.", [d("sisterMaris", "Это не для молитвы."), d("lumina", "Значит, для ответа.")]),
        pg(5, "Lost soul knocks chapel door — glowing cage visible far.", "Потерянная душа стучит. Вдали — сияющая клетка.", [d("lostSoul", "Меня держат…"), d("lumina", "Держат — значит, можно отпустить.")]),
        pg(6, "Lumina sends thread toward distant Arena dome.", "Нить тянется к куполу Арены.", [d("penitent", "Туда нельзя."), d("lumina", "Нельзя — не значит не нужно.")]),
        pg(7, "Light hunter watches from forest edge.", "Охотник за светом в лесу.", [d("lightHunter", "Падшая…"), d("lumina", "Падшая — всё ещё свет.")]),
        pg(8, "Training: chain thread hits two targets without harm.", "Цепь нити бьёт две цели без смерти.", [d("sisterMaris", "Ты не убиваешь."), d("lumina", "Убивают те, кто боится связи.")]),
        pg(9, "Night prayer: wings dim with longing.", "Ночная молитва. Крылья тускнеют от тоски.", [d("lumina", "Дом… если он есть… услышь.")]),
        pg(10, "Cliffhanger: Arena cage soul screams her name.", "Клетка на горизонте зовёт её имя.", [d("lostSoul", "Люмина!!!"), d("lumina", "Иду.")], "ШШШ…"),
      ],
      [
        pg(1, "Chapel destroyed by hunter raid — feathers on stone.", "Налёт охотников. Перья на камне.", [d("lightHunter", "Свет должен погаснуть!"), d("lumina", "Погаснуть — не значит исчезнуть.")], "БУМ!"),
        pg(2, "Sister Maris hides children in crypt.", "Марис прячет детей в склепе.", [d("sisterMaris", "Беги!"), d("lumina", "Я держу дверь.")]),
        pg(3, "Golden dome super preview — hunters trapped slow.", "Купол замедляет охотников.", [d("lumina", "Пока — без крови.")], "КРАК!"),
        pg(4, "Penitent fights hunter — Lumina binds both.", "Кающийся бьёт охотника. Она связывает обоих.", [d("penitent", "Я заслужил боль!"), d("lumina", "Боль — не судья.")]),
        pg(5, "Lost soul freed briefly — dissolves smiling.", "Душа освобождена — растворяется с улыбкой.", [d("lostSoul", "Спасибо…"), d("lumina", "Покой — не конец.")]),
        pg(6, "Chapel burns; Lumina saves bell rope.", "Часовня горит. Она спасает верёвку колокола.", [d("sisterMaris", "Всё…"), d("lumina", "Не всё. Есть Аренa.")]),
        pg(7, "Light hunter vows to follow to Arena.", "Охотник клянётся идти следом.", [d("lightHunter", "На песке погасну.")]),
        pg(8, "Lumina reads mother's letter — stay merciful.", "Письмо матери: оставайся милосердной.", [d("lumina", "«Не стань тем, кто режет». Поняла.")]),
        pg(9, "Wide: lone figure walks road to Arena.", "Она идёт к куполу.", [d("penitent", "Куда?"), d("lumina", "Туда, где души в клетках.")]),
        pg(10, "Wings reflect fire — resolve hardens.", "Крылья отражают огонь.", [d("lumina", "Глава II. Крылья без неба. Небо — впереди.")], "ШШШ…"),
      ],
      [
        pg(1, "Forest shrine: threads connect lost souls in circle.", "Лесной алтарь. Нити соединяют души.", [d("lumina", "Каждая нить — имя.")]),
        pg(2, "Soul shows Arena registration number burned on wrist.", "На запястье души — номер Арены.", [d("lostSoul", "Они записали меня…"), d("lumina", "Запишу ответ.")]),
        pg(3, "Flashback: mother teaches mercy at cliff.", "Мать учит милосердию у обрыва.", [d("sisterMaris", "Голос памяти: не тяни за нить."), d("lumina", "Тянуть — значит не бросать.")]),
        pg(4, "Penitent joins as guide — knows Arena slums.", "Кающийся ведёт через трущобы.", [d("penitent", "Там охотники сильнее."), d("lumina", "Свет — тоже.")]),
        pg(5, "Ambush: hunter net; thread cuts net without blade.", "Сеть. Нить режет без лезвия.", [d("lightHunter", "Снова ты!"), d("lumina", "Снова — без ненависти.")], "ВЖУХ!"),
        pg(6, "Night camp: souls whisper Arena secrets.", "Души шепчут секреты Арены.", [d("lostSoul", "Клетка… живая…")]),
        pg(7, "Lumina super dome heals penitent's scars.", "Купол лечит шрамы кающегося.", [d("penitent", "Зачем?"), d("lumina", "Потому что можешь встать.")]),
        pg(8, "Hunter captain offers deal — soul for pass.", "Сделка: душа за пропуск.", [d("hunterCaptain", "Одна душа — вход."), d("lumina", "Ни одной.")]),
        pg(9, "Registration desk: alias Golden Thread.", "Псевдоним «Золотая нить».", [d("herald", "Следующая — без крови?"), d("lumina", "Без смерти — да.")]),
        pg(10, "Arena wall pulses gold.", "Стена пульсирует золотом.", [d("lumina", "Глава III. Нить к потерянным.")]),
      ],
      [
        pg(1, "Border town: wanted posters for fallen angel blood.", "Объявления: кровь падшего ангела.", [d("lightHunter", "Награда за крылья!"), d("lumina", "Крылья не продаются.")]),
        pg(2, "Tavern: penitent bribes clerk for papers.", "Подкуп чиновника.", [d("penitent", "Держи."), d("lumina", "Не платим душами.")]),
        pg(3, "Alley fight: two hunters; threads bind both.", "Два охотника. Обе связаны.", [d("hunterCaptain", "Запомню нить!"), d("lumina", "Запомни — милосердие.")], "WHOOSH!"),
        pg(4, "Captain mask reflects her wings.", "Маска отражает крылья.", [d("hunterCaptain", "Ты слаба."), d("lumina", "Слабость — не убивать.")]),
        pg(5, "Rips hunter insignia — light cult symbol.", "Под insignia — символ культа света.", [d("lumina", "Свет без милости — слеп.")]),
        pg(6, "Debate penitent: justice vs mercy.", "Спор: правосудие или милость.", [d("penitent", "Они убили часовню!"), d("lumina", "Суд будет. На песке.")]),
        pg(7, "Dream: father angel behind cloud.", "Сон: отец за облаком.", [d("lostSoul", "Не режь во сне…"), d("lumina", "Я бодрствую.")]),
        pg(8, "Caravan to gates; iron nets above.", "Караван. Сети на дороге.", [d("sisterMaris", "Голос письма: осторожно."), d("lumina", "Сети рвутся светом.")]),
        pg(9, "Outer wall looms.", "Стена Арены.", [d("lumina", "Здесь клетки громче молитв.")]),
        pg(10, "Registers Golden Thread.", "Регистрация.", [d("lumina", "Имя на ветру. Пока так.")], "ШШШ…"),
      ],
      [
        pg(1, "Rooftop chase: hunters fire light bolts.", "Погоня по крышам.", [d("lightHunter", "Гори!"), d("lumina", "Свет не жжёт своих.")], "ВЗРЫВ!"),
        pg(2, "Net trap; dome contains blast.", "Сеть. Купол гасит взрыв.", [d("lumina", "Клетка — щит, не тюрьма.")]),
        pg(3, "Penitent and Maris letter guide escape.", "Письмо ведёт к безопасному пути.", [d("penitent", "Направо!"), d("lumina", "Слева — свет.")]),
        pg(4, "Triple thread pins three hunters.", "Три нити — три руки.", [d("lumina", "Один жест. Три паузы.")], "ВЖУХ!"),
        pg(5, "Captain watches from higher roof.", "Капитан смотрит сверху.", [d("hunterCaptain", "Арена любит слабых."), d("lumina", "Арена любит правду.")]),
        pg(6, "Map of Arena layers — cage marked top.", "Карта. Клетка на верхнем ярусе.", [d("penitent", "Десять боёв."), d("lumina", "Десять — не вечность.")]),
        pg(7, "Practice dome on dummy — no damage.", "Купол на манекене без урона.", [d("lumina", "Супер — не приговор.")], "КРАК!"),
        pg(8, "Intel: Light Patriarch dines with patron.", "Патриарх света у покровителя.", [d("sisterMaris", "Его не выдадут."), d("lumina", "Вытащу на песок.")]),
        pg(9, "Nails golden thread on net tower.", "Нить на башне сетей.", [d("lumina", "Пусть увидят свет.")]),
        pg(10, "Sunrise over Arena.", "Рассвет.", [d("lumina", "Глава V. Золотая клетка ждёт ключ.")]),
      ],
      [
        pg(1, "Twin altars: living and dead.", "Два алтаря.", [d("lumina", "Две клятвы. Одна — душам.")]),
        pg(2, "Flashback child Lumina swears mercy.", "Детство: клятва милости.", [d("sisterMaris", "Голос матери: не ненавидь."), d("lumina", "Ненависть — темнота.")]),
        pg(3, "Incense for chapel, thread for hunter.", "Благовоние — часовне. Нить — охотнику.", [d("lostSoul", "Помнишь?"), d("lumina", "Помню. Поэтому свет.")]),
        pg(4, "Penitent almost sold her for bounty.", "Кающийся чуть не предал.", [d("penitent", "Мне предлагали…"), d("lumina", "Второй раз — выбор.")]),
        pg(5, "Argument mercy vs punishment.", "Спор.", [d("penitent", "Им нужна кровь!"), d("lumina", "Им нужен суд.")]),
        pg(6, "Lost soul visible to penitent.", "Душа видна кающемуся.", [d("lostSoul", "Не тащи его в тьму.")]),
        pg(7, "Tribunal: champion can demand trial.", "Трибунал: право вызова.", [d("herald", "Победи — получишь голос."), d("lumina", "Голос — свет.")]),
        pg(8, "Two notches on thread bracelet.", "Две насечки на браслете.", [d("lumina", "Милость и правда.")]),
        pg(9, "Wind like verdict.", "Ветер как приговор.", [d("sisterMaris", "Выбери путь без клетки для своих.")]),
        pg(10, "Walks to lower gate.", "К нижним воротам.", [d("lumina", "Глава VI. Цена милосердия — терпение.")]),
      ],
      [
        pg(1, "Lower ring: Lumina vs net fighter.", "Нижний круг.", [d("herald", "«Золотая нить»!"), d("lumina", "Без смерти — с бой.")]),
        pg(2, "Threads bind weapons not throats.", "Нити связывают оружие.", [d("lumina", "Опусти. Живи.")]),
        pg(3, "Opening clash; crowd unsure.", "Толпа не понимает.", [d("penitent", "Люмина…")]),
        pg(4, "Chain hits two enemies.", "Цепь бьёт двоих.", [d("lumina", "Связаны — значит, честно.")], "WHOOSH!"),
        pg(5, "Dome ends fight — winner declared.", "Купол завершает бой.", [d("herald", "Победа без крови!")]),
        pg(6, "Captain backstage deal.", "Сделка за крылья.", [d("hunterCaptain", "Сдай нить."), d("lumina", "Нить — мой ответ.")]),
        pg(7, "Healer scene child fighter.", "Ребёнок на носилках.", [d("lumina", "Арена жрёт малых. Я — щит.")]),
        pg(8, "Night training dome on sand.", "Ночная тренировка.", [d("lostSoul", "Хватит."), d("lumina", "Не хватит, пока клетка жива.")]),
        pg(9, "Signs fight vs Light Fang.", "Вызов «Клыку света».", [d("lumina", "Первый песок пройден.")], "ШШШ…"),
        pg(10, "Upper tier glows.", "Верхний ярус.", [d("lumina", "Глава VII. Суд начинается.")]),
      ],
      [
        pg(1, "Mid ring: Light Fang half-mask.", "«Клык света».", [d("lumina", "Свет без милости — слеп.")]),
        pg(2, "Blinding flash; she closes eyes listens.", "Ослепление. Она слушает.", [d("lumina", "Дыхание громче вспышки.")]),
        pg(3, "Threads on mask and sleeve.", "Нити на маске.", [d("lumina", "Третья — терпение.")], "ВЖУХ!"),
        pg(4, "Dome contains Fang charge.", "Купол держит рывок.", [d("lumina", "Граница!")], "КРАК!"),
        pg(5, "Mask cracks — cult recruit not patriarch.", "Под маской — рекрут.", [d("lumina", "Пешка. Патриарх прячется.")]),
        pg(6, "Tribunal queue vs Light Patriarch.", "Официальный вызов.", [d("herald", "Это он.")]),
        pg(7, "Hunters surround quarters.", "Окружение.", [d("hunterCaptain", "Ты сломала культ."), d("lumina", "Культ сломал часовню.")]),
        pg(8, "Thread rain through window escape.", "Дождь нитей.", [d("lumina", "Буря — впереди.")], "ВЖУХ-ВЖУХ!"),
        pg(9, "Rain roof eyes to upper tier.", "Крыша под дождём.", [d("lumina", "Патриарх. Песок ждёт.")]),
        pg(10, "Chapter VIII end.", "Глава VIII.", [d("lumina", "Бой без крови — не бой без силы.")], "ДОЖДЬ…"),
      ],
    ],
    ch9: () =>
      ch9Pages("lumina", [
        { id: "miya", silhouette: "ninja fan shuriken", symbol: "shuriken" },
        { id: "silven", silhouette: "tree-antler", symbol: "oak leaf" },
      ], "shadowVoice", "purple shadow + green roots + gold light"),
    ch10: () =>
      ch10Pages(
        "lumina",
        "Люмина",
        [
          {
            id: "miya",
            name: "Miya",
            nameRu: "Мия",
            line1: "Тень с бамбуком. Мы обещали стычку у ворот.",
            line2: "Обещание держу. Свет — впереди.",
            battle: "Лезвие держит.",
            super: "Разрыв!",
            debate: "Клинок — моим дыханием.",
          },
          {
            id: "silven",
            name: "Silven",
            nameRu: "Сильвен",
            line1: "Корни помнят ваш свет. Вместе — до конца.",
            line2: "Корни и свет — не враги.",
            battle: "Корни держат.",
            super: "Рост!",
            debate: "Суд — корнями.",
          },
        ],
        {
          id: "lightHunter",
          name: "Light Patriarch",
          nameRu: "Патриарх света",
          line1: "Падшая… вернулась за вторым сиянием?",
          line2: "За именем. Твоим.",
          final: "Свет поглотит крылья!",
          spirit: "lostSoul",
          spiritLine: "Не носи чужую ярость как вторую пару крыльев.",
        },
        "golden dome + shuriken fan + life tree",
        "burned chapel + oak + golden cage"
      ),
  },

  callista: {
    brawlerId: "callista",
    brawlerName: "Каллиста",
    lore: "Каллиста — алхимик, которая взорвала свою лабораторию, пытаясь создать лекарство от всех болезней. После этого она носит очки с разноцветными линзами, потому что каждый свой реактив видит в новом свете. Её супер — взрывная смесь всех рецептов, которые она накопила. Она не знает, вылечит это или убьёт, но готова рискнуть ради науки.",
    skinRef: "public/dev-notes/brawler-skins/callista_skin1.png",
    trioId: "venom-tide",
    trioOthers: ["rin", "octavia"],
    palette: "#43A047 #FFFFFF #A5D6A7",
    coverPrompt:
      "finished full-color comic book cover, vertical 2:3 poster; hero Callista green hair lens goggles explosive flasks, palette #43A047 #FFFFFF #A5D6A7, title КАЛЛИСТА Cyrillic, NO speech balloons, match callista_skin1.png",
    npcs: {
      professorVoss: "Профессор Восс — наставник до взрыва лаборатории",
      censor: "Цензор гильдии — белые перчатки, запреты",
      patientZero: "Первый пациент — шрамы реакции, надежда",
      remy: "Реми — ассистент: дрожит, но верит",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    chapterTitles: [
      "Лаборатория до грома",
      "Осколки формулы",
      "Линзы видят боль",
      "Гильдия пришла",
      "Кислота и лёд",
      "Риск ради науки",
      "Первый реактив на песке",
      "Смесь без имени",
      "Спор трёх путей",
      "Лекарство на табло",
    ],
    chapters18: callistaChapters18,
    ch9: () =>
      ch9Pages(
        "callista",
        [
          { id: "rin", silhouette: "poison vial", symbol: "vial" },
          { id: "octavia", silhouette: "ink tide trident", symbol: "wave" },
        ],
        "shadowVoice",
        "green acid + violet poison + blue tide"
      ),
    ch10: () =>
      ch10Pages(
        "callista",
        "Каллиста",
        [
          {
            id: "rin",
            name: "Rin",
            nameRu: "Рин",
            line1: "Яд и лекарство — соседи на полке.",
            line2: "Соседи — не враги.",
            battle: "Флакон держит.",
            super: "Капля!",
            debate: "Правда — в дозе.",
          },
          {
            id: "octavia",
            name: "Octavia",
            nameRu: "Октавия",
            line1: "Вода смывает осколки лаборатории.",
            line2: "Смыть — не забыть.",
            battle: "Прилив держит.",
            super: "Волна!",
            debate: "Месть — не лекарство.",
          },
        ],
        {
          id: "censor",
          name: "Guild Censor",
          nameRu: "Цензор",
          line1: "Сдай все рецепты гильдии!",
          line2: "Наука — не тайна для трусов.",
          final: "Смесь поглотит вас!",
          spirit: "professorVoss",
          spiritLine: "Не взрывай ради гордости.",
        },
        "mega-mix + poison cloud + tidal veil",
        "lab ruins + jungle vial + moonlit lake"
      ),
  },

  elian: {
    brawlerId: "elian",
    brawlerName: "Элиан",
    lore: "Элиан — ученик обсерватории, который научился сгущать свет в заряды и искривлять гравитацию. Его пальто усеяно звёздами не для красоты: каждая — метка пройденного неба. Он не торопится в бою — ждёт, пока шар созреет, и только тогда отпускает катастрофу.",
    skinRef: "public/dev-notes/brawler-skins/elian_skin1.png",
    trioId: "starbound-scholars",
    trioOthers: ["yuki", "mirabel"],
    palette: "#1565C0 #FFD54F #E3F2FD",
    coverPrompt:
      "finished full-color comic book cover, vertical 2:3 poster; hero Elian star coat blue charges gravity vortex, palette #1565C0 #FFD54F #E3F2FD, title ЭЛИАН Cyrillic, NO speech balloons, match elian_skin1.png",
    npcs: {
      directorKael: "Директор Каэль — обсерватория, строгий плащ",
      orbitEater: "Разведчик пожирателей орбит — трещины в небе",
      chartSpirit: "Дух карты — шёпот созвездий",
      nova: "Нова — соперник-ученик: зависть к звёздам",
      herald: "Глашатай Арены — золотой рупор",
      hunterCaptain: "Капитан охотников — белая маска",
      shadowVoice: "Голос из тени — союзник без лица",
    },
    chapterTitles: [
      "Карта над городом",
      "Звезда, что упала",
      "Заряд созревает",
      "Пожиратели орбит",
      "Воронка на мосту",
      "Вина дальнего выстрела",
      "Первый матч на песке",
      "Созвездие врага",
      "Спор трёх путей",
      "Имя на звёздах",
    ],
    chapters18: elianChapters18,
    ch9: () =>
      ch9Pages(
        "elian",
        [
          { id: "yuki", silhouette: "ice healer swirl", symbol: "snowflake" },
          { id: "mirabel", silhouette: "floating spellbook", symbol: "book page" },
        ],
        "shadowVoice",
        "blue star charge + ice healing + violet pages"
      ),
    ch10: () =>
      ch10Pages(
        "elian",
        "Элиан",
        [
          {
            id: "yuki",
            name: "Yuki",
            nameRu: "Юки",
            line1: "Лёд помнит твою звезду. Стычка у ворот.",
            line2: "Холод — не пустота.",
            battle: "Иней держит.",
            super: "Буря!",
            debate: "Исцеление — терпением.",
          },
          {
            id: "mirabel",
            name: "Mirabel",
            nameRu: "Мирабель",
            line1: "Книга хранит твои неба. Вместе — до конца.",
            line2: "Страницы — не цепи.",
            battle: "Строка режет.",
            super: "Глава!",
            debate: "Истина — в тексте.",
          },
        ],
        {
          id: "orbitEater",
          name: "Orbit Eater",
          nameRu: "Пожиратель",
          line1: "Звёзды — моя трапеза!",
          line2: "Не сегодня.",
          final: "Орбиты сожрут вас!",
          spirit: "chartSpirit",
          spiritLine: "Не неси вину как второе созвездие.",
        },
        "gravity vortex + ice storm + book seal",
        "observatory dome + mountain temple + library light"
      ),
  },
};

export function buildChaptersFromConfig(cfg) {
  const titles = cfg.chapterTitles;
  const list = cfg.chapters18.map((pages, i) => ({ title: titles[i], pages }));
  list.push({ title: titles[8], pages: cfg.ch9() });
  list.push({ title: titles[9], pages: cfg.ch10() });
  return Object.fromEntries(list.map((ch, i) => [String(i + 1), ch]));
}
