import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = {
  "luca": "Лука — брат Виттории: тёмные волосы, белая рубашка с кровью, погиб у ворот поместья",
  "marchesa": "Маркиза — мать-вампир в портрете: бархат, жемчуг, глаза как у дочери",
  "harpoonCaptain": "Капитан гarpунщиков — шрам через бровь, серебряная арбалетная команда",
  "sisterClara": "Сестра Клара — монахиня-целительница: без капюшона, мягкий голос, знает проклятие",
  "gin": "Джин — диктор Арены",
  "moonPriest": "Жрец луны — маска полумесяца, говорит загадками"
};

const chapters = {
  "1": {
    "title": "Бархатные залы",
    "pages": [
      {
        "page": 1,
        "scene": "Wide: vampire manor ballroom, chandeliers, velvet curtains.",
        "narration": [
          "Бал зала поместья. Бархат и хрусталь."
        ],
        "dialogue": [
          {
            "speaker": "marchesa",
            "text": "Виттория, кастет. Для церемонии, не для драки."
          },
          {
            "speaker": "vittoria",
            "text": "Церемония. Это когда никто не умирает."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Luca teaches parry; spiked gauntlet wrapped in silk.",
        "narration": [
          "Лука учит парировать. Кастет в шёлке."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Шипы смотрят наружу. Защита, не жажда."
          },
          {
            "speaker": "vittoria",
            "text": "А если жажда придёт сама?"
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Moonlit garden: siblings race on colonnade.",
        "narration": [
          "Лунный сад. Гонка по колonnade."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Первый до фонтана. Без клыков!"
          },
          {
            "speaker": "vittoria",
            "text": "Обещаю. Сегодня."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Portrait hall: ancestors with red eyes.",
        "narration": [
          "Галерея предков."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Мы. Не монстры. Пока кормимся с согласия."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Hunter scouts seen on hill — silver glint.",
        "narration": [
          "На холме — блеск серебра."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Охотники. Раньше, чем думали."
          },
          {
            "speaker": "vittoria",
            "text": "Закрой ворота. Я предупрежу мать."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Marchesa drinks synthetic wine — refuses living blood.",
        "narration": [
          "Маркиза пьёт вино без крови."
        ],
        "dialogue": [
          {
            "speaker": "marchesa",
            "text": "Мы меняемся. Мир должен увидеть."
          },
          {
            "speaker": "vittoria",
            "text": "Мир смотрит арбалетами."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Vittoria sharpens gauntlet spikes — ritual.",
        "narration": [
          "Ритуал заточки шипов."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Память о брате. Острее клыков."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Letter: Arena invites «Blood Moon» house survivors.",
        "narration": [
          "Письмо Арены — выжившим рода."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Ловушка?"
          },
          {
            "speaker": "vittoria",
            "text": "Приглашение с запахом крови. Всё как дома."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Storm clouds; moon ring visible early.",
        "narration": [
          "Кольцо луны рано."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "Луна смотрит раньше срока."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: harpoon bolt embeds in gate.",
        "narration": [
          "Гarpун в воротах."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Они здесь!"
          },
          {
            "speaker": "vittoria",
            "text": "За мной. Внутрь!"
          }
        ],
        "sfx": "КРАК!"
      }
    ]
  },
  "2": {
    "title": "Луна и брат",
    "pages": [
      {
        "page": 1,
        "scene": "Siege: silver harpoons rain on manor walls.",
        "narration": [
          "Осада. Серебряные гarpуны."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Последний вампирский гнездовой. Сдайтесь!"
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 2,
        "scene": "Luca blocks gate; gauntlet passes to Vittoria.",
        "narration": [
          "Лука у ворот. Кастет — сестре."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Беги через кrypt!"
          },
          {
            "speaker": "vittoria",
            "text": "Не без тебя!"
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Slow motion: Luca spread arms — harpoon through chest.",
        "narration": [
          "Лука раскинул руки. Гarpун в груди."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Живи… лечи…"
          },
          {
            "speaker": "vittoria",
            "text": "ЛУКА!!!"
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 4,
        "scene": "Manor burns; Vittoria carries brother toward crypt.",
        "narration": [
          "Пожар. Несёт брата к crypt."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Ещё один укус… моей… не твоей…"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Luca dies; blood moon stain on sky.",
        "narration": [
          "Лука мёртв. Кровавая луна на небе."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Проклятие проснулось без спроса."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Hunters enter; Marchesa falls off-panel.",
        "narration": [
          "Охотники входят. Маркиза падает за кadrom."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Дочь осталась. Главный трофей."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Vittoria bites first hunter — horror at herself.",
        "narration": [
          "Первый укус. Ужас."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Я… сделала… то, чего боялась…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Escape through crypt tunnel to moors.",
        "narration": [
          "Побег через туннель."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Кастет помнишь, брат. Я. Помню тебя."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Dawn impossible for vampire — she hides in ash.",
        "narration": [
          "Зола вместо рассвета."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Дитя… если услышишь… иди к Арене…"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Wide: lone figure on moor, crimson eyes.",
        "narration": [
          "Глава II. Одна на болоте."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Лечить… не кусать… обещала…"
          }
        ],
        "sfx": null
      }
    ]
  },
  "3": {
    "title": "Шипы на память",
    "pages": [
      {
        "page": 1,
        "scene": "Vittoria wraps gauntlet with Luca ribbon.",
        "narration": [
          "Лента брата на кastete."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Шипы. Для памяти. Клыки. Для выживания."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback: Luca built gauntlet against hunters.",
        "narration": [
          "Память: кастет против охотников."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Чтобы не кусать в ярости."
          },
          {
            "speaker": "vittoria",
            "text": "Ярость всё равно пришла."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Harpoon squad tracks blood trail.",
        "narration": [
          "След крови."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Она молодая. Голодная. Легкая."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Vittoria ambush — spiked punch disarms, no kill.",
        "narration": [
          "Кastet обезоруживает."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Живи. Расскажи, где капитан."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Clara's clinic: forbidden healing lore.",
        "narration": [
          "Клиника Клары."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Кровь можно вернуть. Если отдать свою силу."
          },
          {
            "speaker": "vittoria",
            "text": "Силы мало. Желание. Есть."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "First failed heal — patient worsens.",
        "narration": [
          "Провал исцеления."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Проклятие сильнее рук…"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Moon Priest offers arena trial under blood moon.",
        "narration": [
          "Жрец: испытание под луной."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "На песке луна честнее серебра."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Vittoria rejects random bite — hunts only hunters.",
        "narration": [
          "Отказ от случайной жертвы."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Кусаю только тех, кто принёс серебро."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Arena dome mirrors moon — call accepted.",
        "narration": [
          "Купол отражает луну."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Ночь гибели семьи. Повторится. Или сломается."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: silver net dropped from cliff.",
        "narration": [
          "Серебряная сеть."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Ловим луну!"
          }
        ],
        "sfx": "WHOOSH!"
      }
    ]
  },
  "4": {
    "title": "Луна над куполом",
    "pages": [
      {
        "page": 1,
        "scene": "Arena lower tier: moon reflection on sand.",
        "narration": [
          "Луна на песке."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Вампирша с кastetом! Сенсация!"
          },
          {
            "speaker": "vittoria",
            "text": "Сенсация — не имя. Имя потом."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Registration: Blood Moon heir listed.",
        "narration": [
          "Регистрация: наследница Кровавой луны."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Наследница пепла."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Harpoon Captain recognized — crowd boos.",
        "narration": [
          "Капитан узнан. Свист."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Она монстр!"
          },
          {
            "speaker": "vittoria",
            "text": "Монстр. Тот, кто стрелял в спину брату."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Clara sends healing herbs via messenger.",
        "narration": [
          "Травы от Клары."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Пробуй после боя, не до."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Vittoria saves fallen child from rigging — bite none.",
        "narration": [
          "Спасает ребёнка. Без укуса."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Сегодня — кастет. Не клыки."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Moon Priest marks her palm — crimson crescent.",
        "narration": [
          "Полумесяц на ладони."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "Луна видит намерение."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night rooftop: smoke silhouette watches.",
        "narration": [
          "Дымовой силуэт на крыше."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Ещё один беглец?"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Wind silhouette on adjacent tower.",
        "narration": [
          "Силуэт ветра."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Два. Не охотники."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Harpoon guild posts bounty on trio rumor.",
        "narration": [
          "Награда за триo."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Луна, дым и ветер. Миф!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: moon eclipses arena light.",
        "narration": [
          "Затмение над куполом."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Луна зовёт. Я отвечу."
          }
        ],
        "sfx": "ТИК…"
      }
    ]
  },
  "5": {
    "title": "Серебряные гarpуны",
    "pages": [
      {
        "page": 1,
        "scene": "Ambush alley: harpoons from rooftops.",
        "narration": [
          "З засada в переулке."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Без дuelей!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 2,
        "scene": "Gauntlet deflects silver — sparks crimson.",
        "narration": [
          "Кastet отбивает серебро."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Серебро режет. Память. Держит."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Vittoria disarms captain — spares.",
        "narration": [
          "Обезоружила капитана."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Расскажи гильдии: я на песке."
          },
          {
            "speaker": "harpoonCaptain",
            "text": "Толпа…"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Clara kidnapped — note in blood ink.",
        "narration": [
          "Клару похитили."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "За сестру — ко мне. За Клару — через меня."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Arena forbids hunter intrusion — rare rule.",
        "narration": [
          "Арена запрещает охотникам вход."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Пact крови и песка!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Vittoria trains heal on lab rat — partial success.",
        "narration": [
          "Частичное исцеление на кryse."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Капля жизни без кражи… возможно…"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Blood Moon super flicker — eyes glow red.",
        "narration": [
          "Проблеск супера."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "Проклятие и дар. Одна монета."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Hunter guild master arrives with silver cannon.",
        "narration": [
          "Серебряная пушка."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Для зверя. Оружие. Я. Память брата."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Smoke capsule saves Vittoria — unknown ally.",
        "narration": [
          "Дымовая капсула. Неизвестный союзник."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Кто?"
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger: Clara message — meet at gates.",
        "narration": [
          "Запiskа: у ворот."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Ловушка. Иду."
          }
        ],
        "sfx": null
      }
    ]
  },
  "6": {
    "title": "Кровь и исцеление",
    "pages": [
      {
        "page": 1,
        "scene": "Mirror crypt: Vittoria sees healer self.",
        "narration": [
          "Зеркало: она целительница."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Если смогу…"
          },
          {
            "speaker": "luca",
            "text": "Голос памяти: ты уже спасаешь."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback Luca: «Heal when moon sets».",
        "narration": [
          "Память: «Лечи, когда луна сядет»."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Клыки. Ночь. Ладони. Рассвет."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Clara bound at gates; Vittoria chooses save over duel.",
        "narration": [
          "Клара у ворот. Выбор спасения."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Бой подождёт. Сестра. Нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Partial heal Clara — Vittoria collapses from cost.",
        "narration": [
          "Исцеление. Цена — слабость."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Ты… отдала…"
          },
          {
            "speaker": "vittoria",
            "text": "Долг…"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Crowd sees heal — opinion splits.",
        "narration": [
          "Толпа видит исцеление."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Вампир… лечит?!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Inner debate: hunger vs oath.",
        "narration": [
          "Голод против клятвы."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Кусать легко. Лечить страшно."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Moon Priest: curse tied to arena heart.",
        "narration": [
          "Проклятие связано с сердцем Арены."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "На песке. Выбор формы."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Vittoria vows no kill on sand.",
        "narration": [
          "Клятва: без убийств на песке."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Лука. Смотри."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Hunter master laughs — accepts duel.",
        "narration": [
          "Мaster принимает duel."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Убью на глазах у всех!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: crimson moon sigil on sand.",
        "narration": [
          "Знак луны на песке."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Цена силы. Быть видимой."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Вампир у ворот",
    "pages": [
      {
        "page": 1,
        "scene": "Gates open: Blood Moon banner.",
        "narration": [
          "Знамя Кровавой луны."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Охотник против наследницы!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Vittoria enters — no cape, gauntlet only.",
        "narration": [
          "Без плаща. Только кastet."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Не драма. Долг."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Clara in stands — prays.",
        "narration": [
          "Клара на трибунах."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Ладони, не клыки…"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Gate blades; Vittoria slides under — grace.",
        "narration": [
          "Под лезвиями — грация."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Брат учил: низко. Безопасно."
          }
        ],
        "sfx": "ЖЖЖ!"
      },
      {
        "page": 5,
        "scene": "Hunter master silver whip; gauntlet catches.",
        "narration": [
          "Кastet ловит кнут."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Серебро не помнит лицо брата. Я. Помню."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Crowd chant split — monster vs martyr.",
        "narration": [
          "Толпа расколота."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Тишина!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Moon Priest rings bell — duel sacred.",
        "narration": [
          "Священный поединок."
        ],
        "dialogue": [
          {
            "speaker": "moonPriest",
            "text": "Кровь на песке. Свидетель."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Vittoria sees Airin silhouette in smoke rafters.",
        "narration": [
          "Силуэт Айрин в дыме."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Шторм близко…"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Gong for chapter 8 official.",
        "narration": [
          "Гонг главы VIII."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Луна. Не подведи."
          }
        ],
        "sfx": "ГОНГ!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger: eyes glow crimson.",
        "narration": [
          "Глаза вспыхивают."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Завтра. Правда."
          }
        ],
        "sfx": null
      }
    ]
  },
  "8": {
    "title": "Кastet под луной",
    "pages": [
      {
        "page": 1,
        "scene": "Sand ring under full blood moon.",
        "narration": [
          "Полная кровавая луна."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Бой!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Master harpoon vs gauntlet flurry.",
        "narration": [
          "Гarpун против кasteta."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Каждый шип. Имя семьи."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 3,
        "scene": "Super Blood Moon: heal on hit, speed surge.",
        "narration": [
          "Супер: лечение от ударов."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Она… сильнее!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Vittoria refuses killing bite — wins by disarm.",
        "narration": [
          "Победа обезоруживанием."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Живи. Расскажи, что монстр лечил."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Crowd silence then roar.",
        "narration": [
          "Тишина. Рёв."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Победа Виттории!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Hunter guild exiled from arena.",
        "narration": [
          "Гильдия изгнана."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Ты… пожалела…"
          },
          {
            "speaker": "vittoria",
            "text": "Пожалела бы, если убила."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Clara embraces — careful.",
        "narration": [
          "Осторожные объятия."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Ладони… тёплые…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Moon sets — Vittoria stands in dawn shade.",
        "narration": [
          "Рassvet в тени."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Ещё не рассвет для меня. Ближе."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Luca vision nods.",
        "narration": [
          "Видение Луки кивает."
        ],
        "dialogue": [
          {
            "speaker": "luca",
            "text": "Лечи дальше."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: storm trio mark on scoreboard.",
        "narration": [
          "Знак триo на табло."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Триo ждёт."
          }
        ],
        "sfx": null
      }
    ]
  },
  "9": {
    "title": "Дым, ветер, луна",
    "pages": [
      {
        "page": 1,
        "scene": "Backstage: crimson fog, propeller shadow.",
        "narration": [
          "Багровый туман. Тень пропеллера."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Снова охота?"
          },
          {
            "speaker": "smokeSilhouette",
            "text": "Союз. Не охота."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "SILHOUETTE: goggles, smoke trail — NOT full face.",
        "narration": [
          "Силуэт с очками и дымом."
        ],
        "dialogue": [
          {
            "speaker": "smokeSilhouette",
            "text": "Я спасаю даже врагов."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "SILHOUETTE: wind dress tornado feet — NOT full face.",
        "narration": [
          "Силуэт ветра."
        ],
        "dialogue": [
          {
            "speaker": "windSilhouette",
            "text": "Я одна. Пока не здесь."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Harpoon remnant attack; trio defends.",
        "narration": [
          "Остатки охотников."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Луна держит центр!"
          }
        ],
        "sfx": "БАЦ!"
      },
      {
        "page": 5,
        "scene": "Triangle: crimson, grey, silver.",
        "narration": [
          "Треугольник."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Проклятие не определяет союз."
          },
          {
            "speaker": "smokeSilhouette",
            "text": "Второй шанс. Общий."
          },
          {
            "speaker": "windSilhouette",
            "text": "И одиночество. Общий враг."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Combo: gauntlet + smoke + tornado.",
        "narration": [
          "Комбо."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Невозможно!"
          },
          {
            "speaker": "vittoria",
            "text": "Луна так решила."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 7,
        "scene": "Vow at moonrise.",
        "narration": [
          "Клятва."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "На десятой. Лица."
          },
          {
            "speaker": "smokeSilhouette",
            "text": "И правда."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Sky: crescent, propeller, tornado.",
        "narration": [
          "Знаки."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Буря кровавой луны — слышала."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Silhouettes depart.",
        "narration": [
          "Уход."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": ""
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: Vittoria heals hunter's scratch.",
        "narration": [
          "Лечит царапину охотника."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Только начало."
          }
        ],
        "sfx": "ТИК…"
      }
    ]
  },
  "10": {
    "title": "Клятва без укуса",
    "pages": [
      {
        "page": 1,
        "scene": "Finale: Storm Moon trio call.",
        "narration": [
          "Финал триo."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Айрин! Зефирин! Виттория!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: Airin lands — match airin_skin1.png.",
        "narration": [
          "Айрин — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "airin",
            "text": "Луна и дым. Странная эскадрилья."
          },
          {
            "speaker": "vittoria",
            "text": "Лучшая."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: Zephyrin — match zephyrin_skin1.png.",
        "narration": [
          "Зефирин."
        ],
        "dialogue": [
          {
            "speaker": "zephyrin",
            "text": "Кто остановит ветер?"
          },
          {
            "speaker": "vittoria",
            "text": "Тот, кто не боится упасть."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Trio vs hunter remnant — FULL faces.",
        "narration": [
          "Трое на песке."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Луна!"
          },
          {
            "speaker": "airin",
            "text": "Дым!"
          },
          {
            "speaker": "zephyrin",
            "text": "Вихрь!"
          }
        ],
        "sfx": "ГОНГ!"
      },
      {
        "page": 5,
        "scene": "Combo supers.",
        "narration": [
          "Комбо."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Кровавая луна!"
          },
          {
            "speaker": "airin",
            "text": "Эвакуация!"
          },
          {
            "speaker": "zephyrin",
            "text": "Неуязвимость!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 6,
        "scene": "Vittoria heals Clara in crowd mid-battle.",
        "narration": [
          "Исцеление Клары."
        ],
        "dialogue": [
          {
            "speaker": "sisterClara",
            "text": "Получилось…"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunter captain surrenders silver.",
        "narration": [
          "Капитан сдаёт серебро."
        ],
        "dialogue": [
          {
            "speaker": "harpoonCaptain",
            "text": "Лечи… меня…"
          },
          {
            "speaker": "vittoria",
            "text": "Кastet. Не клыки."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Scoreboard legend.",
        "narration": [
          "Табло."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Записано!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Night: blood moon fades pink.",
        "narration": [
          "Луна розовеет."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Лечить… получается…"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "End card: trio under moon, gauntlet raised.",
        "narration": [
          "Конец X."
        ],
        "dialogue": [
          {
            "speaker": "vittoria",
            "text": "Лука. Клятва без укуса."
          },
          {
            "speaker": "airin",
            "text": "Рядом."
          },
          {
            "speaker": "zephyrin",
            "text": "До штиля."
          }
        ],
        "sfx": "ЛУНА…"
      }
    ]
  }
};

const script = {
  brawlerId: "vittoria",
  brawlerName: "Виттория",
  lore: "Виттория — последняя из вампирского рода, уничтоженного охотниками. Она носит кастет с шипами не для убийства, а как память о брате, который заслонил её собой. Кровавая луна — её проклятие и благословение: чем больше жизней она забирает, тем дольше может сражаться. Но она мечтает лишь о том, чтобы однажды лечить, а не кусать.",
  skinRef: "public/dev-notes/brawler-skins/vittoria_skin1.png",
  trioId: "storm-moon",
  trioOthers: ["airin","zephyrin"],
  rules: {
  "format": "VERTICAL PORTRAIT 2:3 tall comic page",
  "speech": "No character name prefixes in balloons. Use cream/yellow narration boxes.",
  "gameBrawlersFromChapter": 10,
  "chapter9SilhouettesOnly": true,
  "bannedPhrases": [
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
    "три секунды запаса"
  ]
},
  npcs,
  cover: {
    prompt: "finished full-color comic book cover, vertical 2:3 poster; hero Vittoria vampire girl spiked gauntlet, crimson moon halo, ruined velvet manor, silver harpoon hunters shadow, palette #6A1B9A #212121 #CE93D8, title ВИТТОРИЯ Cyrillic, match vittoria_skin1.png, NO speech balloons"
  },
  chapters
};

const outPath = path.join(__dirname, "vittoria-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
