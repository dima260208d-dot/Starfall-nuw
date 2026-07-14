import fs from "node:fs";
import path from "node:path";

const npcs = {
  kageSensei: "Кагэ-сенсэй — старый мастер теневых клинков, седые волосы в узел, тёмно-серое кимоно с эмблемой сюрикена, строгий но добрый",
  yukan: "Юкан — юный ученик: короткие КАШТАНОВЫЕ волосы, простое СЕРОЕ кимоно, без маски, без фиолетовых волос — НИКОГДА не копия Мии",
  renGhost: "Призрак брата Рэна — полупрозрачный силуэт с катаной, похож на Мию но старше и без маски",
  maskCaptain: "Капитан безликих — охотник в гладкой БЕЛОЙ маске без черт лица, чёрный плащ, парные кинжалы",
  maskHunter: "Охотник безликих — белая маска, тёмная броня, сеть и кинжалы",
  herald: "Глашатай Арены — высокий глашатай в золотой аренской форме с эмблемой купола"
};

const chapters = {
  "1": {
    title: "Дом до грома",
    pages: [
      {page:1,scene:"Wide: hidden shadow blade village in misty bamboo forest at dawn, purple lanterns.",narration:["Скрытая деревня теневых клинков. Утро, которое ещё кажется обычным."],dialogue:[{speaker:"kageSensei",text:"Сегодня ты бросаешь три лезвия одним движением, Мия."},{speaker:"miya",text:"Три сюрикена — один вдох. Здесь начинается мой путь."}],sfx:null},
      {page:2,scene:"Training yard: Miya practices shuriken fan throw, three blades spread ±15 degrees.",narration:["Каждый ученик учится попадать. Мия учится не промахиваться."],dialogue:[{speaker:"kageSensei",text:"Центральный — в цель. Боковые — в углы, куда враг убежит."},{speaker:"miya",text:"Они не знают промаха. Я не дам им права на ошибку."}],sfx:null},
      {page:3,scene:"Hairline purple reality crack flickers above village gate — first omen.",narration:["Первый треск в тишине. Не гром — трещина в воздухе."],dialogue:[{speaker:"yukan",text:"Сэнсэй! Над воротами… воздух ломается!"},{speaker:"miya",text:"Не паникуй. Тени иногда кашляют."}],sfx:"ТРЕСК!"},
      {page:4,scene:"Training hall: Miya teleports short distance behind wooden dummy, strikes.",narration:["Учебный зал. Искусство телепортации — секрет клана."],dialogue:[{speaker:"miya",text:"Держись за мою спину, Юкан!"},{speaker:"yukan",text:"Ты… исчезла и снова здесь!"}],sfx:"WHOOSH!"},
      {page:5,scene:"Perfect triple shuriken hit on three targets simultaneously.",narration:["Три мишени. Три попадания. Один бросок."],dialogue:[{speaker:"kageSensei",text:"Ты вернула не манекен — ты вернула веру в клан."},{speaker:"miya",text:"Значит, ещё можно защищать дом."}],sfx:"ВЖУХ!"},
      {page:6,scene:"Night: Miya holds brother Ren's old red ribbon in candlelit room.",narration:["Ночь. Память о брате Рэне — красная лента на ладонях."],dialogue:[{speaker:"miya",text:"Ты обещал вернуться с турнира."},{speaker:"renGhost",text:"…обещания не стареют, сестра."}],sfx:null},
      {page:7,scene:"Through bamboo, distant Arena dome glows purple on horizon.",narration:["Вдали проступает купол Арены — будто зовёт по имени павших."],dialogue:[{speaker:"yukan",text:"Рэн говорил, что слышит его без звука."},{speaker:"miya",text:"Арена не зовёт. Она ждёт тех, кто ищет правду."}],sfx:null},
      {page:8,scene:"Miya at village gate, three shurikens ready, purple energy gathers.",narration:["Выбор: остаться тенью деревни — или выйти на след убийцы."],dialogue:[{speaker:"kageSensei",text:"Если уйдёшь за ворота — обратного пути может не быть."},{speaker:"miya",text:"Тогда я проложу свой."}],sfx:null},
      {page:9,scene:"Training ring: reality tear opens briefly, shuriken storm inside purple rift.",narration:["Вспышка разрыва реальности. Сюрикены летят сквозь трещину."],dialogue:[{speaker:"yukan",text:"Она телепортировала бросок?!"},{speaker:"kageSensei",text:"Вижу. И боюсь того, кем она станет без клана."}],sfx:"KRAK-BOOM!"},
      {page:10,scene:"Cliffhanger: largest shuriken emblem on gate cracks, Miya watches.",narration:["Глава I. Дом до грома. Эмблема клана треснула — мир ещё не знает, что это начало."],dialogue:[{speaker:"miya",text:"Если правда где-то за горизонтом… я не отступлю."}],sfx:"ТИК."}
    ]
  },
  "2": {
    title: "Рана, которая не спит",
    pages: [
      {page:1,scene:"Burned ruins of shadow blade village at night, smoke and ash.",narration:["Последняя ночь. Враждебный клан сжёг деревню за один налёт."],dialogue:[{speaker:"miya",text:"Я вернулась слишком поздно."},{speaker:"renGhost",text:"Ты вернулась — значит, ещё не конец."}],sfx:null},
      {page:2,scene:"Close-up Miya's purple eyes reflecting embers, ash on gloves.",narration:["Пепел уничтоженного клана. Память на ладонях."],dialogue:[{speaker:"miya",text:"Клятва была держать линию теневых клинков."},{speaker:"miya",text:"Линию разорвали."}],sfx:null},
      {page:3,scene:"White-masked hunters walk through rubble, torches.",narration:["Охотники в масках без лиц. Они не оставляют свидетелей."],dialogue:[{speaker:"maskCaptain",text:"Последняя тень клана. Сдавай знак деревни."},{speaker:"miya",text:"Знак — в моих лезвиях. Забирай, если догонишь."}],sfx:"РРРАЗЛОМ!"},
      {page:4,scene:"Chase through burning bamboo, hunters throw nets.",narration:["Охота началась. Не на неё — на правду о брате."],dialogue:[{speaker:"maskCaptain",text:"Беги. Устанешь — и мы заберём твоё будущее."}],sfx:"WHOOSH!"},
      {page:5,scene:"Miya throws triple shuriken, pins hunter's cloak to wall.",narration:["Первый ответ боли — три лезвия быстрее слёз."],dialogue:[{speaker:"miya",text:"Ты говоришь про будущее. Я вижу твой след к Рэну."}],sfx:"ВЖУХ!"},
      {page:6,scene:"Miya kneels by fallen clan banner, Ren's katana broken in ash.",narration:["Знамя клана под ногами. Клятва — внутри."],dialogue:[{speaker:"renGhost",text:"Мы держали пост, пока верили в справедливость."},{speaker:"miya",text:"Я верю. Поэтому стою."}],sfx:null},
      {page:7,scene:"Arena dome pulses through smoke on horizon.",narration:["Арена светится сквозь пепел — как маяк для потерянных."],dialogue:[{speaker:"miya",text:"Там ответ. Или ловушка. Или след убийцы."}],sfx:null},
      {page:8,scene:"Miya loads three shurikens, purple tear energy on blades.",narration:["Последний запас клана. Каждый бросок — вычтенная секунда покоя."],dialogue:[{speaker:"miya",text:"Каждый сюрикен — обещание брату."}],sfx:null},
      {page:9,scene:"Burning dojo collapses, Miya teleports out in purple flash.",narration:["Додзё рушится. Телепорт — единственная стена."],dialogue:[{speaker:"maskCaptain",text:"Невозможно… она вырвалась из петли!"},{speaker:"miya",text:"Невозможное — моя тренировка."}],sfx:"KRAK-BOOM!"},
      {page:10,scene:"Lone figure on last standing torii gate.",narration:["Глава II. Рана, которая не спит. На воротах осталась одна тень."],dialogue:[{speaker:"miya",text:"Я последний клинок клана. Значит — я и есть стена."}],sfx:"ТИК-ТАК."}
    ]
  }
};

// chapters 3-10 inline continuation
Object.assign(chapters, {
  "3": {title:"Первый ответный удар",pages:[
    {page:1,scene:"Scorched border road, Miya tracks mask bootprints.",narration:["Граница, где деревня заканчивалась, а месть — нет."],dialogue:[{speaker:"yukan",text:"Мы нашли тебя! Я… не бросил клан."},{speaker:"miya",text:"Ты пришёл. Этого достаточно."}],sfx:null},
    {page:2,scene:"Close-up Miya jaw set, first cold anger.",narration:["Впервые злость яснее страха."],dialogue:[{speaker:"miya",text:"Нас назвали хранителями тени. Нас сделали мишенями."}],sfx:null},
    {page:3,scene:"Mask hunters emerge from purple mist with iron nets.",narration:["Безликие охотники. Сети для тех, кто бежит быстрее ветра."],dialogue:[{speaker:"maskCaptain",text:"Сдай сюрикены — и мальчик уйдёт."},{speaker:"miya",text:"Он уже не мальчик. Он — клинок."}],sfx:"ГРРР!"},
    {page:4,scene:"Diagonal fight: Miya dodges nets, throws shuriken fan.",narration:["Диагональ боя. Три лезвия — три угла смерти."],dialogue:[{speaker:"yukan",text:"Слева! Ещё двое!"},{speaker:"miya",text:"Вижу. Держи мою спину!"}],sfx:"WHOOSH!"},
    {page:5,scene:"Miya teleports behind hunter, strikes with enhanced blow.",narration:["Первый удар характера. Телепорт за спину — сигнатура клана."],dialogue:[{speaker:"miya",text:"Виси. Подумай, зачем ты охотишься на детей."}],sfx:"СТОП!"},
    {page:6,scene:"Quiet: Ren's broken katana hilt in Miya's belt.",narration:["Когда-то брат учил защищать. Она выбрала охоту."],dialogue:[{speaker:"yukan",text:"Ты всё ещё не убиваешь?"},{speaker:"miya",text:"Я забираю у них пути к отступлению. Это хуже."}],sfx:null},
    {page:7,scene:"Purple Arena rift flickers in sky.",narration:["Небо рвётся. Разлом зовёт по знаку на маске убийцы."],dialogue:[{speaker:"renGhost",text:"Туда ушёл тот, кто оставил печать Арены."}],sfx:null},
    {page:8,scene:"Purple energy coils around Miya before super.",narration:["Супер зреет. Разрыв реальности ещё не открыт — но дышит."],dialogue:[{speaker:"miya",text:"Ещё один бой — и я покажу им правду о Рэне."}],sfx:null},
    {page:9,scene:"Reality tear opens, Miya teleports through shuriken rain.",narration:["Проблеск силы: враги теряют цель в ливне лезвий."],dialogue:[{speaker:"maskCaptain",text:"Мы уже держали её!"},{speaker:"miya",text:"Держали. Теперь — снова опоздали."}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"Hunter frozen in net of her own shurikens.",narration:["Глава III. Первый ответный удар. Враг связан — мир нет."],dialogue:[{speaker:"yukan",text:"Он жив?"},{speaker:"miya",text:"Пока да. Правда ещё не решила."}],sfx:"ТИК."}
  ]},
  "4": {title:"След Арены",pages:[
    {page:1,scene:"Purple reality anomaly canyon, old battle scars.",narration:["Разлом пожирает следы. Здесь пахнет кровью и аренским песком."],dialogue:[{speaker:"miya",text:"Здесь пахнет бойцами. И ложью."}],sfx:null},
    {page:2,scene:"Arena invitation emblem carved in rift stone — killer's mark.",narration:["Приглашение Арены. Печать на камне — знак убийцы брата."],dialogue:[{speaker:"herald",text:"Кто держит след — пусть докажет на песке."},{speaker:"miya",text:"Докажу. Не ради славы — ради Рэна."}],sfx:null},
    {page:3,scene:"Stuck moments in rift: ghost fighters loop.",narration:["В воронке — застрявшие секунды чужих боёв."],dialogue:[{speaker:"miya",text:"Это не призраки деревни."},{speaker:"yukan",text:"Тогда вытащим хоть имя."}],sfx:"ВЖУУУ!"},
    {page:4,scene:"Hunt inside rift, mask hunters ambush.",narration:["Охота внутри разлома. Они знали, что она придёт."],dialogue:[{speaker:"maskCaptain",text:"Арена тебя не спасёт!"},{speaker:"miya",text:"Мне нужен тот, кто оставил печать."}],sfx:"WHOOSH!"},
    {page:5,scene:"Miya saves trapped fighter's voice from time loop with shuriken cut.",narration:["Она разрезала петлю. Голос — тоже улика."],dialogue:[{speaker:"yukan",text:"Ты вытащила крик из разлома!"},{speaker:"miya",text:"Каждый крик — ещё один след."}],sfx:"ВЖУХ!"},
    {page:6,scene:"Ren's arena token in Miya's palm.",narration:["Жетон брата. Клятва на сердце."],dialogue:[{speaker:"miya",text:"Я слушала. Теперь отвечаю."}],sfx:null},
    {page:7,scene:"Arena dome close now, gates visible.",narration:["Купол близко. Ворота откроются на рассвете турнира."],dialogue:[{speaker:"miya",text:"Ворота откроются. И я войду."}],sfx:null},
    {page:8,scene:"Rift runes under feet, path back sealed.",narration:["Руны под ногами. Путь назад в деревню закрыт."],dialogue:[{speaker:"miya",text:"Назад — только пепел."}],sfx:null},
    {page:9,scene:"Portal tears open toward Arena gates.",narration:["Портал рвётся к воротам. Юкан следует."],dialogue:[{speaker:"yukan",text:"Я иду с тобой!"},{speaker:"miya",text:"Не отставай от тени."}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"Miya steps toward Arena threshold.",narration:["Глава IV. След Арены. Если прошлое голодно… я принесу имя."],dialogue:[{speaker:"miya",text:"Убийца оставил знак. Я приду за ответом."}],sfx:"ТИК."}
  ]},
  "5": {title:"Охота начинается",pages:[
    {page:1,scene:"Crossroads of broken paths outside Arena slums.",narration:["Перекрёсток сломанных путей. Тени без хозяев."],dialogue:[{speaker:"miya",text:"Тени танцуют. Кто-то зовёт без приглашения."},{speaker:"yukan",text:"Слышу шаги безликих."}],sfx:null},
    {page:2,scene:"Mask hunter squad drops from rooftops.",narration:["Охотники разлома. Сети и кинжалы."],dialogue:[{speaker:"maskCaptain",text:"Отдай жетон брата — и мы уйдём."},{speaker:"miya",text:"Не смей близко к его памяти!"}],sfx:"КРЯСЬ!"},
    {page:3,scene:"Three ambush points, one second to decide.",narration:["Три ловушки. Одна секунда."],dialogue:[{speaker:"miya",text:"Влево — сюрикены! Я заберу их сети!"}],sfx:"WHOOSH!"},
    {page:4,scene:"Fight on rubble, hunters multiply.",narration:["Бой на обломках. Их больше с каждым углом."],dialogue:[{speaker:"yukan",text:"Они множатся!"},{speaker:"miya",text:"Урежу им завтра."}],sfx:"БАЦ!"},
    {page:5,scene:"Enhanced shuriken charge cuts through iron net.",narration:["Усиленный бросок. Сеть рвётся как паутина."],dialogue:[{speaker:"maskHunter",text:"Моя сеть…!"},{speaker:"miya",text:"Сталь ест всё. Кроме правды."}],sfx:"ШШШШ!"},
    {page:6,scene:"Quiet between strikes, Miya hesitates over downed hunter.",narration:["Тишина между ударами."],dialogue:[{speaker:"yukan",text:"Если месть сильнее… зачем справедливость?"},{speaker:"miya",text:"Потому что брат верил в выбор."}],sfx:null},
    {page:7,scene:"Two mysterious silhouettes at edge: tree branches and golden wings — foreshadow trio.",narration:["На краю кадра — корни и свет. Приглашения без имён."],dialogue:[{speaker:"miya",text:"Кто вы?"},{speaker:"shadowVoice",text:"Не принимай. Ещё рано."}],sfx:null},
    {page:8,scene:"Last three shurikens in hand.",narration:["Последний запас. Каждое лезвие — обещание."],dialogue:[{speaker:"miya",text:"Каждый бросок — ещё один шаг к воротам."}],sfx:null},
    {page:9,scene:"Reality tear wave repels hunter squad.",narration:["Волна разрыва. Охотники отброшены в туман."],dialogue:[{speaker:"maskCaptain",text:"Мы победили в будущем!"},{speaker:"miya",text:"Живи там. Здесь — мой след."}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"Silhouettes of tree and wings watch from distance.",narration:["Глава V. Охота начинается. Кто-то ждёт у ворот. Не сегодня."],dialogue:[{speaker:"miya",text:"Тени и свет… мы встретимся позже."}],sfx:"ТИК."}
  ]},
  "6": {title:"Цена силы",pages:[
    {page:1,scene:"Hall of mirrors in abandoned ninja shrine.",narration:["Зал зеркал. Сколько Мий здесь — столько сожалений."],dialogue:[{speaker:"miya",text:"Сколько меня здесь?"},{speaker:"renGhost",text:"Столько, сколько ночей без сна."}],sfx:null},
    {page:2,scene:"Reflections: killer Miya, coward Miya, dead Miya.",narration:["Убийца. Трус. Мёртвая геройня."],dialogue:[{speaker:"miya",text:"Кто выбирает — я или отражение?"}],sfx:null},
    {page:3,scene:"Mirror crack spreads, trap runes.",narration:["Трещина на вере. Ловушка охотников."],dialogue:[{speaker:"yukan",text:"Не смотри! Зеркала — ловушка!"},{speaker:"miya",text:"Я уже внутри."}],sfx:"ТРЕСК!"},
    {page:4,scene:"Mirror shards animate as mask faces.",narration:["Осколки оживают. Маски без лиц."],dialogue:[{speaker:"miya",text:"Вы — мой страх стать такими же."}],sfx:"ДЗЫНЬ!"},
    {page:5,scene:"Miya throws shuriken at mirror verdict.",narration:["Скорость опережает сомнение."],dialogue:[{speaker:"miya",text:"Стреляю в приговор мести."}],sfx:"ВЖУХ!"},
    {page:6,scene:"Kage-sensei's last letter in ash.",narration:["Письмо сэнсэя: «Правосудие не равно одиночеству»."],dialogue:[{speaker:"miya",text:"Прости. Не могу только ждать."},{speaker:"renGhost",text:"Он бы действовал раньше."}],sfx:null},
    {page:7,scene:"Arena heart beats under floor tiles.",narration:["Сердце Арены бьётся под полом."],dialogue:[{speaker:"herald",text:"Докажи, что выбор существует."}],sfx:"ТУДУМ."},
    {page:8,scene:"Miya's eyes dim briefly after overusing teleport.",narration:["Цена силы. Тело платит за разрывы."],dialogue:[{speaker:"yukan",text:"Твои глаза тускнеют!"},{speaker:"miya",text:"На миг. Потом снова охота."}],sfx:null},
    {page:9,scene:"Mirrors shatter, Miya stands in real light.",narration:["Зеркала падают. Она выбирает жить."],dialogue:[{speaker:"miya",text:"Я выбираю справедливость. Значит жива."}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"Miya walks away from shrine toward Arena.",narration:["Глава VI. Цена силы. Следи, но не решай за меня."],dialogue:[{speaker:"miya",text:"Месть зовёт громче. Я отвечу тише."}],sfx:"ТИК."}
  ]},
  "7": {title:"Ворота открыты",pages:[
    {page:1,scene:"Grand Arena tournament gates, shuriken emblem on banner.",narration:["Ворота турнира. Имя и печать — или разлом."],dialogue:[{speaker:"herald",text:"Имя и печать. Или уходи."},{speaker:"miya",text:"Печать брата — здесь."}],sfx:null},
    {page:2,scene:"Entry seal flashes purple on Miya's hand.",narration:["Знак допуска вспыхивает на ладони."],dialogue:[{speaker:"yukan",text:"Ты правда идёшь…"},{speaker:"miya",text:"Кто-то должен назвать убийцу Рэна."}],sfx:null},
    {page:3,scene:"Mechanical blade gauntlet guardian — must pass blade corridor.",narration:["Страж-механизм. Лезвия как дождь."],dialogue:[{speaker:"herald",text:"Пройди коридор клинков."},{speaker:"miya",text:"Пройду в своём ритме."}],sfx:"ЖЖЖ!"},
    {page:4,scene:"Miya teleports through blade corridor in purple flash.",narration:["Телепорт сквозь лезвия. Секунда — её дорога."],dialogue:[{speaker:"miya",text:"Твоя секунда — моя тропа."}],sfx:"ВЖУХ!"},
    {page:5,scene:"Pause before crowd roar, Yukan worried.",narration:["Пауза перед бурей."],dialogue:[{speaker:"yukan",text:"Если что — беги."},{speaker:"miya",text:"Ты войдёшь сам. Я — на песок."}],sfx:null},
    {page:6,scene:"Crowd behind gates, arena chants.",narration:["Толпа за дверью. Арена ждёт историю."],dialogue:[{speaker:"herald",text:"Арена ждёт тень живого леса!"}],sfx:"РРРА!"},
    {page:7,scene:"Lock of compressed shadow on gate.",narration:["Замок из сжатой тени. Только клинок откроет."],dialogue:[{speaker:"miya",text:"Откройся. Или вернусь через разлом."}],sfx:null},
    {page:8,scene:"Entry flash, Miya and Yukan inside arena tunnel.",narration:["Вспышка входа. Запах песка и крови."],dialogue:[{speaker:"yukan",text:"Мы внутри!"},{speaker:"miya",text:"Не отступать."}],sfx:"KRAK-BOOM!"},
    {page:9,scene:"Sand floor remembers fallen fighters.",narration:["Песок помнит каждого. Толпа — твой судья."],dialogue:[{speaker:"herald",text:"Толпа — твой судья!"}],sfx:null},
    {page:10,scene:"Miya steps on arena sand first time.",narration:["Глава VII. Ворота открыты. Напишите что угодно — я прочитаю правду."],dialogue:[{speaker:"miya",text:"Рэн, смотри. Я на песке."}],sfx:"ТИК."}
  ]},
  "8": {title:"Бой под прожекторами",pages:[
    {page:1,scene:"First official match under spotlights, Miya vs three mask hunters.",narration:["Первый официальный матч. На песке — тень против трёх безликих."],dialogue:[{speaker:"herald",text:"На песке — Мия против трёх охотников!"},{speaker:"miya",text:"Трое? Три сюрикена — три ответа."}],sfx:null},
    {page:2,scene:"Silence before gong, fierce close-up.",narration:["Тишина перед гонгом."],dialogue:[{speaker:"maskCaptain",text:"На арене ты не спрячешься в тени."},{speaker:"miya",text:"Мне не нужна тень. Нужен честный удар."}],sfx:null},
    {page:3,scene:"Three hunters enter with charged nets.",narration:["Три охотника. Сети заряжены."],dialogue:[{speaker:"yukan",text:"С трибуны: их супер готов!"},{speaker:"miya",text:"Слышу. Считаю лезвия."}],sfx:"ГОНГ!"},
    {page:4,scene:"Sand flies, diagonal brawl, shuriken fan.",narration:["Песок взлетает. Три лезвия — веер."],dialogue:[{speaker:"miya",text:"Влево — сюрикен! Вправо — телепорт!"},{speaker:"maskCaptain",text:"Она говорит с боем, как с музыкой!"}],sfx:"БАЦ!"},
    {page:5,scene:"Triple shuriken counters hunter combo.",narration:["Три броска — три ответа. Центральный и боковые."],dialogue:[{speaker:"miya",text:"Ты ударил? Нет. Ты только вспомнил промах."}],sfx:"WHOOSH!"},
    {page:6,scene:"Break between rounds, low stamina.",narration:["Перерыв. Силы на исходе."],dialogue:[{speaker:"yukan",text:"Смени тактику!"},{speaker:"miya",text:"Тактика — разрыв за спиной."}],sfx:null},
    {page:7,scene:"Crowd demands finale.",narration:["Толпа требует финала."],dialogue:[{speaker:"herald",text:"Толпа требует финала!"}],sfx:"РРРА!"},
    {page:8,scene:"Super charge: Reality Tear opens.",narration:["Разрыв реальности. Радиус телепорта — вся арена."],dialogue:[{speaker:"miya",text:"Входите в мой след. Выход — за вашей спиной."}],sfx:"ВЖУУУ!"},
    {page:9,scene:"SIGNATURE: teleport behind enemy in shuriken rain, slow debuff.",narration:["Телепорт за спину врагу среди дождя сюрикенов. Сигнатура Мии."],dialogue:[{speaker:"maskCaptain",text:"Мы… уже держали её!"},{speaker:"miya",text:"Держали. Сидите снова."}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"Scoreboard impossible victory.",narration:["Глава VIII. Бой под прожекторами. Победа — ещё не имя убийцы."],dialogue:[{speaker:"herald",text:"Победа!"},{speaker:"miya",text:"Пока дышу — жива. Рэн, я ближе."}],sfx:"ТИК."}
  ]},
  "9": {title:"Союз из трёх искр",pages:[
    {page:1,scene:"Arena backstage: purple mist, roots through floor, golden light — SHARED trio silhouette scene.",narration:["За кулисами. Буря теней, корней и света. Три искры — ещё без имён."],dialogue:[{speaker:"miya",text:"Кто-то спорит о цене правосудия."},{speaker:"yukan",text:"Там… тень дерева. И крылья."}],sfx:null},
    {page:2,scene:"Tree-antler SILHOUETTE and winged SILHOUETTE — NOT full faces. SHARED composition.",narration:["Силуэт корней. Силуэт света. Трио ещё не сложилось."],dialogue:[{speaker:"miya",text:"Вы тоже ищете справедливость?"},{speaker:"shadowVoice",text:"Мы ищем цену, которую можно заплатить."}],sfx:null},
    {page:3,scene:"Iron-net justice hunters attack all three silhouettes. SHARED enemy wave.",narration:["Общий враг. Охотники за «слишком мягким» правосудием."],dialogue:[{speaker:"miya",text:"Назад! Я разрежу сети!"},{speaker:"shadowVoice",text:"Держи линию. Корни удержат."}],sfx:"БАЦ!"},
    {page:4,scene:"Triangle protective circle: purple shadow, green roots, gold light. SHARED.",narration:["Треугольник на полу. Три пути — одна линия."],dialogue:[{speaker:"miya",text:"Три разных ответа. Один враг."},{speaker:"yukan",text:"Они… помогают?"}],sfx:"WHOOSH!"},
    {page:5,scene:"Roots and wings hold line while Miya strikes — silhouettes only. SHARED.",narration:["Корни и свет держат. Тень бьёт."],dialogue:[{speaker:"miya",text:"Когда покажете лица — запомню."},{speaker:"shadowVoice",text:"На десятой главе, тень."}],sfx:null},
    {page:6,scene:"Quiet vow exchange with silhouettes. SHARED.",narration:["Клятва без имён: спорить о правосудии — не убивать друг друга."],dialogue:[{speaker:"miya",text:"Если тень, корни и свет сойдутся…"},{speaker:"shadowVoice",text:"…встретимся на песке. Не раньше."}],sfx:null},
    {page:7,scene:"Sky triangle: shuriken, oak leaf, angel wing symbols. SHARED.",narration:["Небо — треугольник знаков. Толпа не видит."],dialogue:[{speaker:"herald",text:"Что за знак? Арена молчит…"},{speaker:"miya",text:"Пусть молчит. Ещё рано."}],sfx:null},
    {page:8,scene:"Combined shuriken rain + root surge + light threads. SHARED action.",narration:["Три искры бьют разом. Сети рвутся."],dialogue:[{speaker:"miya",text:"Союзники — чтобы выбрать, а не чтобы мстить."}],sfx:"KRAK-BOOM!"},
    {page:9,scene:"Triangle mark burned into arena sand. SHARED.",narration:["На песке — знак трёх. Имена потом."],dialogue:[{speaker:"yukan",text:"Кто они?"},{speaker:"miya",text:"Те, кто придёт в финале."}],sfx:null},
    {page:10,scene:"Silhouettes depart three ways into mist, roots, light. SHARED.",narration:["Глава IX. Союз из трёх искр. Союз без лиц — но с обещанием."],dialogue:[{speaker:"miya",text:"До финала. Там — настоящие лица."}],sfx:"ТИК."}
  ]},
  "10": {title:"Легенда на табло",gameCharacters:true,pages:[
    {page:1,scene:"Arena legend ceremony, golden scoreboard. SHARED wide shot.",narration:["Финал. Табло — алтарь имён. Трио «Тень живого леса»."],dialogue:[{speaker:"herald",text:"Мия! Арена зовёт союзников!"},{speaker:"miya",text:"Пора показать лицо правосудия."}],sfx:null},
    {page:2,scene:"Silven steps from living roots — match silven_skin1.png FULL design. SHARED entrance.",narration:["Из корней — Сильвен. Лес, отданный сердцу дуба."],dialogue:[{speaker:"silven",text:"Ты рубишь тенью. Я сажаю жизнь."},{speaker:"miya",text:"Ты из силуэта на девятой главе."}],sfx:null},
    {page:3,scene:"Lumina descends on golden threads — match lumina_skin1.png FULL design. SHARED entrance.",narration:["Люмина. Свет, который не убивает — связывает."],dialogue:[{speaker:"lumina",text:"Месть жжёт. Свет лечит выбор."},{speaker:"miya",text:"Тень, корни и свет. Трио собрано."}],sfx:null},
    {page:4,scene:"Trio on arena sand vs iron-net hunters — SAME wide composition SHARED.",narration:["Трио впервые целиком на песке. Цена правосудия — общий вопрос."],dialogue:[{speaker:"miya",text:"Без убийства — можно?"},{speaker:"silven",text:"Лес не просит ненависти."},{speaker:"lumina",text:"Выберем вместе."}],sfx:"ГОНГ!"},
    {page:5,scene:"Team fight: Reality Tear + Life Tree + Golden Cage. SHARED combo layout.",narration:["Разрыв. Древо жизни. Золотая клетка. Три ответа — один бой."],dialogue:[{speaker:"miya",text:"Мой след!"},{speaker:"silven",text:"Мой корень!"},{speaker:"lumina",text:"Наш свет!"}],sfx:"KRAK-BOOM!"},
    {page:6,scene:"Quiet on arena edge — debate justice. SHARED.",narration:["Пауза. Справедливость спорит с местью."],dialogue:[{speaker:"miya",text:"Арена — не клетка. Допрос."},{speaker:"silven",text:"Корни помнят пепел."},{speaker:"lumina",text:"Свет не прощает — он связывает."}],sfx:null},
    {page:7,scene:"Scoreboard engraves SHADOW GROVE trio symbol. SHARED.",narration:["Табло вспыхивает. Знак трёх остаётся."],dialogue:[{speaker:"herald",text:"Легенда записана!"},{speaker:"miya",text:"Рэн, смотри. Я не одна."}],sfx:null},
    {page:8,scene:"Night sky: burned forest shadow, oak, chapel light merge. SHARED.",narration:["Небо: выжженный лес, дуб, часовня. Три пути сходятся."],dialogue:[{speaker:"renGhost",text:"Ты сделала то, чего боялась — попросила помощи."},{speaker:"miya",text:"То, что требовал выбор."}],sfx:null},
    {page:9,scene:"Final splash trio vs hunter wave. SHARED victory layout.",narration:["Финальный всплеск. Тень, корни, свет — одна легенда."],dialogue:[{speaker:"miya",text:"Каждый бросок — мой выбор!"},{speaker:"silven",text:"Каждое семя — мой ответ!"},{speaker:"lumina",text:"Каждый луч — наша глава!"}],sfx:"KRAK-BOOM!"},
    {page:10,scene:"End card: Miya walks forward, Silven and Lumina behind. SHARED.",narration:["Глава X. Легенда на табло. Комикс дышит — потому что правда ещё впереди."],dialogue:[{speaker:"miya",text:"Следующий след — не конец. Начало."}],sfx:"ТИК."}
  ]}
});

const script = {
  brawlerId: "miya",
  brawlerName: "Мия",
  lore: "Мия выросла в скрытой деревне теневых клинков. После уничтожения клана она клянётся вершить правосудие. Три сюрикена без промаха, телепорт за спину врагу.",
  skinRef: "public/dev-notes/brawler-skins/miya_skin1.png",
  trioId: "shadow-grove",
  trioOthers: ["silven", "lumina"],
  rules: {
    format: "VERTICAL PORTRAIT 2:3 tall comic page",
    speech: "No character name prefixes in balloons. Use cream/yellow narration boxes.",
    gameBrawlersFromChapter: 10,
    chapter9SilhouettesOnly: true
  },
  npcs,
  cover: {
    prompt: "finished full-color comic book cover, vertical 2:3 poster; hero Мия female ninja purple hair red ribbon, throwing three shurikens fan pattern, hidden shadow blade village burning in background memory, purple shadows and reality tears, palette #7B2FBE #4A0080 #FF1744, title МИЯ in Russian, dramatic pose, NO speech balloons, match miya_skin1.png"
  },
  chapters
};

const outPath = path.join("scripts/comic-generation/miya-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
