import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = {
  "elderShade": "Старейшина Тень — лицо в татуировках лиан, хранитель формулы",
  "formulaThief": "Вор формулы Сай — перчатки, алхимические флаконы",
  "boneCollector": "Сборщик Костей — броня из костей, сети для токсинов",
  "jungleGuide": "Проводник Ива — бесшумные шаги, знает тропы",
  "herald": "Глашатай Арены — золотой рупор",
  "hunterCaptain": "Капитан охотников — белая маска",
  "shadowVoice": "Голос из тени — союзник без лица"
};
const chapters = {
  "1": {
    "title": "Туман формулы",
    "pages": [
      {
        "page": 1,
        "scene": "Jungle dawn: toxic mist, glowing plants.",
        "narration": [
          "Ядовитые джунгли. Туман формулы."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Не касайся листа, Рин."
          },
          {
            "speaker": "rin",
            "text": "Он сам ко мне лезет."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Rin coats dagger with personal venom.",
        "narration": [
          "Смазывает кинжал ядом."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Формула — только твоя."
          },
          {
            "speaker": "rin",
            "text": "И моя головная боль."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Silent leap between branches.",
        "narration": [
          "Бесшумный прыжок."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Тихо — как дома учили."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Thief Sai watches from vine.",
        "narration": [
          "Сай на лиане."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Формула стоит целое королевство."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Rare plant pulses — arena dome reflected.",
        "narration": [
          "Редкое растение отражает купол."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Растёт только под аренским куполом."
          },
          {
            "speaker": "rin",
            "text": "Тогда иду туда."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Bone collectors approach village.",
        "narration": [
          "Сборщики в костяной броне."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Сдай формулу!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Poison dagger leaves glowing trail on fleeing foe.",
        "narration": [
          "Светящийся след яда."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Метка видна в тумане."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 8,
        "scene": "Elder gives vial — last seed of antidote.",
        "narration": [
          "Флакон противоядия."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Не для врагов — для ошибок."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Jungle burns far — arena call.",
        "narration": [
          "Джунгли горят вдали."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Во мне — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Leaves canopy toward dome.",
        "narration": [
          "Уходит из кроны."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Пора."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Секрет в листе",
    "pages": [
      {
        "page": 1,
        "scene": "Raid: collectors burn formula grove.",
        "narration": [
          "Сожжённая роща."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Без листа — без яда!"
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 2,
        "scene": "Elder poisoned — rin injects partial cure.",
        "narration": [
          "Старейшина отравлен."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Держи дыхание."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Secret: formula in her blood.",
        "narration": [
          "Секрет: формула в крови."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Никто не должен знать…"
          },
          {
            "speaker": "rin",
            "text": "Знаю. Молчу."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Sai steals leaf copy — fake.",
        "narration": [
          "Сай крадёт подделку."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Есть!"
          },
          {
            "speaker": "rin",
            "text": "Настоящее — здесь. В крови."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Chase through roots.",
        "narration": [
          "Погоня."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Пустой лист. Наслаждайся."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 6,
        "scene": "Guide Iv wounded.",
        "narration": [
          "Ива ранена."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Иди без меня."
          },
          {
            "speaker": "rin",
            "text": "Не брошу. Просто уйду тихо."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena poster: rare plant prize.",
        "narration": [
          "Приз — растение под куполом."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "За ним — иду."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Poison cloud hides escape.",
        "narration": [
          "Облако яда."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Дышите меньше."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 9,
        "scene": "Road to gates.",
        "narration": [
          "Дорога."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Голос: не стань ядом."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Eyes glow purple-green.",
        "narration": [
          "Глаза светятся."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Глава II. Секрет — во мне."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "3": {
    "title": "Укус без звука",
    "pages": [
      {
        "page": 1,
        "scene": "Border ambush: collectors with nets.",
        "narration": [
          "Засада с сетями."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Живая формула!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Silent kill — dagger poison glow on runner.",
        "narration": [
          "Укус без звука. След светится."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Беги. Свети."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Signature: target poisoned mid-leap.",
        "narration": [
          "Яд на бегущей цели."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Как?!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Sai offers sell formula to arena.",
        "narration": [
          "Сай торгует с Ареной."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Цена — твоя кровь."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Rin takes antidote vial — won't use on enemies.",
        "narration": [
          "Флакон — на случай ошибки."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Яд лечит, если знать дозу."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Register alias Silent Bloom.",
        "narration": [
          "Псевдоним «Безмолвный цветок»."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Убийца?"
          },
          {
            "speaker": "rin",
            "text": "Храню. Не убиваю зря."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Rare plant scent leads to lower gate.",
        "narration": [
          "Запах растения."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Туда."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night: poison cloud practice.",
        "narration": [
          "Тренировка облака."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Дальше — только я."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 9,
        "scene": "Dome roots visible under sand.",
        "narration": [
          "Корни под песком."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Запах ведёт."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Dagger twirl.",
        "narration": [
          "Кинжал."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Глава III. Укус — моя подпись."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "4": {
    "title": "Цветок под куполом",
    "pages": [
      {
        "page": 1,
        "scene": "Arena greenhouse under dome: rare plant.",
        "narration": [
          "Теплица под куполом."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Цветок… жив."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Plant tied to formula — must not die.",
        "narration": [
          "Растение связано с формулой."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Голос: береги."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Sai tries steal plant.",
        "narration": [
          "Сай крадёт."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Моё!"
          },
          {
            "speaker": "rin",
            "text": "Не твоё."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Guards with bone armor.",
        "narration": [
          "Стража."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Сдайся!"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Poison cloud secures plant.",
        "narration": [
          "Облако прикрывает цветок."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Дыши меньше."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 6,
        "scene": "Herald announces bloom trial fight.",
        "narration": [
          "Бой за цветок."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победитель — доступ."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Iv brings elder message: stay.",
        "narration": [
          "Сообщение: остаться."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Они хотят, чтобы ты исчезла."
          },
          {
            "speaker": "rin",
            "text": "Уйти легко. Я остаюсь."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Map venom vault.",
        "narration": [
          "Хранилище ядов."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Сай там. Значит, и я."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Gate to sand.",
        "narration": [
          "Песок."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Сад под куполом. Берегу."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Plant petal in hair.",
        "narration": [
          "Лепесток в волосах."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Глава IV. Цветок под куполом."
          }
        ],
        "sfx": null
      }
    ]
  },
  "5": {
    "title": "Сборщики костяной брони",
    "pages": [
      {
        "page": 1,
        "scene": "Slum hunt: bone collectors sell poisons.",
        "narration": [
          "Рынок ядов."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Свежие токсины!"
          },
          {
            "speaker": "rin",
            "text": "Свежий яд всё равно яд."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Frees captive alchemists.",
        "narration": [
          "Освобождение."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Идите. Берите формулы с собой."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Sai alliance with collectors.",
        "narration": [
          "Союз Сая."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Кровь Рин — ключ!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Trap net — cloud escape.",
        "narration": [
          "Сеть. Облако."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Режу."
          }
        ],
        "sfx": "РВАНЬ!"
      },
      {
        "page": 5,
        "scene": "Child poisoned by stolen vial.",
        "narration": [
          "Ребёнок отравлен."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Противоядие — сейчас!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 6,
        "scene": "Sai offers cure for formula.",
        "narration": [
          "Сделка."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Формула за жизнь."
          },
          {
            "speaker": "rin",
            "text": "Не торгую жизнями."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunter captain joins.",
        "narration": [
          "Капитан."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Яд — оружие Арены!"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Plan: venom vault heist.",
        "narration": [
          "План."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Опасно."
          },
          {
            "speaker": "rin",
            "text": "Молчать — хуже."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Night blades sharpen.",
        "narration": [
          "Ночь."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Кость трескается. Помню."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Lower gate.",
        "narration": [
          "Ворота."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Глава V. Охота на сборщиков."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "6": {
    "title": "Исчезнуть или остаться",
    "pages": [
      {
        "page": 1,
        "scene": "Shrine root: choice altar.",
        "narration": [
          "Алтарь выбора."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Исчезни — живи."
          },
          {
            "speaker": "rin",
            "text": "Жить — значит видеть."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback: left jungle once — returned.",
        "narration": [
          "Уходила — вернулась."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Ты осталась тогда."
          },
          {
            "speaker": "rin",
            "text": "Останусь сейчас."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Inner conflict: vanish easy, stay hard.",
        "narration": [
          "Исчезнуть легко. Остаться труднее."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Трудно. Значит, так и надо."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Writes formula not on paper — on leaf only.",
        "narration": [
          "Формула только на листе, не на бумаге."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Кровь не продаётся."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Sai capture attempt — fails.",
        "narration": [
          "Попытка похищения."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Кровь!"
          },
          {
            "speaker": "rin",
            "text": "Не сегодня."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 6,
        "scene": "Debate Iv: revenge vs cure.",
        "narration": [
          "Спор."
        ],
        "dialogue": [
          {
            "speaker": "jungleGuide",
            "text": "Отравь их всех!"
          },
          {
            "speaker": "rin",
            "text": "Яд — не суд. Я — да."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Tribunal: fight for formula rights.",
        "narration": [
          "Трибунал."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победи — владей формулой."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Antidote vial half empty.",
        "narration": [
          "Флакон наполовину пуст."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Ошибки ещё будут."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Walks to sand visible.",
        "narration": [
          "К песку."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Не исчезаю."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Green mist at gate.",
        "narration": [
          "Туман у ворот."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Глава VI. Остаюсь."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Ворота зелёного яруса",
    "pages": [
      {
        "page": 1,
        "scene": "Lower ring: rin vs toxin gladiator.",
        "narration": [
          "Нижний круг."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "«Безмолвный цветок»!"
          },
          {
            "speaker": "rin",
            "text": "Цвету. Тихо."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Dagger poison stacks.",
        "narration": [
          "Яд накладывается."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Ещё капля…"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Cloud super preview.",
        "narration": [
          "Облако яда."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Дыши осторожно."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 4,
        "scene": "Win — crowd uneasy.",
        "narration": [
          "Победа."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Монстр!"
          },
          {
            "speaker": "rin",
            "text": "Храню. Не убиваю зря."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Sai backstage deal.",
        "narration": [
          "Сделка."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Кровь за жизнь!"
          },
          {
            "speaker": "rin",
            "text": "Не торгую."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Heals poisoned slave fighter.",
        "narration": [
          "Лечит раба."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Флакон — на случай ошибки."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night silent drills.",
        "narration": [
          "Ночь."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Голос: не исчезай в ненависти."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Signs Sai duel.",
        "narration": [
          "Вызов Сая."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Финал яда!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Plant petal glows.",
        "narration": [
          "Лепесток."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Держится."
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
            "speaker": "rin",
            "text": "Глава VII. Зелёный ярус."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "8": {
    "title": "Яд на песке",
    "pages": [
      {
        "page": 1,
        "scene": "Mid ring: Sai with stolen vials.",
        "narration": [
          "Сай на песке."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Формула — моя!"
          },
          {
            "speaker": "rin",
            "text": "Живая. Не ваша."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Cloud vs vial storm.",
        "narration": [
          "Буря флаконов."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Облако!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 3,
        "scene": "Dagger disarms — poison glow trail.",
        "narration": [
          "След яда."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Горит!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Sai falls — antidote offered.",
        "narration": [
          "Противоядие врагу."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Пей. Говори."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Vault opens — plant safe.",
        "narration": [
          "Растение цело."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Голос: молодец."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Tribunal upper gate.",
        "narration": [
          "Верхний ярус."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Трио прилив!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Collectors surround.",
        "narration": [
          "Окружение."
        ],
        "dialogue": [
          {
            "speaker": "boneCollector",
            "text": "Яд — наш!"
          },
          {
            "speaker": "rin",
            "text": "Мой яд — моя ответственность."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Rooftop escape cloud.",
        "narration": [
          "Побег."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "В туман!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 9,
        "scene": "Rain.",
        "narration": [
          "Дождь."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Прилив близко."
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
            "speaker": "rin",
            "text": "Урок выучен."
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
        "scene": "Arena backstage mist — SHADOWED trio, jungle venom + acid flask + ink tide.",
        "narration": [
          "Закулисье. Туман. Три силуэта у трещины."
        ],
        "dialogue": [
          {
            "speaker": "rin",
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
        "scene": "green hair flask and tentacle ink veil SILHOUETTE — NOT full faces.",
        "narration": [
          "Два силуэта по бокам. Лица скрыты."
        ],
        "dialogue": [
          {
            "speaker": "rin",
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
            "speaker": "rin",
            "text": "Если вы против них — говорите быстрее."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Triangle: jungle venom + acid flask + ink tide.",
        "narration": [
          "Три цвета в тумане сходятся."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Месть — дорога без выхода."
          },
          {
            "speaker": "rin",
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
            "speaker": "rin",
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
            "speaker": "rin",
            "text": "Я не пустая."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sky marks: flask, ink, hero symbol.",
        "narration": [
          "В небе проступают три знака."
        ],
        "dialogue": [
          {
            "speaker": "rin",
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
            "speaker": "rin",
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
            "speaker": "rin",
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
            "speaker": "rin",
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
    "title": "Лекарство в табло",
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
            "speaker": "rin",
            "text": "Сегодня зал полон."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: callista — match callista_skin1.png.",
        "narration": [
          "Каллиста выходит — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "callista",
            "text": "Формула зовёт. Мы обещали стычку у ворот."
          },
          {
            "speaker": "rin",
            "text": "Формула моя. Вы — союз."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: octavia — match octavia_skin1.png.",
        "narration": [
          "Октавия — полный дизайн."
        ],
        "dialogue": [
          {
            "speaker": "octavia",
            "text": "Вода помнит твой яд. Вместе — до конца."
          },
          {
            "speaker": "rin",
            "text": "Не враги. Проверим."
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
            "speaker": "rin",
            "text": "Слева — сети. Режем вместе."
          },
          {
            "speaker": "callista",
            "text": "Колба вспыхивает."
          },
          {
            "speaker": "octavia",
            "text": "Чернила прикрывают."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 5,
        "scene": "Team combo: poison cloud + explosive flask + ink veil.",
        "narration": [
          "Комбо суперов троих."
        ],
        "dialogue": [
          {
            "speaker": "rin",
            "text": "Сейчас!"
          },
          {
            "speaker": "callista",
            "text": "Реактив!"
          },
          {
            "speaker": "octavia",
            "text": "Завеса!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 6,
        "scene": "formulaThief descends upper gate.",
        "narration": [
          "Сай спускается."
        ],
        "dialogue": [
          {
            "speaker": "formulaThief",
            "text": "Сдай формулу — купишь джунгли!"
          },
          {
            "speaker": "rin",
            "text": "Не продаю."
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
            "speaker": "callista",
            "text": "Риск — ради жизни."
          },
          {
            "speaker": "octavia",
            "text": "Исцеление — в глубине."
          },
          {
            "speaker": "rin",
            "text": "Мой путь — мой выбор."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night sky: jungle canopy + alchemy lab + underground lake over Arena.",
        "narration": [
          "Ночное небо над куполом."
        ],
        "dialogue": [
          {
            "speaker": "elderShade",
            "text": "Не стань ядом, который сам боишься."
          },
          {
            "speaker": "rin",
            "text": "Помню старейшину. Сай — на песке."
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
            "speaker": "rin",
            "text": "Вперёд!"
          },
          {
            "speaker": "formulaThief",
            "text": "Яд поглотит вас!"
          },
          {
            "speaker": "octavia",
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
            "speaker": "rin",
            "text": "Табло — не конец."
          },
          {
            "speaker": "callista",
            "text": "Мы рядом."
          },
          {
            "speaker": "octavia",
            "text": "До конца пути."
          }
        ],
        "sfx": "ВЕТЕР…"
      }
    ]
  }
};
const script = {
  brawlerId: "rin",
  brawlerName: "Рин",
  lore: "Рин выросла в ядовитых джунглях. Каждый кинжал смазан личным ядом, формулу которого не знает никто. Она появляется бесшумно, отравляет цель и исчезает — но на Арене исчезнуть труднее, чем остаться.",
  skinRef: "public/dev-notes/brawler-skins/rin_skin1.png",
  trioId: "venom-tide",
  trioOthers: ["callista","octavia"],
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
  cover: { prompt: "finished full-color comic book cover, vertical 2:3; hero Рин green hair poison daggers, jungle mist, glowing venom, palette #2E7D32 #8BC34A #CE93D8, title РИН Cyrillic, NO speech balloons, match rin_skin1.png" },
  chapters,
};
const outPath = path.join(__dirname, "rin-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
