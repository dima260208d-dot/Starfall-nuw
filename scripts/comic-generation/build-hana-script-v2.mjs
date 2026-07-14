import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = {
  "yuko": "Юко — главная сестра: седая коса, строгий розовый халат",
  "mika": "Мика — юный пациент: бинты, упрямые глаза",
  "vendrick": "Вендрик — капитан наёмников: трофейные жетоны, жестокая ухмылка",
  "drSato": "Доктор Сато — полевой хирург: очки, усталые руки",
  "herald": "Глашатай Арены — золотой рупор, аренская куртка",
  "hunterCaptain": "Капитан охотников — белая маска, сети",
  "shadowVoice": "Голос из тени — союзник без лица"
};
const chapters = {
  "1": {
    "title": "Розовый рассвет",
    "pages": [
      {
        "page": 1,
        "scene": "Wide dawn: Pink Hospital between trenches, flower garden.",
        "narration": [
          "Розовый госпиталь на линии фронта. Сад цветёт — линия жива."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Смена начинается, Хана."
          },
          {
            "speaker": "hana",
            "text": "Сначала полив, потом раненые."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close: Hana checks healing pistol beside blooming beds.",
        "narration": [
          "Лечебный пистолет. Два режима — один выбор в секунду."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Сегодня много раненых."
          },
          {
            "speaker": "hana",
            "text": "Тогда стреляю чаще."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Training ward: heal dummy then pierce armor plate.",
        "narration": [
          "Учебный зал. Мишень принимает и шов, и дырку."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Ты правда лечишь и бьёшь?"
          },
          {
            "speaker": "hana",
            "text": "Без силы добро — просто слова."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Night: distress signal from Arena medical wing.",
        "narration": [
          "Сигнал бедствия с медкрыла Арены."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Это не наш фронт."
          },
          {
            "speaker": "hana",
            "text": "Боль не спрашивает, чей это фронт."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Chart of hopeless patient she refused to abandon.",
        "narration": [
          "Карта безнадёжного пациента. Крест не поставлен."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Пока дышит — стреляю в жизнь, не в смерть."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Mercenaries sell wounded tags on black market.",
        "narration": [
          "Наёмники торгуют жетонами раненых."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Трофеи… люди…"
          },
          {
            "speaker": "hana",
            "text": "Закончится, когда найду их."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hana plants garden seed in ammo pouch.",
        "narration": [
          "Семя в кармане — обещание вернуться."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Ты уходишь?"
          },
          {
            "speaker": "hana",
            "text": "Ухожу лечить больше, чем один зал."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Super preview: Blooming Garden over triage tent.",
        "narration": [
          "Цветущий сад накрывает перевязочную."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Держитесь в круге!"
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 9,
        "scene": "Arena dome glows pink beyond trenches.",
        "narration": [
          "Купол пульсирует розовым."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Там ответ. Или ловушка."
          },
          {
            "speaker": "hana",
            "text": "Ловушки тоже нуждаются во мне."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: Hana walks toward dome.",
        "narration": [
          "Она идёт к куполу."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Рассвет закончился. Дорога — нет."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Пульс без ответа",
    "pages": [
      {
        "page": 1,
        "scene": "Emergency: hopeless patient flatlines.",
        "narration": [
          "Безнадёжный пациент. Линия ровная."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Хана… не трать заряды."
          },
          {
            "speaker": "hana",
            "text": "Трачу."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback: Mika saved from same diagnosis.",
        "narration": [
          "Память: она уже побеждала этот приговор."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Ты не сдалась тогда."
          },
          {
            "speaker": "hana",
            "text": "Не сдамся сейчас."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Healing burst — heartbeat returns.",
        "narration": [
          "Лечебная вспышка. Пульс возвращается."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Как?!"
          },
          {
            "speaker": "hana",
            "text": "Пульс вернулся. Видите?"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Vendrick watches — wants patient as trophy.",
        "narration": [
          "Вендрик смотрит из окна."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Продам дороже."
          },
          {
            "speaker": "hana",
            "text": "Пациент не товар."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Mercenary raid; Hana shoots armor.",
        "narration": [
          "Налёт. Пули режут броню."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Сдай аптечку!"
          },
          {
            "speaker": "hana",
            "text": "Сначала сдай оружие."
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 6,
        "scene": "Mika under bed; garden dome covers.",
        "narration": [
          "Сад прикрывает ребёнка."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Дыши. Цветы не предают — я тоже."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Patient whispers Arena coordinates.",
        "narration": [
          "Пациент шепчет координаты Арены."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Он видел купол…"
          },
          {
            "speaker": "hana",
            "text": "Зов услышан. Иду."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Yuko gives field medic seal.",
        "narration": [
          "Печать полевого врача."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Верни сад."
          },
          {
            "speaker": "hana",
            "text": "Вернусь. С садом побольше."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Vendrick vows catch at gates.",
        "narration": [
          "Клятва у ворот."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "На Арене раненые — валюта."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Hospital scarred; Hana on road.",
        "narration": [
          "Госпиталь в шрамах."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава II. Пульс вернулся — идём дальше."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "3": {
    "title": "Выстрел милосердия",
    "pages": [
      {
        "page": 1,
        "scene": "Forest trail: wounded soldiers ambushed.",
        "narration": [
          "Тропа. Засада на раненых."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Мы опоздали!"
          },
          {
            "speaker": "hana",
            "text": "Опоздали — ещё не значит поздно."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Hana heals ally then shoots mercenary armor.",
        "narration": [
          "Лечит союзника — бьёт броню врага."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Один выстрел. Два режима."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Signature: healing bullet through plate.",
        "narration": [
          "Лечебная пуля пробивает сталь."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Как?!"
          },
          {
            "speaker": "hana",
            "text": "Добро достаточно острое, когда надо."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Rescued soldier carries Arena flyer.",
        "narration": [
          "Листовка Арены в крови."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Медкрыло зовёт."
          },
          {
            "speaker": "hana",
            "text": "Слышу."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Night camp: inner conflict — strike first?",
        "narration": [
          "Ночь. Добро должно бить первым?"
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Милосердие без курка — мишень на спине."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Vendrick bounty poster with her face.",
        "narration": [
          "Плакат с её лицом."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Тебя ищут!"
          },
          {
            "speaker": "hana",
            "text": "Пусть ищут. Я ищу виновных."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Garden super heals three at once.",
        "narration": [
          "Сад лечит троих."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "В круге — дышите!"
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 8,
        "scene": "Arena transit checkpoint ahead.",
        "narration": [
          "КПП к куполу."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Голос письма: осторожно."
          },
          {
            "speaker": "hana",
            "text": "Осторожность — не отступление. Запомни."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Dome silhouette through rain.",
        "narration": [
          "Купол в дожде."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Сирена ближе."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliff: pistol raised to sky.",
        "narration": [
          "Пистолет к небу."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава III. Выстрел милосердия — моя визитка на Арене."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "4": {
    "title": "Сирена крыла",
    "pages": [
      {
        "page": 1,
        "scene": "Arena medical wing ruins: siren wails.",
        "narration": [
          "Руины медкрыла. Сирена воет."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Эвакуация провалена!"
          },
          {
            "speaker": "hana",
            "text": "Эвакуация — моя смена. Отойдите."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Trapped medics behind collapsed beam.",
        "narration": [
          "Медики под балкой."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Не выдержим!"
          },
          {
            "speaker": "hana",
            "text": "Выдержите. Я уже здесь."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Healing shots stabilize while cutting debris.",
        "narration": [
          "Пули стабилизируют — режет обломки."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Пульс сначала. Камень — потом."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 4,
        "scene": "Arena call confirmed — wing was bait.",
        "narration": [
          "Медкрыло — приманка."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Раненые — наживка!"
          },
          {
            "speaker": "hana",
            "text": "Наживка кусается. Отойди."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Rescued medic gives upper tier map.",
        "narration": [
          "Карта верхнего яруса."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Там торгуют людьми."
          },
          {
            "speaker": "hana",
            "text": "Там закончу этот торг."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Register alias Pink Surgeon.",
        "narration": [
          "Псевдоним «Розовый хирург»."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Первый бой — завтра."
          },
          {
            "speaker": "hana",
            "text": "Завтра — рано. Сегодня — швы и перевязки."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Vendrick seen with arena patron.",
        "narration": [
          "Вендрик у покровителя."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Вытащу на песок."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night: tends child gladiator in slums.",
        "narration": [
          "Лечит ребёнка-гладиатора."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Голос письма: не бросай."
          },
          {
            "speaker": "hana",
            "text": "Не бросаю."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Garden blooms on rooftop.",
        "narration": [
          "Сад на крыше."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Цветы видят купол."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Walks to lower gate at dawn.",
        "narration": [
          "Рассвет у ворот."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава IV. Сирена смолкла. Я здесь."
          }
        ],
        "sfx": null
      }
    ]
  },
  "5": {
    "title": "Трофейные охотники",
    "pages": [
      {
        "page": 1,
        "scene": "Slum market: wounded sold in cages.",
        "narration": [
          "Рынок. Раненые в клетках."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Лоты свежие!"
          },
          {
            "speaker": "hana",
            "text": "Свежесть — не оправдание. Отойди."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Hana buys time with healing burst on guard.",
        "narration": [
          "Лечит стража — выигрывает секунды."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Спасибо не нужно. Отойди."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Frees prisoners; vendrick hunts.",
        "narration": [
          "Освобождение. Погоня."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Ты портишь товар!"
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 4,
        "scene": "Alley fight: shoot knee plates not hearts.",
        "narration": [
          "Стреляет в колени брони."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Живите. Свидетельствуйте."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Child prisoner knows vendrick ledger.",
        "narration": [
          "Ребёнок знает книгу учёта."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Он записал имена…"
          },
          {
            "speaker": "hana",
            "text": "Имена — в моём списке. Запишу каждое."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Hunter captain with nets for wounded.",
        "narration": [
          "Капитан с сетями."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Сдай беглецов!"
          },
          {
            "speaker": "hana",
            "text": "Сдай сети."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Garden dome traps captain.",
        "narration": [
          "Купол ловит капитана."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Отдыхай. Подумай."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 8,
        "scene": "Map to trophy vault under arena.",
        "narration": [
          "Тайник трофеев под ареной."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Туда нельзя."
          },
          {
            "speaker": "hana",
            "text": "Туда — именно."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Prepares medic kit and ammo.",
        "narration": [
          "Аптечка и патроны."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Два кармана. Одна цель — спасти."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Lower gate opens.",
        "narration": [
          "Нижние ворота."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава V. Охота на охотников началась."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "6": {
    "title": "Добро с курком",
    "pages": [
      {
        "page": 1,
        "scene": "Shrine tent: oath to heal and protect.",
        "narration": [
          "Шатёр-клятва."
        ],
        "dialogue": [
          {
            "speaker": "yuko",
            "text": "Ты клялась не стрелять."
          },
          {
            "speaker": "hana",
            "text": "Клялась не бросать."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback: first kill shot saved ward.",
        "narration": [
          "Память: выстрел спас зал."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Тогда ты плакала."
          },
          {
            "speaker": "hana",
            "text": "Плакала — не отступила."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Debate with Sato: mercy vs force.",
        "narration": [
          "Спор: милость или сила."
        ],
        "dialogue": [
          {
            "speaker": "drSato",
            "text": "Добро не стреляет!"
          },
          {
            "speaker": "hana",
            "text": "Добро без силы — жертва. Не буду."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Mika brings flower from hospital garden.",
        "narration": [
          "Цветок из сада."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Он выжил."
          },
          {
            "speaker": "hana",
            "text": "Значит, клятва жива."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Writes two oaths on bandage.",
        "narration": [
          "Две клятвы на бинте."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Лечить. Бить — только за жизнь."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Vendrick offer: join trophy trade.",
        "narration": [
          "Предложение Вендрика."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Богатство за союз."
          },
          {
            "speaker": "hana",
            "text": "Богатство не лечит."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Nightmare: patients as merchandise.",
        "narration": [
          "Кошмар: пациенты как товар."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Проснусь — и изменю."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Arena tribunal grants trial by combat.",
        "narration": [
          "Трибунал: бой за право суда."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победи — получишь голос."
          },
          {
            "speaker": "hana",
            "text": "Голос — шов на ране этой Арены."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Walks to sand with pistol and seeds.",
        "narration": [
          "Песок. Пистолет и семена."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Добро с курком — не противоречие. Это я."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Gate guard salutes medic seal.",
        "narration": [
          "Страж чтит печать."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава VI. Цена силы — ответственность. Помню."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Песок полевого врача",
    "pages": [
      {
        "page": 1,
        "scene": "Lower ring: Hana vs chain gladiator.",
        "narration": [
          "Нижний круг."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "«Розовый хирург»!"
          },
          {
            "speaker": "hana",
            "text": "Сниму броню — не жизнь."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Heals fallen foe to shock crowd.",
        "narration": [
          "Лечит поверженного врага."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Предательство стиля!"
          },
          {
            "speaker": "hana",
            "text": "Стиль — жизнь. Запомни это."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Shoots armor joints; enemy yields.",
        "narration": [
          "Стреляет в суставы брони."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Сдавайся. Живи."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Crowd splits — some cheer mercy.",
        "narration": [
          "Толпа расколота."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Они видят!"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Captain backstage: sell her to vendrick.",
        "narration": [
          "Сделка за голову."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Цена за медика."
          },
          {
            "speaker": "hana",
            "text": "Цена — мой прицел."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Tends arena slave fighter.",
        "narration": [
          "Лечит раба-бойца."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Арена жрёт. Я — противоядие. Держись."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night training: heal and harm same target.",
        "narration": [
          "Тренировка двух режимов."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Один вдох — два выбора. Успеваю оба."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Signs fight vs Trophy Lord.",
        "narration": [
          "Вызов «Лорду трофеев»."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Это Вендрик."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Garden blooms on sand practice.",
        "narration": [
          "Сад на тренировочном песке."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Песок впитает цветы."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Upper tier glows.",
        "narration": [
          "Верхний ярус."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Глава VII. Песок принимает шов. Хорошо."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "8": {
    "title": "Шов на арене",
    "pages": [
      {
        "page": 1,
        "scene": "Mid ring: Vendrick with trophy hooks.",
        "narration": [
          "Вендрик с крюками."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Раненые — моя валюта!"
          },
          {
            "speaker": "hana",
            "text": "Валюта — твой конец. Сдавайся."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Hooks snag medics in stands.",
        "narration": [
          "Крюки тянут медиков."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Руки прочь от моих."
          }
        ],
        "sfx": "РВАНЬ!"
      },
      {
        "page": 3,
        "scene": "Healing volley saves crowd.",
        "narration": [
          "Лечебный залп в толпу."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Живите! Свидетельствуйте!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Garden dome on sand — super.",
        "narration": [
          "Цветущий сад на песке."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Круг жизни!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 5,
        "scene": "Vendrick mask cracks — arena broker.",
        "narration": [
          "Под маской — брокер Арены."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Пешка. Покровитель прячется — найду."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Tribunal opens upper gate.",
        "narration": [
          "Верхний ярус открыт."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Финал — на рассвете!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunters surround quarters.",
        "narration": [
          "Окружение."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Ты сломала торговлю!"
          },
          {
            "speaker": "hana",
            "text": "Торговля сломала людей. Я это чиню."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Escapes via rooftop garden.",
        "narration": [
          "Побег по крыше."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Цветы — лестница."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 9,
        "scene": "Rain roof toward upper tier.",
        "narration": [
          "Крыша под дождём."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Финал ждёт шов."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Chapter VIII end.",
        "narration": [
          "Глава VIII."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Шов на арене — не метафора. Сейчас."
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
        "scene": "Arena backstage mist — SHADOWED trio, pink medic + crimson armor + mountain fury.",
        "narration": [
          "Закулисье. Туман. Три силуэта у трещины."
        ],
        "dialogue": [
          {
            "speaker": "hana",
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
        "scene": "red-armored katana and dual-axe giant SILHOUETTE — NOT full faces.",
        "narration": [
          "Два силуэта по бокам. Лица скрыты."
        ],
        "dialogue": [
          {
            "speaker": "hana",
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
            "speaker": "hana",
            "text": "Если вы против них — говорите быстрее."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Triangle: pink medic + crimson armor + mountain fury.",
        "narration": [
          "Три цвета в тумане сходятся."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Месть — дорога без выхода."
          },
          {
            "speaker": "hana",
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
            "speaker": "hana",
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
            "speaker": "hana",
            "text": "Легенда — не пустота. Я помню имена."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sky marks: katana, axe, hero symbol.",
        "narration": [
          "В небе проступают три знака."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Три пути. Один враг. Пока идём вместе."
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
            "speaker": "hana",
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
            "speaker": "hana",
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
            "speaker": "hana",
            "text": "Спор трёх путей. Ответ — завтра на песке."
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
    "title": "Клятва передовой",
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
            "speaker": "hana",
            "text": "Сегодня зал полон."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: ronin — match ronin_skin1.png.",
        "narration": [
          "Ронин выходит — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "ronin",
            "text": "Линия держится, когда честь не спит."
          },
          {
            "speaker": "hana",
            "text": "Слышу. Лечи дальше."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: goro — match goro_skin1.png.",
        "narration": [
          "Горо — полный дизайн."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Ярость помнит твой сад. Мы обещали стычку."
          },
          {
            "speaker": "hana",
            "text": "Сад — не слабость. Не смей."
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
            "speaker": "hana",
            "text": "Слева — сети. Режем вместе."
          },
          {
            "speaker": "ronin",
            "text": "Щит держит."
          },
          {
            "speaker": "goro",
            "text": "Топоры крутятся."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 5,
        "scene": "Team combo: healing garden + stone katana + berserker spin.",
        "narration": [
          "Комбо суперов троих."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Сейчас!"
          },
          {
            "speaker": "ronin",
            "text": "Катана!"
          },
          {
            "speaker": "goro",
            "text": "Ярость!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 6,
        "scene": "vendrick descends upper gate.",
        "narration": [
          "Вендрик спускается."
        ],
        "dialogue": [
          {
            "speaker": "vendrick",
            "text": "Сдай раненых — купишь жизнь!"
          },
          {
            "speaker": "hana",
            "text": "Жизнь не продаётся."
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
            "speaker": "ronin",
            "text": "Суд — сталью."
          },
          {
            "speaker": "goro",
            "text": "Победа — топором."
          },
          {
            "speaker": "hana",
            "text": "Мой путь — мой. Идём дальше."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night sky: pink hospital + red armor + northern peaks over Arena.",
        "narration": [
          "Ночное небо над куполом."
        ],
        "dialogue": [
          {
            "speaker": "mika",
            "text": "Не превращай милосердие в товар."
          },
          {
            "speaker": "hana",
            "text": "Ношу память. Маску сниму."
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
            "speaker": "hana",
            "text": "Вперёд!"
          },
          {
            "speaker": "vendrick",
            "text": "Трофеи поглотят вас!"
          },
          {
            "speaker": "goro",
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
            "speaker": "hana",
            "text": "Имя на табло — не конец. Ещё не конец."
          },
          {
            "speaker": "ronin",
            "text": "Мы рядом."
          },
          {
            "speaker": "goro",
            "text": "До конца пути."
          }
        ],
        "sfx": "ВЕТЕР…"
      }
    ]
  }
};
const script = {
  brawlerId: "hana",
  brawlerName: "Хана",
  lore: "Хана — фронтовой медик из Розового госпиталя. Лечебные пули лечат союзников и пробивают броню врагов. Она ни разу не сдалась перед безнадёжным пациентом и верит, что добро должно быть достаточно сильным, чтобы ударить первым.",
  skinRef: "public/dev-notes/brawler-skins/hana_skin1.png",
  trioId: "oathbound-frontline",
  trioOthers: ["ronin","goro"],
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
  cover: { prompt: "finished full-color comic book cover, vertical 2:3 poster; hero Хана pink medic coat healing pistol, blooming garden hospital, wounded soldiers, palette #E91E8C #FCE4EC #FF80AB, title ХАНА Cyrillic, NO speech balloons, match hana_skin1.png" },
  chapters,
};
const outPath = path.join(__dirname, "hana-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
