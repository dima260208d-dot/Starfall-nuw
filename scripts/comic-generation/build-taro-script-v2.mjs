import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = {
  "youngTaro": "Юный Таро — флешбэк: очки, первый ключ, упрямство",
  "patentThief": "Вор патентов Гиз — перчатки, чемодан чертежей",
  "munitionsBroker": "Брокер Ос — золотые зубы, торгует чужими идеями",
  "workshopApprentice": "Ученик Пем — роба, восхищение и страх",
  "herald": "Глашатай Арены — золотой рупор",
  "hunterCaptain": "Капитан охотников — белая маска",
  "shadowVoice": "Голос из тени — союзник без лица"
};
const chapters = {
  "1": {
    "title": "Ключ в шесть лет",
    "pages": [
      {
        "page": 1,
        "scene": "Flashback wide: workshop, six-year-old Taro with wrench.",
        "narration": [
          "Мастерская. Шесть лет. Первый ключ."
        ],
        "dialogue": [
          {
            "speaker": "youngTaro",
            "text": "Он греется!"
          },
          {
            "speaker": "taro",
            "text": "Греется — значит, работает."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Present old Taro tunes turret prototype.",
        "narration": [
          "Старик настраивает турель."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Мастер, это опасно!"
          },
          {
            "speaker": "taro",
            "text": "Интересное! Не останавливай."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Wrench spark attack on scrap armor.",
        "narration": [
          "Искры с ключа."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Смотри — ключ справился."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Broker Os offers buy patents.",
        "narration": [
          "Брокер Ос."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Золото за чертежи!"
          },
          {
            "speaker": "taro",
            "text": "Идеи не продаются."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Stolen turret design on black market.",
        "narration": [
          "Украденный чертёж на рынке."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Уже копируют!"
          },
          {
            "speaker": "taro",
            "text": "Копия. Без меня — мусор."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Arena poster: turret prize display.",
        "narration": [
          "Приз — чертёж на витрине Арены."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Мой чертёж… на витрине?"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sets mini turret at door.",
        "narration": [
          "Турель у порога."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Вежливым — не стреляю."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Laugh echoes — old man's joy.",
        "narration": [
          "Смех старика."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Вы смеётесь в войну?"
          },
          {
            "speaker": "taro",
            "text": "Смеюсь — иначе ржавею."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Dome glow through roof hole.",
        "narration": [
          "Купол через дыру в крыше."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Там мой чертёж. Иду."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Walks with wrench and blueprint tube.",
        "narration": [
          "Уходит с чертежами."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава I. Ключу шестьдесят лет — а он всё тот же."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Украденный чертёж",
    "pages": [
      {
        "page": 1,
        "scene": "Raid: Giz steals master blueprint.",
        "narration": [
          "Гиз крадёт мастер-чертёж."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Моё!"
          },
          {
            "speaker": "taro",
            "text": "Без меня — бесполезно."
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 2,
        "scene": "Turret auto-fires — misses thief.",
        "narration": [
          "Турель стреляет."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Промах. Настрою прицел."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback: first walker at six.",
        "narration": [
          "Шагоход в шесть лет."
        ],
        "dialogue": [
          {
            "speaker": "youngTaro",
            "text": "Он шагает!"
          },
          {
            "speaker": "taro",
            "text": "Шаг! Вот так."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Broker funds hunters.",
        "narration": [
          "Ос платит охотникам."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Патенты — валюта!"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Pem injured defending workshop.",
        "narration": [
          "Пем ранен."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Мастер…"
          },
          {
            "speaker": "taro",
            "text": "Держись. Ключ — не для плоти."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Wrench duel with thief agent.",
        "narration": [
          "Дуэль ключом."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Моя латунь."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 7,
        "scene": "Copy blueprint left — original gone.",
        "narration": [
          "Подделка осталась."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Оригинал — у меня в голове."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Arena invite in stolen tube.",
        "narration": [
          "Приглашение в тубусе."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Голос афиши: приз ждёт."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Pack tools.",
        "narration": [
          "Инструменты."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Вернусь с чертежом."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Road to dome.",
        "narration": [
          "Дорога."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава II. За чертежом."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "3": {
    "title": "Турель у порога",
    "pages": [
      {
        "page": 1,
        "scene": "Bridge choke: deploy turret.",
        "narration": [
          "Турель у порога моста."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Добро пожаловать. Не стреляй."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Hunters charge — turret holds hours.",
        "narration": [
          "Турель держит часами."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Сломайте!"
          },
          {
            "speaker": "taro",
            "text": "Держи, детка."
          }
        ],
        "sfx": "БРРР!"
      },
      {
        "page": 3,
        "scene": "Wrench repairs mid-fight.",
        "narration": [
          "Ремонт в бою."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Секунду — подкручу."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Giz copies fail explode.",
        "narration": [
          "Копии взрываются."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Почему?!"
          },
          {
            "speaker": "taro",
            "text": "Без меня — взрывается."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Register alias Iron Gardener.",
        "narration": [
          "Псевдоним «Железный садовник»."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Старик на песке?"
          },
          {
            "speaker": "taro",
            "text": "Стар — не слаб."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Broker offer join arena R&D.",
        "narration": [
          "Предложение Ос."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Богатство!"
          },
          {
            "speaker": "taro",
            "text": "Не купишь совесть."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night: builds second turret.",
        "narration": [
          "Вторая турель."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Нужен сон!"
          },
          {
            "speaker": "taro",
            "text": "Посплю на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Prize display seen through gate.",
        "narration": [
          "Витрина приза."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Смотрит… как старый друг."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Gate queue.",
        "narration": [
          "Очередь."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Сначала поздороваемся."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Enters.",
        "narration": [
          "Вход."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава III. Порог пройден."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "4": {
    "title": "Приз на витрине",
    "pages": [
      {
        "page": 1,
        "scene": "Arena showroom: stolen blueprint in glass.",
        "narration": [
          "Витрина с чертежом."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Моя подпись… кривая копия."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Clerk says legal — forged transfer.",
        "narration": [
          "Подделанный перевод прав."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Законно!"
          },
          {
            "speaker": "taro",
            "text": "Бумага. А совесть — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Wrench taps glass — crack pattern.",
        "narration": [
          "Трещина на стекле."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Треснуло. Как и должно."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Giz appears — mock bow.",
        "narration": [
          "Гиз кланяется."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Спасибо за идеи!"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Turret deploy in hall — controlled.",
        "narration": [
          "Турель в зале."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Демонстрация."
          }
        ],
        "sfx": "БРРР!"
      },
      {
        "page": 6,
        "scene": "Crowd loves old engineer.",
        "narration": [
          "Толпа за старика."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Они смеются с вами!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunter captain seizes display.",
        "narration": [
          "Капитан охраняет витрину."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Приз — наш!"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Plan heist during fight night.",
        "narration": [
          "План."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "На песке заберу."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Sand below.",
        "narration": [
          "Песок."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Бой!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Wrench ready.",
        "narration": [
          "Ключ."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава IV. Витрина — вызов."
          }
        ],
        "sfx": null
      }
    ]
  },
  "5": {
    "title": "Охотники за патентами",
    "pages": [
      {
        "page": 1,
        "scene": "Slum: patent hunters auction copies.",
        "narration": [
          "Аукцион копий."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Лоты!"
          },
          {
            "speaker": "taro",
            "text": "Горите."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Frees captive inventors.",
        "narration": [
          "Освобождает изобретателей."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Вольны. Как и должны."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Giz and Os alliance.",
        "narration": [
          "Союз Гиза и Оса."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Рынок решит!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Dual turret crossfire alley.",
        "narration": [
          "Две турели."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Огонь!"
          }
        ],
        "sfx": "БРРР!"
      },
      {
        "page": 5,
        "scene": "Pem builds signal beacon.",
        "narration": [
          "Маяк."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Сигнал Кендзи?"
          },
          {
            "speaker": "taro",
            "text": "Кендзи услышит."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Hunter nets on turrets.",
        "narration": [
          "Сети."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Сломайте машины!"
          },
          {
            "speaker": "taro",
            "text": "Я — здесь. Бейте меня."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Wrench cuts net motors.",
        "narration": [
          "Режет моторы сетей."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Раз!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 8,
        "scene": "Map patent vault under arena.",
        "narration": [
          "Хранилище патентов."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Там — мой."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Night oil and brass.",
        "narration": [
          "Ночь. Масло."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Старею красиво."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Gate.",
        "narration": [
          "Ворота."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава V. Охота на охотников."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "6": {
    "title": "Смех старика",
    "pages": [
      {
        "page": 1,
        "scene": "Bench shrine: fear uselessness.",
        "narration": [
          "Страх бесполезности."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Боюсь быть ненужным. Вот и всё."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback six: walker saves town.",
        "narration": [
          "Шагоход спас город."
        ],
        "dialogue": [
          {
            "speaker": "youngTaro",
            "text": "Он смешной и сильный!"
          },
          {
            "speaker": "taro",
            "text": "Смеялся и тогда."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Inner conflict: retire or prove.",
        "narration": [
          "Уйти или доказать?"
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Докажу на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Carves notch on wrench — oath.",
        "narration": [
          "Насечка на ключе."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Чинить мир."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Os offer youth serum for patents.",
        "narration": [
          "Сыворотка молодости."
        ],
        "dialogue": [
          {
            "speaker": "munitionsBroker",
            "text": "Вечность!"
          },
          {
            "speaker": "taro",
            "text": "Бессмертие без дела — scrap."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Laugh on rooftop — trio signal seen.",
        "narration": [
          "Смех. Сигнал троицы."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Сигнал. Не одни."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Tribunal: fight for patent vault.",
        "narration": [
          "Трибунал."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победи — верни имя чертежа."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Pem: you're not useless.",
        "narration": [
          "Пем."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Вы нужны."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Walks with turret cart.",
        "narration": [
          "Тележка турелей."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Ещё раунд!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Gate opens.",
        "narration": [
          "Ворота."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава VI. Смех громче страха."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Ворота мастерской",
    "pages": [
      {
        "page": 1,
        "scene": "Lower ring: Taro vs walker copy.",
        "narration": [
          "Копия шагохода."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "«Железный садовник»!"
          },
          {
            "speaker": "taro",
            "text": "Подделка? Сейчас покажу оригинал."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Turret line holds lane.",
        "narration": [
          "Линия турелей."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Держать — моя специальность."
          }
        ],
        "sfx": "БРРР!"
      },
      {
        "page": 3,
        "scene": "Wrench smashes copy knee.",
        "narration": [
          "Ключ ломает сустав."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Колено — слабое место."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Crowd chants old legend.",
        "narration": [
          "Легенда."
        ],
        "dialogue": [
          {
            "speaker": "workshopApprentice",
            "text": "Они знают вас!"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Giz VIP booth.",
        "narration": [
          "Гиз в ложе."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Ещё один чертёж!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Fixes child toy mech between rounds.",
        "narration": [
          "Чинит игрушку ребёнку."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Сломалось — починю."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night upgrade turrets.",
        "narration": [
          "Апгрейд."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Старик учится быстрее молодых."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Signs Giz duel.",
        "narration": [
          "Вызов Гиза."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Финал патентов!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Brass gleam.",
        "narration": [
          "Латунь."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Мастерская — в кармане."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Upper tier.",
        "narration": [
          "Верх."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Глава VII. Ворота открыты."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "8": {
    "title": "Латунь на песке",
    "pages": [
      {
        "page": 1,
        "scene": "Mid ring: Giz in powered exo.",
        "narration": [
          "Гиз в экзоскелете."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Молодость и сила!"
          },
          {
            "speaker": "taro",
            "text": "Смейся или падай."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Turret wall vs missiles.",
        "narration": [
          "Стена турелей."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Держать!"
          }
        ],
        "sfx": "БРРР-БУМ!"
      },
      {
        "page": 3,
        "scene": "Wrench overload exo joint.",
        "narration": [
          "Перегруз сустава."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Вот она!"
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 4,
        "scene": "Original blueprint falls from exo.",
        "narration": [
          "Оригинал выпал."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Оригинал снова в моих руках."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Spares Giz — laugh.",
        "narration": [
          "Щадит. Смеётся."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Живи. Изобретай сам."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Vault opens — workshop patent restored.",
        "narration": [
          "Патент восстановлен."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Закон признал!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunters seize — riot.",
        "narration": [
          "Бунт."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Патенты — наш бизнес!"
          },
          {
            "speaker": "taro",
            "text": "Сердце — в мастерской."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Rooftop turret escape.",
        "narration": [
          "Побег."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Догоняй!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 9,
        "scene": "Rain on brass.",
        "narration": [
          "Дождь на латуни."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Рой близко."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Chapter VIII.",
        "narration": [
          "Глава VIII."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Звон победы."
          }
        ],
        "sfx": "ДОЖДЬ…"
      }
    ]
  },
  "9": {
    "title": "Спор трёх путей",
    "pages": [
      {
        "page": 1,
        "scene": "Arena backstage mist — SHADOWED trio, brass wrench + lightning cage + beetle shield.",
        "narration": [
          "Закулисье. Туман. Три силуэта у трещины."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Кто там — без приглашения?"
          },
          {
            "speaker": "shadowVoice",
            "text": "Три пути. Один зал. Выбери."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "yellow lightning coils and bronze beetle swarm SILHOUETTE — NOT full faces.",
        "narration": [
          "Два силуэта по бокам. Лица скрыты."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Ещё охотники?"
          },
          {
            "speaker": "shadowVoice",
            "text": "Охотники на ложь. Не на тебя."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Hunters attack silhouettes; hero breaks nets.",
        "narration": [
          "Охотники бросаются на силуэты."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Если вы против них — говорите быстрее."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Triangle: brass wrench + lightning cage + beetle shield.",
        "narration": [
          "Три цвета в тумане сходятся."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Месть — дорога без выхода."
          },
          {
            "speaker": "taro",
            "text": "Выход найду сам."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Silhouettes hold line; hero strikes captain.",
        "narration": [
          "Силуэты держат линию."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Троих… как?"
          },
          {
            "speaker": "taro",
            "text": "Трое — мой любимый расклад."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 6,
        "scene": "Quiet vow exchange, faces hidden.",
        "narration": [
          "Тихий спор трёх идей."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Убьёшь врага — станешь легендой."
          },
          {
            "speaker": "taro",
            "text": "Я не пустой."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sky marks: coil, beetle, hero symbol.",
        "narration": [
          "В небе проступают три знака."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Три пути. Один враг. Пока сходимся."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Combined strike cuts arena nets.",
        "narration": [
          "Комбо рвёт сети."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Вместе — до ворот."
          },
          {
            "speaker": "taro",
            "text": "После — каждый своей дорогой."
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 9,
        "scene": "Triangle burned into sand.",
        "narration": [
          "На песке — треугольный знак."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Тебя объявят союзником тени!"
          },
          {
            "speaker": "taro",
            "text": "Объявят — не значит узнают."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Silhouettes depart; hero with mark on glove.",
        "narration": [
          "Силуэты уходят тремя тропами."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Спор трёх путей. Ответ — завтра."
          },
          {
            "speaker": "shadowVoice",
            "text": "Завтра мы снова станем тенью."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "10": {
    "title": "Шестерня на табло",
    "pages": [
      {
        "page": 1,
        "scene": "Arena ceremony: golden scoreboard, trio rumor.",
        "narration": [
          "Церемония. Слухи о троице гремят."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Верхний круг открыт. Финал — сегодня."
          },
          {
            "speaker": "taro",
            "text": "Сегодня зал полон."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: kenji — match kenji_skin1.png.",
        "narration": [
          "Кендзи выходит — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "kenji",
            "text": "Клетка молний помнит вашу мастерскую."
          },
          {
            "speaker": "taro",
            "text": "Мастерская со мной."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: oliver — match oliver_skin1.png.",
        "narration": [
          "Оливер — полный дизайн."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Жуки помнят твой ключ. Мы обещали стычку."
          },
          {
            "speaker": "taro",
            "text": "Ключ — не игрушка."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Trio vs hunters on sand — all FULL faces.",
        "narration": [
          "Трое на песке. Лица видны."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Слева — сети. Режем вместе."
          },
          {
            "speaker": "kenji",
            "text": "Молния прыгает."
          },
          {
            "speaker": "oliver",
            "text": "Рой держит."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 5,
        "scene": "Team combo: turret line + lightning cage + beetle swarm.",
        "narration": [
          "Комбо суперов троих."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Сейчас!"
          },
          {
            "speaker": "kenji",
            "text": "Клетка!"
          },
          {
            "speaker": "oliver",
            "text": "Щит!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 6,
        "scene": "patentThief descends upper gate.",
        "narration": [
          "Гиз спускается."
        ],
        "dialogue": [
          {
            "speaker": "patentThief",
            "text": "Сдай чертежи — купишь молодость!"
          },
          {
            "speaker": "taro",
            "text": "Не продаётся."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena edge: three paths debate.",
        "narration": [
          "Три голоса — три пути."
        ],
        "dialogue": [
          {
            "speaker": "kenji",
            "text": "Доказать — не сломать."
          },
          {
            "speaker": "oliver",
            "text": "Память — дар."
          },
          {
            "speaker": "taro",
            "text": "Сам выбираю."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night sky: iron workshop + university coils + family garage over Arena.",
        "narration": [
          "Ночное небо над куполом."
        ],
        "dialogue": [
          {
            "speaker": "youngTaro",
            "text": "Не превращай изобретение в чужое оружие."
          },
          {
            "speaker": "taro",
            "text": "Помню шестилетнего себя. Гиза — на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Final splash: trio vs enemy wave.",
        "narration": [
          "Финальный залп."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Вперёд!"
          },
          {
            "speaker": "patentThief",
            "text": "Патенты поглотят вас!"
          },
          {
            "speaker": "oliver",
            "text": "Не сегодня!"
          }
        ],
        "sfx": "ВЖУХ-ВЖУХ!"
      },
      {
        "page": 10,
        "scene": "End card: hero forward, trio behind.",
        "narration": [
          "Конец главы X."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Табло — не конец."
          },
          {
            "speaker": "kenji",
            "text": "Мы рядом."
          },
          {
            "speaker": "oliver",
            "text": "До конца пути."
          }
        ],
        "sfx": "ВЕТЕР…"
      }
    ]
  }
};
const script = {
  brawlerId: "taro",
  brawlerName: "Таро",
  lore: "Таро — пожилой инженер, собравший первый шагоход в шесть лет. Гаечный ключ — оружие пострашнее меча, турели держат позиции часами. Он боится не смерти, а бесполезности.",
  skinRef: "public/dev-notes/brawler-skins/taro_skin1.png",
  trioId: "forge-swarm",
  trioOthers: ["kenji","oliver"],
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
  cover: { prompt: "finished full-color comic book cover, vertical 2:3; hero Таро elderly engineer wrench turrets brass, workshop, palette #5D4037 #CD9B39 #8D6E63, title ТАРО Cyrillic, NO speech balloons, match taro_skin1.png" },
  chapters,
};
const outPath = path.join(__dirname, "taro-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
