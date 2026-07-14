import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = {
  "emma": "Эмма — мать механика: пайка, чай, тревожные руки",
  "beetleBrother": "Жук-брат — бронзовый, хранит голос памяти",
  "collector": "Коллекционер механизмов — витрина, холодные глаза",
  "rivalTinker": "Пакс — соперник-ученик: зависть к репликатору",
  "herald": "Глашатай Арены — золотой рупор",
  "hunterCaptain": "Капитан охотников — белая маска",
  "shadowVoice": "Голос из тени — союзник без лица"
};
const chapters = {
  "1": {
    "title": "Мастерская на рассвете",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: мастерская, Оливер center frame, signature motif.",
        "narration": [
          "Мастерская на рассвете. мастерская — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Оливер, опять не спал? Жуки жужжат с пяти утра."
          },
          {
            "speaker": "oliver",
            "text": "Они не спят. Я с ними."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at мастерская.",
        "narration": [
          "Мастерская на рассвете. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Ж-ж. Память проснулась. Репликатор держит?"
          },
          {
            "speaker": "oliver",
            "text": "Держит. Ещё один тест — и поедем."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at мастерская — wound that drives the arc.",
        "narration": [
          "Мастерская на рассвете. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Тогда завод рухнул. Брат успел нажать одну кнопку."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at мастерская; enemy scouts on horizon.",
        "narration": [
          "Мастерская на рассвете. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Пакс опять подсматривает через окно!"
          },
          {
            "speaker": "oliver",
            "text": "Пусть смотрит. Сегодня я не один."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at мастерская; crowd or witnesses react.",
        "narration": [
          "Мастерская на рассвете. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Ты опять выпустил их на улицу!"
          },
          {
            "speaker": "oliver",
            "text": "Все вернулись. Это главное."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at мастерская; memory and doubt.",
        "narration": [
          "Мастерская на рассвете. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Мама спит. А я думаю — прав ли был брат."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from мастерская; call answered.",
        "narration": [
          "Мастерская на рассвете. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Купол Арены пульсирует. Слышишь?"
          },
          {
            "speaker": "oliver",
            "text": "Слышу. Отвечу, когда закончу корпус."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at мастерская; no turning back.",
        "narration": [
          "Мастерская на рассвете. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Подашь заявку — назад не вернёшься."
          },
          {
            "speaker": "oliver",
            "text": "Назад и не надо. Вперёд — к схеме."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at мастерская; super move foreshadowed.",
        "narration": [
          "Мастерская на рассвете. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Рой вспыхнул… Репликатор что-то схватил."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at мастерская; chapter end.",
        "narration": [
          "Глава 1. Мастерская на рассвете."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Схема жива. Идём?"
          },
          {
            "speaker": "oliver",
            "text": "Идём. Жуки впереди."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Жук, который помнит",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: комната брата, Оливер center frame, signature motif.",
        "narration": [
          "Жук, который помнит. комната брата — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Открой. Мне нужен один жук для витрины."
          },
          {
            "speaker": "oliver",
            "text": "Нет. Это не вещь."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at комната брата.",
        "narration": [
          "Жук, который помнит. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Покажи чип. Я знаю, ты его спрятал."
          },
          {
            "speaker": "oliver",
            "text": "Спрятал — значит, не твоё."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at комната брата — wound that drives the arc.",
        "narration": [
          "Жук, который помнит. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Первый раз увидел его… уже без глаз. Только жужжание."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at комната брата; enemy scouts on horizon.",
        "narration": [
          "Жук, который помнит. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Я помню его голос. Теперь он во мне."
          },
          {
            "speaker": "oliver",
            "text": "Тогда не молчи. Я слушаю."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at комната брата; crowd or witnesses react.",
        "narration": [
          "Жук, который помнит. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Назови цену. Любую."
          },
          {
            "speaker": "oliver",
            "text": "Цены нет. Есть память."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at комната брата; memory and doubt.",
        "narration": [
          "Жук, который помнит. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Это всё ещё он… или только моя копия?"
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from комната брата; call answered.",
        "narration": [
          "Жук, который помнит. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Ты тоже слышишь этот гул?"
          },
          {
            "speaker": "oliver",
            "text": "Слышу. Арена зовёт не меня одного."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at комната брата; no turning back.",
        "narration": [
          "Жук, который помнит. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Охотники уже смотрят на твою комнату."
          },
          {
            "speaker": "oliver",
            "text": "Пусть смотрят. Жуки не сдадут."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at комната брата; super move foreshadowed.",
        "narration": [
          "Жук, который помнит. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Рой проснулся сам. Без команды."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at комната брата; chapter end.",
        "narration": [
          "Глава 2. Жук, который помнит."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Мы помним вместе."
          },
          {
            "speaker": "oliver",
            "text": "Тогда держись. Дальше — лаборатория."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "3": {
    "title": "Репликатор молчит",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: лаборатория, Оливер center frame, signature motif.",
        "narration": [
          "Репликатор молчит. лаборатория — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Зачем ты снова в чужой лаборатории?"
          },
          {
            "speaker": "oliver",
            "text": "Здесь ток чище. Репликатору нужен чистый ток."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at лаборатория.",
        "narration": [
          "Репликатор молчит. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Ж-ж… тишина. Он молчит."
          },
          {
            "speaker": "oliver",
            "text": "Значит, ещё не готов. Подожду."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at лаборатория — wound that drives the arc.",
        "narration": [
          "Репликатор молчит. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Первая попытка копии… ударила меня, не врага."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at лаборатория; enemy scouts on horizon.",
        "narration": [
          "Репликатор молчит. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Я видел твой чертёж. Отдай кусок!"
          },
          {
            "speaker": "oliver",
            "text": "Видел — не значит понял. Отойди."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at лаборатория; crowd or witnesses react.",
        "narration": [
          "Репликатор молчит. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Хватит. Ты сгоришь вместе с этой машиной."
          },
          {
            "speaker": "oliver",
            "text": "Не сгорю. Я уже однажды выжил."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at лаборатория; memory and doubt.",
        "narration": [
          "Репликатор молчит. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Репликатор молчит. Как брат в тот день."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from лаборатория; call answered.",
        "narration": [
          "Репликатор молчит. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Лабораторию сдают завтра. У тебя ночь."
          },
          {
            "speaker": "oliver",
            "text": "Ночи хватит. Жуки прикроют."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at лаборатория; no turning back.",
        "narration": [
          "Репликатор молчит. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Продай схему — куплю тебе новую лабораторию."
          },
          {
            "speaker": "oliver",
            "text": "Не продаю. Особенно тебе."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at лаборатория; super move foreshadowed.",
        "narration": [
          "Репликатор молчит. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Вспышка… Репликатор на секунду ожил."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at лаборатория; chapter end.",
        "narration": [
          "Глава 3. Репликатор молчит."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Он сказал: 뿯½ещё рано뿯½."
          },
          {
            "speaker": "oliver",
            "text": "Значит, успею."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "4": {
    "title": "Коллекционер пришёл",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: рынок, Оливер center frame, signature motif.",
        "narration": [
          "Коллекционер пришёл. рынок — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Рынок любит редкости. Твои жуки — редкость."
          },
          {
            "speaker": "oliver",
            "text": "Не товар. Уберите витрину."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at рынок.",
        "narration": [
          "Коллекционер пришёл. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Я не стучал в охотников. Клянусь!"
          },
          {
            "speaker": "oliver",
            "text": "Клянись работой. Покажи схему."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at рынок — wound that drives the arc.",
        "narration": [
          "Коллекционер пришёл. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Обвал. Темно. Жук нашёл меня по запаху масла."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at рынок; enemy scouts on horizon.",
        "narration": [
          "Коллекционер пришёл. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Я тащил тебя три часа. Не отпускал."
          },
          {
            "speaker": "oliver",
            "text": "Помню каждый поворот."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at рынок; crowd or witnesses react.",
        "narration": [
          "Коллекционер пришёл. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Сто тысяч за рой. Последнее предложение."
          },
          {
            "speaker": "oliver",
            "text": "И последний отказ."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at рынок; memory and doubt.",
        "narration": [
          "Коллекционер пришёл. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Память не продаётся. Даже голодным."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from рынок; call answered.",
        "narration": [
          "Коллекционер пришёл. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "За нами следят. Я видела белые маски."
          },
          {
            "speaker": "oliver",
            "text": "Видела — значит, уходим через крышу."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at рынок; no turning back.",
        "narration": [
          "Коллекционер пришёл. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Они знают, где ты. Я… случайно болтал."
          },
          {
            "speaker": "oliver",
            "text": "Потом разберёмся. Сейчас — беги."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at рынок; super move foreshadowed.",
        "narration": [
          "Коллекционер пришёл. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Рой! Закрой им выход!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at рынок; chapter end.",
        "narration": [
          "Глава 4. Коллекционер пришёл."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Это не конец, мальчик."
          },
          {
            "speaker": "oliver",
            "text": "Для вас — только начало проблем."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "5": {
    "title": "Рой на крыше",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: крыша, Оливер center frame, signature motif.",
        "narration": [
          "Рой на крыше. крыша — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "На крыше? Ты с ума сошёл!"
          },
          {
            "speaker": "oliver",
            "text": "Снизу маски. Сверху — воздух."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at крыша.",
        "narration": [
          "Рой на крыше. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Ветер мешает калибровке."
          },
          {
            "speaker": "oliver",
            "text": "Подстрою. Репликатор любит вызов."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at крыша — wound that drives the arc.",
        "narration": [
          "Рой на крыше. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "После завода мы спали на крыше. Брат смеялся впервые."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at крыша; enemy scouts on horizon.",
        "narration": [
          "Рой на крыше. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Я принёс еду. Не думай, что прощаю."
          },
          {
            "speaker": "oliver",
            "text": "Еду возьму. Доверие — потом."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at крыша; crowd or witnesses react.",
        "narration": [
          "Рой на крыше. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Некуда бежать, механик!"
          },
          {
            "speaker": "oliver",
            "text": "Вам некуда прятаться от роя!"
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at крыша; memory and doubt.",
        "narration": [
          "Рой на крыше. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Клянусь: ни одного жука в чужую витрину."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from крыша; call answered.",
        "narration": [
          "Рой на крыше. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Листовка Арены. Нижний круг. Завтра."
          },
          {
            "speaker": "oliver",
            "text": "Завтра. Сегодня — дожить до рассвета."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at крыша; no turning back.",
        "narration": [
          "Рой на крыше. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Возьми меня. Я знаю их схемы охоты."
          },
          {
            "speaker": "oliver",
            "text": "Иди за мной. Один шаг — и проверим."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at крыша; super move foreshadowed.",
        "narration": [
          "Рой на крыше. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Рой накрывает квартал… Люди смотрят вверх."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at крыша; chapter end.",
        "narration": [
          "Глава 5. Рой на крыше."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Они видят нас. Не прячься."
          },
          {
            "speaker": "oliver",
            "text": "Не спрячусь. Завтра — песок."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "6": {
    "title": "Цена копии",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: клятва, Оливер center frame, signature motif.",
        "narration": [
          "Цена копии. клятва — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Ты клянёшься снова. На что на этот раз?"
          },
          {
            "speaker": "oliver",
            "text": "Копировать — только ради жизни. Не ради шоу."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at клятва.",
        "narration": [
          "Цена копии. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Чужой супер… это его голос?"
          },
          {
            "speaker": "oliver",
            "text": "Нет. Это мой выбор. Он бы так сказал."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at клятва — wound that drives the arc.",
        "narration": [
          "Цена копии. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "뿯½Любой дар — во благо뿯½. Он говорил это до конца."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at клятва; enemy scouts on horizon.",
        "narration": [
          "Цена копии. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Копия — это кража. Ты станешь вором."
          },
          {
            "speaker": "oliver",
            "text": "Стану живым вором. Лучше мёртвого честного."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at клятва; crowd or witnesses react.",
        "narration": [
          "Цена копии. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Я боюсь, кем ты станешь на том песке."
          },
          {
            "speaker": "oliver",
            "text": "Останусь собой. Жуки не дадут соврать."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at клятва; memory and doubt.",
        "narration": [
          "Цена копии. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Цена копии — чужая боль в моих руках."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from клятва; call answered.",
        "narration": [
          "Цена копии. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Подпиши контракт — жуков не тронут."
          },
          {
            "speaker": "oliver",
            "text": "Контракт горит. Смотри."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at клятва; no turning back.",
        "narration": [
          "Цена копии. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Они предложили мне место… если сдам тебя."
          },
          {
            "speaker": "oliver",
            "text": "Ты здесь. Значит, уже выбрал."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at клятва; super move foreshadowed.",
        "narration": [
          "Цена копии. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Репликатор… проглотил чужой супер. Больно."
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at клятва; chapter end.",
        "narration": [
          "Глава 6. Цена копии."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Держись. Это не он. Это ты."
          },
          {
            "speaker": "oliver",
            "text": "Знаю. Завтра — проверим на песке."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "7": {
    "title": "Первый бой на песке",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: песок, Оливер center frame, signature motif.",
        "narration": [
          "Первый бой на песке. песок — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Новичок с жуками! Нижний круг!"
          },
          {
            "speaker": "oliver",
            "text": "Я здесь. Жуки уже на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at песок.",
        "narration": [
          "Первый бой на песке. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Они поставили против тебя меха!"
          },
          {
            "speaker": "oliver",
            "text": "Мехи ломаются. Рой — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at песок — wound that drives the arc.",
        "narration": [
          "Первый бой на песке. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Первый бой… жук прикрыл мне лицо от осколка."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at песок; enemy scouts on horizon.",
        "narration": [
          "Первый бой на песке. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Песок скрипит. Сканирую."
          },
          {
            "speaker": "oliver",
            "text": "Видишь слабое место? Бей туда."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at песок; crowd or witnesses react.",
        "narration": [
          "Первый бой на песке. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Ставлю против тебя всё!"
          },
          {
            "speaker": "oliver",
            "text": "Проиграешь — вернёшь имена."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at песок; memory and doubt.",
        "narration": [
          "Первый бой на песке. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Руки дрожат. Жуки — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from песок; call answered.",
        "narration": [
          "Первый бой на песке. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Я на трибуне. Не смотри на меня — смотри на него!"
          },
          {
            "speaker": "oliver",
            "text": "Смотрю. Уже вижу дыру в броне."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at песок; no turning back.",
        "narration": [
          "Первый бой на песке. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Слева подключают турель!"
          },
          {
            "speaker": "oliver",
            "text": "Спасибо. Рой — налево!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at песок; super move foreshadowed.",
        "narration": [
          "Первый бой на песке. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Есть! Рой держит! Он сдаётся!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at песок; chapter end.",
        "narration": [
          "Глава 7. Первый бой на песке."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победа! Верхний ярус открыт!"
          },
          {
            "speaker": "oliver",
            "text": "Открыт… значит, коллекционер уже там."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "8": {
    "title": "Супер чужого",
    "pages": [
      {
        "page": 1,
        "scene": "Wide establishing: арена, Оливер center frame, signature motif.",
        "narration": [
          "Супер чужого. арена — утро ещё кажется обычным."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Средний круг! Покажи супер!"
          },
          {
            "speaker": "oliver",
            "text": "Покажу. Не свой — но честный."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Close-up: Оливер trains signature power at арена.",
        "narration": [
          "Супер чужого. Первые трещины будущей битвы ещё не слышны."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Смотри на его супер. Запоминай, мальчик."
          },
          {
            "speaker": "oliver",
            "text": "Уже запоминаю. Репликатор жужжит."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback inset at арена — wound that drives the arc.",
        "narration": [
          "Супер чужого. Тишину рвёт слишком тихий звук."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Копия… встала. Чужая сила в моих ладонях."
          }
        ],
        "sfx": "ТРЕСК!"
      },
      {
        "page": 4,
        "scene": "Ally scene at арена; enemy scouts on horizon.",
        "narration": [
          "Супер чужого. Поле испытания становится судом."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Больно? Я с тобой."
          },
          {
            "speaker": "oliver",
            "text": "Больно. Но работает."
          }
        ],
        "sfx": "WHOOSH!"
      },
      {
        "page": 5,
        "scene": "First counterattack at арена; crowd or witnesses react.",
        "narration": [
          "Супер чужого. Первый настоящий ответ."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Отдай репликатор! Сейчас!"
          },
          {
            "speaker": "oliver",
            "text": "Приди и возьми. Жуки ждут."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Night at арена; memory and doubt.",
        "narration": [
          "Супер чужого. Ночь. Память стучит в грудь."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Я использовал чужое… ради своих."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Arena dome visible from арена; call answered.",
        "narration": [
          "Супер чужого. Вдали — купол Арены."
        ],
        "dialogue": [
          {
            "speaker": "emma",
            "text": "Это был его удар… Ты прав?"
          },
          {
            "speaker": "oliver",
            "text": "Прав, если никто не погиб."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Commitment at арена; no turning back.",
        "narration": [
          "Супер чужого. Выбор, который нельзя стереть словами."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "Ты стал как они!"
          },
          {
            "speaker": "oliver",
            "text": "Нет. Я взял инструмент. Не душу."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Power flash at арена; super move foreshadowed.",
        "narration": [
          "Супер чужого. Вспышка силы рвёт привычный ритм."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Репликатор… выстрелил! Копия жива!"
          }
        ],
        "sfx": "KRAK-BOOM!"
      },
      {
        "page": 10,
        "scene": "Cliffhanger at арена; chapter end.",
        "narration": [
          "Глава 8. Супер чужого."
        ],
        "dialogue": [
          {
            "speaker": "rivalTinker",
            "text": "За кулисами… кто-то смотрит. Трое."
          },
          {
            "speaker": "oliver",
            "text": "Видел тени. Завтра — поговорим."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "9": {
    "title": "Спор трёх путей",
    "pages": [
      {
        "page": 1,
        "scene": "Arena backstage mist — SHADOWED trio, bronze beetles + lightning cage + brass forge.",
        "narration": [
          "Закулисье. Туман. Три силуэта у трещины."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
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
        "scene": "yellow lightning cage and brass wrench silhouette SILHOUETTE — NOT full faces.",
        "narration": [
          "Два силуэта по бокам. Лица скрыты."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
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
            "speaker": "oliver",
            "text": "Если вы против них — говорите быстрее."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Triangle: bronze beetles + lightning cage + brass forge.",
        "narration": [
          "Три цвета в тумане сходятся."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Месть — дорога без выхода."
          },
          {
            "speaker": "oliver",
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
            "speaker": "oliver",
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
            "speaker": "oliver",
            "text": "Я не пустышка. Проверь на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sky marks: coil, wrench, hero symbol.",
        "narration": [
          "В небе проступают три знака."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
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
            "speaker": "oliver",
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
            "speaker": "oliver",
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
            "speaker": "oliver",
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
    "title": "Сердце роя",
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
            "speaker": "oliver",
            "text": "Сегодня зал полон."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: kenji — match kenji_skin1.png.",
        "narration": [
          "Кенджи выходит — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "kenji",
            "text": "Клетка молний помнит твой рой."
          },
          {
            "speaker": "oliver",
            "text": "Молния и жуки — союз."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: taro — match taro_skin1.png.",
        "narration": [
          "Таро — полный дизайн."
        ],
        "dialogue": [
          {
            "speaker": "taro",
            "text": "Ключ помнит твоих жуков. Стычка у ворот."
          },
          {
            "speaker": "oliver",
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
            "speaker": "oliver",
            "text": "Слева — сети. Режем вместе."
          },
          {
            "speaker": "kenji",
            "text": "Молния прыгает."
          },
          {
            "speaker": "taro",
            "text": "Турель держит."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 5,
        "scene": "Team combo: beetle swarm + lightning cage + turret line.",
        "narration": [
          "Комбо суперов троих."
        ],
        "dialogue": [
          {
            "speaker": "oliver",
            "text": "Сейчас!"
          },
          {
            "speaker": "kenji",
            "text": "Клетка!"
          },
          {
            "speaker": "taro",
            "text": "Огонь!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 6,
        "scene": "collector descends upper gate.",
        "narration": [
          "Коллекционер спускается."
        ],
        "dialogue": [
          {
            "speaker": "collector",
            "text": "Отдай репликатор и жуков!"
          },
          {
            "speaker": "oliver",
            "text": "Брат — не вещь."
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
            "speaker": "taro",
            "text": "Изобретение — с сердцем."
          },
          {
            "speaker": "oliver",
            "text": "Чужой супер сработал. Я не ошибся."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night sky: family garage + university lab + iron workshop over Arena.",
        "narration": [
          "Ночное небо над куполом."
        ],
        "dialogue": [
          {
            "speaker": "beetleBrother",
            "text": "Не продавай память за болт."
          },
          {
            "speaker": "oliver",
            "text": "Не продам. Даже за витрину."
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
            "speaker": "oliver",
            "text": "Вперёд!"
          },
          {
            "speaker": "collector",
            "text": "Жуки — в витрину!"
          },
          {
            "speaker": "taro",
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
            "speaker": "oliver",
            "text": "Табло мигает. Мы ещё не закончили."
          },
          {
            "speaker": "kenji",
            "text": "Мы рядом."
          },
          {
            "speaker": "taro",
            "text": "До конца пути."
          }
        ],
        "sfx": "ВЕТЕР…"
      }
    ]
  }
};
const script = {
  brawlerId: "oliver",
  brawlerName: "Оливер",
  lore: "Оливер — гениальный механик, чьи механические жуки — уменьшенные копии его умершего брата, превращённого в машину. Он научился копировать вражеские суперы, потому что считает, что любой дар можно использовать во благо. Однако его репликатор хранит и память о том, как жук-брат однажды спас ему жизнь.",
  skinRef: "public/dev-notes/brawler-skins/oliver_skin1.png",
  trioId: "forge-swarm",
  trioOthers: ["kenji","taro"],
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
  cover: { prompt: "finished full-color comic book cover, vertical 2:3 poster; hero Oliver russet hair round glasses bronze beetles blue replicator, palette #795548 #FFD54F #42A5F5, title ОЛИВЕР Cyrillic, NO speech balloons, match oliver_skin1.png" },
  chapters,
};
const outPath = path.join(__dirname, "oliver-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
