import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const npcs = {
  "headArchivist": "Главный архивариус — седой, пергаментная кожа, печать стирания",
  "tome": "Том — запретная книга: красная обложка, пишет сама, голос как rustle",
  "pageBoy": "Паж — мальчик с чернильными пальцами, друг детства",
  "eraserSquad": "Отряд стирателей — белые маски, лезвия «забывания»",
  "gin": "Джин — диктор Арены",
  "sisterBell": "Сестра Колокол — монахиня из храма Yuki, приносит вести"
};

const chapters = {
  "1": {
    "title": "Шёпот полок",
    "pages": [
      {
        "page": 1,
        "scene": "Wide: academy library infinite stacks, candles float.",
        "narration": [
          "Библиотека шепчет."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Мирабель! Том снова двигается!"
          },
          {
            "speaker": "mirabel",
            "text": "Книги двигаются, когда им скучно."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Mirabel reads — sparks fly from book.",
        "narration": [
          "Искры из страниц."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Не огонь, а искра."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Head Archivist warns forbidden wing.",
        "narration": [
          "Предупреждение."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Некоторые главы стирают читателя."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Tome whispers her name.",
        "narration": [
          "Том зовёт."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…Мирабель… рано…"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Page Boy brings tea — talks of brother lost to tournament.",
        "narration": [
          "Паж о брате."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Он ушёл на Арену… и страница пустая…"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Mirabel finds blank page with brother name erased.",
        "narration": [
          "Стертое имя."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Кто стёр?"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Spark accelerates falling book — saves Page Boy.",
        "narration": [
          "Искра ускоряет спасение."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание быстрее камня!"
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 8,
        "scene": "Archivist orders curfew.",
        "narration": [
          "Комендантский час."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Ночью книги голодны."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Mirabel sneaks to forbidden wing.",
        "narration": [
          "Пробирается."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…открой…"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: tome opens itself — arena map.",
        "narration": [
          "Том открывается."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Арена… в главе, которой нет…"
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Ранняя страница",
    "pages": [
      {
        "page": 1,
        "scene": "Tome shows vision — brother on arena sand fading.",
        "narration": [
          "Видение брата."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…он пишет… медленно…"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Mirabel reads too fast — nose bleed ink.",
        "narration": [
          "Кровь-чернила."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Рано… но он…"
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Head Archivist catches — confiscates tome.",
        "narration": [
          "Конфiscation."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Слишком рано — правило академии!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Eraser squad arrives — blades hum.",
        "narration": [
          "Стиратели."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Имя брата — ошибка каталога."
          }
        ],
        "sfx": "ЖЖЖ!"
      },
      {
        "page": 5,
        "scene": "Page Boy hides torn page in shoe.",
        "narration": [
          "Страница в ботинке."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Не отдам!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Mirabel spark-boosts escape — shelves slide.",
        "narration": [
          "Ускорение побега."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Полки — щит!"
          }
        ],
        "sfx": "KRAK!"
      },
      {
        "page": 7,
        "scene": "Wound: trust in books shaken.",
        "narration": [
          "Рана."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание открыло рану раньше лекарства."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Tome whisper from locked vault.",
        "narration": [
          "Шёпот из vault."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…Arena… only… finish… chapter…"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Sister Bell letter: Yuki seeks lost bell brother.",
        "narration": [
          "Письмо."
        ],
        "dialogue": [
          {
            "speaker": "sisterBell",
            "text": "Храм ищет имя на ветру."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Wide: Mirabel at window, arena glow.",
        "narration": [
          "Глава II."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Ранняя страница… поздний выбор."
          }
        ],
        "sfx": null
      }
    ]
  },
  "3": {
    "title": "Искры в темноте",
    "pages": [
      {
        "page": 1,
        "scene": "Mirabel trains spark aim — accelerates clock pendulum.",
        "narration": [
          "Искра ускоряет маятник."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Время учится, если подтолкнуть."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Page Boy deciphers partial brother line.",
        "narration": [
          "Расшифровка."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "«Не стирай меня» — его почерк."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Eraser squad hunt in city.",
        "narration": [
          "Охота."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Беглянка знаний!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Mirabel knowledge spark hits eraser — slows erase.",
        "narration": [
          "Замедление стирания."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание цепляется!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 5,
        "scene": "Head Archivist secret: was eraser once.",
        "narration": [
          "Тайна."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Я стёр свою сестру… раскаяние…"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Tome sends page — super «Accelerated Learning» sketch.",
        "narration": [
          "Эскиз супера."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…team… twice…"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "First double-spark on ally Page Boy.",
        "narration": [
          "Двойной выстрел союзнику."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Я… быстрый…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Arena call: tome writes registration slot.",
        "narration": [
          "Слот регистрации."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Глава только на Арене."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Star chart on ceiling aligns dome.",
        "narration": [
          "Звёзды."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Звёздные ученики… слух?"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: eraser blade at Page Boy throat.",
        "narration": [
          "Лезвие."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Отдай страницу!"
          }
        ],
        "sfx": "KRAK!"
      }
    ]
  },
  "4": {
    "title": "Запретный том",
    "pages": [
      {
        "page": 1,
        "scene": "Escape to arena scholar quarter.",
        "narration": [
          "Квартал учёных."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Девочка с книгой — новинка!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Registration: Mirabel «Unwritten Chapter».",
        "narration": [
          "Псевдонim."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Имя напишу сама."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Tome sealed in special satchel — talks.",
        "narration": [
          "Сatcheль."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…chapter four… arena spring…"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Head Archivist offers deal — return tome for brother page.",
        "narration": [
          "Сделка."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Обмен…"
          },
          {
            "speaker": "mirabel",
            "text": "Не торгую друзьями."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Eraser squad vs Mirabel — ink sparks vs erase blades.",
        "narration": [
          "Бой."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Слово стереть можно. Память — нет."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 6,
        "scene": "Sister Bell arrives — link to Yuki temple.",
        "narration": [
          "Колокол."
        ],
        "dialogue": [
          {
            "speaker": "sisterBell",
            "text": "Сестра Yuki слышала искру."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Elian star chart graffiti — foreshadow.",
        "narration": [
          "Гraffiti созвездия."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Звёзды… отвечают…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Page Boy safe in library hideout.",
        "narration": [
          "Паж в безопасности."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Пиши нас обратно!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Tournament bracket vs chief eraser.",
        "narration": [
          "Bracket."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Остановите её. Или учитесь."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: tome page burns without ash.",
        "narration": [
          "Страница горит."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…десятая… faces…"
          }
        ],
        "sfx": null
      }
    ]
  },
  "5": {
    "title": "Архивариусы стирания",
    "pages": [
      {
        "page": 1,
        "scene": "Chase through scriptorium mobile stairs.",
        "narration": [
          "Погоня."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Забыть. Милосердие!"
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 2,
        "scene": "Mirabel accelerates allies — scribes help block.",
        "narration": [
          "Писцы помогают."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание. Коллектив!"
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Chief eraser reveals brother erased by arena contract.",
        "narration": [
          "Правда."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Arena buys names!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Mirabel rage spark — almost burns tome.",
        "narration": [
          "Ярость."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…не я…"
          },
          {
            "speaker": "mirabel",
            "text": "Прости."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Head Archivist defends Mirabel — exile from order.",
        "narration": [
          "Изgnание."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Иди. Пиши правду."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Page Boy delivers restored fragment.",
        "narration": [
          "Фрагмент."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "«Жив». Одно слово!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hope: brother alive erased not dead.",
        "narration": [
          "Надежда."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Жив — значит, найду."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Super practice: team double attack hologram.",
        "narration": [
          "Гologram."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Ускоренное обучение. Дар команды."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Snow silhouette temple — Yuki?",
        "narration": [
          "Силуэт снега."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Звёздные ученики…"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: arena tabloid «Scholar Trio».",
        "narration": [
          "Гazeta."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Храм, библиотека, космос!"
          }
        ],
        "sfx": null
      }
    ]
  },
  "6": {
    "title": "Знание без контроля",
    "pages": [
      {
        "page": 1,
        "scene": "Mirror hall: Mirabel sees tyrant self burning books.",
        "narration": [
          "Зеркало тирана."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Кontrol. Не мудрость."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback: opened tome too early — Page Boy hurt.",
        "narration": [
          "Память."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Я верю… ты исправишь…"
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Debate Head Archivist: wisdom vs control.",
        "narration": [
          "Спор."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Знание без дисциplины…"
          },
          {
            "speaker": "mirabel",
            "text": "…дисциплина без сердца. Стирание."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Mirabel returns partial erased names to villagers.",
        "narration": [
          "Возврат имён."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Память. Общая книга."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Tome warns super drains reader life.",
        "narration": [
          "Цена."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…double… costs… page… of life…"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Mirabel accepts cost — one page blank willingly.",
        "narration": [
          "Пустая страница."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Запишу цену. Не откажусь."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Eraser squad member defects.",
        "narration": [
          "Перebежчик."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Хочу помнить…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Inner conflict: accelerate others vs own choice.",
        "narration": [
          "Кonфликт."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Ускорять. Не решать за них."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Sister Bell: Yuki frozen brother search.",
        "narration": [
          "Yuki."
        ],
        "dialogue": [
          {
            "speaker": "sisterBell",
            "text": "Лёд хранит имя."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: star + snow + book sign.",
        "narration": [
          "Знак."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Цена силы. Отпустить контроль."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Книга у ворот",
    "pages": [
      {
        "page": 1,
        "scene": "Gates: floating books guard replaced by Mirabel.",
        "narration": [
          "Книги у ворot."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Unwritten Chapter vs Chief Eraser!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Gate quiz; Mirabel answers with spark not words.",
        "narration": [
          "Ответ искрой."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание. Действие."
          }
        ],
        "sfx": "ЖЖЖ!"
      },
      {
        "page": 3,
        "scene": "Page Boy in stands — holds brother page.",
        "narration": [
          "Паж."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Жив!"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Head Archivist renounces eraser order publicly.",
        "narration": [
          "Renounce."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Стирать. Конец."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Chief eraser entrance — forget blade.",
        "narration": [
          "Chief."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Последняя страница. Твоя!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Tome glows — ready super.",
        "narration": [
          "Tom."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…together… write…"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Star silhouette and snow silhouette watch.",
        "narration": [
          "Силуэты."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Звёздные ученики… близко…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Crowd scholars chant names restore.",
        "narration": [
          "Имена."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "ПAMять VS ЗABыtie!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Gong tomorrow.",
        "narration": [
          "Gong."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": ""
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: Mirabel blank page floats — fills with «Жив».",
        "narration": [
          "Страница."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Брат… я иду…"
          }
        ],
        "sfx": "ГOНГ!"
      }
    ]
  },
  "8": {
    "title": "Ускоренное обучение на песке",
    "pages": [
      {
        "page": 1,
        "scene": "Match vs chief eraser on sand.",
        "narration": [
          "Бой."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Стиратель против искры!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Erase blade vs spark — sparks win tempo.",
        "narration": [
          "Tempo."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Быстрее, чем стирание!"
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Super: glowing book over allies — double attacks.",
        "narration": [
          "Супер."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Два удара!!!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 4,
        "scene": "Chief eraser blade breaks on tome cover.",
        "narration": [
          "Лomается."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Невозможно…"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Mirabel restores one erased name live — brother partial.",
        "narration": [
          "Восстановление."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Жив… где…"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Crowd remembers forgotten fighter.",
        "narration": [
          "Толпа."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Имя вернулось!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Chief eraser surrenders — asks to learn.",
        "narration": [
          "Surrender."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Научи… помнить…"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Head Archivist new order: preserve.",
        "narration": [
          "Новый order."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Пишем, не стираем."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Tome quieter — chapter almost complete.",
        "narration": [
          "Tom."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…good…"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: trio silhouettes star snow temple.",
        "narration": [
          "Силуэты."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": ""
          }
        ],
        "sfx": null
      }
    ]
  },
  "9": {
    "title": "Храм, библиотека, космос",
    "pages": [
      {
        "page": 1,
        "scene": "Backstage star fog.",
        "narration": [
          "Туман."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Кто пишет без чернил?"
          },
          {
            "speaker": "snowSilhouette",
            "text": "Лёд хранит имя."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "SILHOUETTE snow healer.",
        "narration": [
          "Yuki sil."
        ],
        "dialogue": [
          {
            "speaker": "snowSilhouette",
            "text": "Брат звенит к Арене."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "SILHOUETTE star coat.",
        "narration": [
          "Elian sil."
        ],
        "dialogue": [
          {
            "speaker": "starSilhouette",
            "text": "Звезда упала. Поднимем."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Eraser remnant attack.",
        "narration": [
          "Атака."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Искры. Щит!"
          }
        ],
        "sfx": "KRAK!"
      },
      {
        "page": 5,
        "scene": "Triangle debate lost names.",
        "narration": [
          "Спор."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Знание без контроля."
          },
          {
            "speaker": "snowSilhouette",
            "text": "Лечить, не замораживать."
          },
          {
            "speaker": "starSilhouette",
            "text": "Лететь, не падать."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Combo spark + snow + star.",
        "narration": [
          "Комbo."
        ],
        "dialogue": [
          {
            "speaker": "eraserSquad",
            "text": "Stop!"
          }
        ],
        "sfx": "BOOM!"
      },
      {
        "page": 7,
        "scene": "Vow chapter 10.",
        "narration": [
          "Клятва."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Лица и имена."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Sky book star snowflake.",
        "narration": [
          "Знаки."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Звёздные ученики."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Depart.",
        "narration": [
          "Уход."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": ""
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Cliffhanger: brother name full glow.",
        "narration": [
          "Имя."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…found…"
          }
        ],
        "sfx": "ТИК…"
      }
    ]
  },
  "10": {
    "title": "Глава без стирания",
    "pages": [
      {
        "page": 1,
        "scene": "Finale Starbound Scholars.",
        "narration": [
          "Финал."
        ],
        "dialogue": [
          {
            "speaker": "gin",
            "text": "Yuki! Mirabel! Elian!"
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR Yuki — match yuki_skin1.png.",
        "narration": [
          "Yuki."
        ],
        "dialogue": [
          {
            "speaker": "yuki",
            "text": "Снег и искра. Одна молитва."
          },
          {
            "speaker": "mirabel",
            "text": "И одна страница."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR Elian — match elian_skin1.png.",
        "narration": [
          "Elian."
        ],
        "dialogue": [
          {
            "speaker": "elian",
            "text": "Звёзды допишут конец."
          },
          {
            "speaker": "mirabel",
            "text": "Конец. Наш."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Trio vs eraser guild FULL.",
        "narration": [
          "Трое."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Искра!"
          },
          {
            "speaker": "yuki",
            "text": "Снег!"
          },
          {
            "speaker": "elian",
            "text": "Звезда!"
          }
        ],
        "sfx": "ГOНГ!"
      },
      {
        "page": 5,
        "scene": "Combo supers.",
        "narration": [
          "Комbo."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Ускоренное обучение!"
          },
          {
            "speaker": "yuki",
            "text": "Blizzard!"
          },
          {
            "speaker": "elian",
            "text": "Vortex!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 6,
        "scene": "Brother name restored on tabloid — alive in arena under alias.",
        "narration": [
          "Брат найден."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Жив!!!"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Page Boy hug.",
        "narration": [
          "Паж."
        ],
        "dialogue": [
          {
            "speaker": "pageBoy",
            "text": "Ты написала чудо!"
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Head Archivist tears eraser blades.",
        "narration": [
          "Клинки."
        ],
        "dialogue": [
          {
            "speaker": "headArchivist",
            "text": "Конец стирания."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Tome closes gently — sleeps.",
        "narration": [
          "Tom спит."
        ],
        "dialogue": [
          {
            "speaker": "tome",
            "text": "…complete…"
          },
          {
            "speaker": "gin",
            "text": "Записано!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "End card: Mirabel opens blank book — writes «Начало».",
        "narration": [
          "Конец."
        ],
        "dialogue": [
          {
            "speaker": "mirabel",
            "text": "Глава без стирания."
          },
          {
            "speaker": "yuki",
            "text": "Рядом."
          },
          {
            "speaker": "elian",
            "text": "Вперёд."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  }
};

const script = {
  brawlerId: "mirabel",
  brawlerName: "Мирабель",
  lore: "Мирабель выросла в библиотеке академии, где каждая книга шептала ей тайны. Она не стреляет огнём — она бросает искры знания, ускоряя союзников быстрее, чем враги успевают понять, что произошло. Её супер «Ускоренное обучение» превращает целую команду в мастеров, чьи следующие удары приходят дважды.",
  skinRef: "public/dev-notes/brawler-skins/mirabel_skin1.png",
  trioId: "starbound-scholars",
  trioOthers: ["yuki","elian"],
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
    prompt: "finished full-color comic book cover, vertical 2:3 poster; hero Mirabel girl red magic book knowledge sparks, whispering library shelves, accelerated pages flying, star chart ceiling, palette #E53935 #FFCDD2 #FF7043, title МИРАБЕЛЬ Cyrillic, match mirabel_skin1.png, NO speech balloons"
  },
  chapters
};

const outPath = path.join(__dirname, "mirabel-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
