import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const npcs = {
  "braggi": "Брагги — кузнец-старейшина: седой, молот, знает старые имена",
  "skald": "Скальд — певец памяти: лира, шрамы, поёт забытые имена",
  "krell": "Крелл — охотник клана: костяная броня, знает прошлое Горо",
  "totemKeeper": "Хранитель тотема — маска медведя, посох, молчалив",
  "herald": "Глашатай Арены — золотой рупор",
  "hunterCaptain": "Капитан охотников — белая маска, сети",
  "shadowVoice": "Голос из тени — союзник без лица"
};
const chapters = {
  "1": {
    "title": "Вершина без имени",
    "pages": [
      {
        "page": 1,
        "scene": "Wide: northern peaks above clouds, forge smoke.",
        "narration": [
          "Северные вершины без карт. Туман ниже — мир."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Сегодня куёшь или помнишь?"
          },
          {
            "speaker": "goro",
            "text": "Кую. Память — пусто."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Goro spins dual axes at training stones.",
        "narration": [
          "Двойные топоры рубят валуны."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Ритм как сердце."
          },
          {
            "speaker": "goro",
            "text": "Сердце помнит. Голова — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Flashback shard: child hand on axe — face blurred.",
        "narration": [
          "Осколок: детская рука на топоре. Лица нет."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Кто я был?"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Totem pole shows scratched fighter list.",
        "narration": [
          "Тотем со списком бойцов."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Имя стёрто ветром."
          },
          {
            "speaker": "goro",
            "text": "Ветер вернёт — или я сам."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Krell watches from ridge — clan hunter.",
        "narration": [
          "Крелл на гребне."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Ты наш. Утраченный."
          },
          {
            "speaker": "goro",
            "text": "Ваш — не значит, что помню."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Braggi hands newly forged axe pair.",
        "narration": [
          "Новая пара топоров."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Они тяжелее прошлых."
          },
          {
            "speaker": "goro",
            "text": "Тяжелее — и честнее."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Avalanche reveals Arena dome far south.",
        "narration": [
          "Лавина открывает вид на купол."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Там имя на камне."
          },
          {
            "speaker": "goro",
            "text": "Камень не врёт."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Berserker rage flicker — eyes orange.",
        "narration": [
          "Вспышка ярости."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Пламя без прошлого — только вперёд."
          }
        ],
        "sfx": "ГРРР!"
      },
      {
        "page": 9,
        "scene": "Night: name carved on totem matches arena poster.",
        "narration": [
          "Имя на тотеме = афиша Арены."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Список зовёт."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Goro walks down mountain.",
        "narration": [
          "Спуск с вершины."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Внизу — ответ. Иду."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "2": {
    "title": "Пепел памяти",
    "pages": [
      {
        "page": 1,
        "scene": "Village raid: clan burns memory shrine.",
        "narration": [
          "Клан сжигает святилище памяти."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Вернись домой!"
          },
          {
            "speaker": "goro",
            "text": "Дом — пепел."
          }
        ],
        "sfx": "БУМ!"
      },
      {
        "page": 2,
        "scene": "Skald wounded; Goro shields with axes.",
        "narration": [
          "Скальд ранен. Топоры — щит."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Пой… имя…"
          },
          {
            "speaker": "goro",
            "text": "Пою топором. Держись."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Memory void — childhood blank.",
        "narration": [
          "Провал: детство пусто."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Что вы забрали?"
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Finds arena fighter token with old name.",
        "narration": [
          "Жетон бойца со старым именем."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Это ты. До снега."
          },
          {
            "speaker": "goro",
            "text": "Снег стёр. Сталь — помнит."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Krell reveals clan erased his past.",
        "narration": [
          "Крелл: клан стёр его прошлое."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Ты был нашим вождем."
          },
          {
            "speaker": "goro",
            "text": "Был — не значит, что помню."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Axe spin clears raiders.",
        "narration": [
          "Вихрь топоров."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Пепел — не ответ. Иду дальше."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 7,
        "scene": "Totem piece in pocket — promise.",
        "narration": [
          "Кусок тотема в кармане."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Верни имя на камень."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Leaves burning peaks.",
        "narration": [
          "Уходит с гор."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Топоры помнят руки."
          },
          {
            "speaker": "goro",
            "text": "Руки помнят победу. Голова — скоро."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Arena road through pass.",
        "narration": [
          "Дорога к куполу."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Песок хранит имена."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Silhouette against snow and dome.",
        "narration": [
          "Силуэт на снегу."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава II. Имя — впереди. Иду."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "3": {
    "title": "Вихрь двух топоров",
    "pages": [
      {
        "page": 1,
        "scene": "Pass ambush: bone-armor collectors.",
        "narration": [
          "Засада сборщиков."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Беги!"
          },
          {
            "speaker": "goro",
            "text": "Бегу вперёд."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "360 axe spin — signature debut.",
        "narration": [
          "Вихрь 360° — визитка."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Два топора — один круг. Смотри."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 3,
        "scene": "Enemy shields shatter twice.",
        "narration": [
          "Щиты ломаются дважды."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Ни один не выдержал."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Skald records fight in song.",
        "narration": [
          "Скальд записывает бой."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Песня без имени — пока."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Finds arena registration booth in pass.",
        "narration": [
          "Стоянка регистрации."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Имя?"
          },
          {
            "speaker": "goro",
            "text": "Скажу на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Krell offers clan deal — memory for loyalty.",
        "narration": [
          "Сделка клана."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Вернись — вспомнишь."
          },
          {
            "speaker": "goro",
            "text": "Вспомню сам."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night rage training — orange aura.",
        "narration": [
          "Ночная ярость."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Пламя не спрашивает, кто я. Хорошо."
          }
        ],
        "sfx": "ГРРР!"
      },
      {
        "page": 8,
        "scene": "Totem name glows on poster.",
        "narration": [
          "Имя на афише светится."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Список ждёт."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Dome close.",
        "narration": [
          "Купол близко."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Тотем в списке — зов."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Axe over shoulder to gates.",
        "narration": [
          "Топор на плече."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава III. Вихрь — мой язык. Слушай."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "4": {
    "title": "Тотем в списке",
    "pages": [
      {
        "page": 1,
        "scene": "Arena outer wall: fighter list carved.",
        "narration": [
          "Список бойцов на стене."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Имя… знакомое пустое."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Clerk finds his totem mark.",
        "narration": [
          "Клерк узнаёт метку тотема."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Старое имя в базе!"
          },
          {
            "speaker": "goro",
            "text": "Старое — не мёртвое. Запомни."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Register alias Mountain Break.",
        "narration": [
          "Псевдоним «Горный излом»."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Имя на ветру. Пока."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Krell in crowd — watching.",
        "narration": [
          "Крелл в толпе."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Домой, утраченный."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Patent of past fights — empty pages.",
        "narration": [
          "Архив боёв — пустые страницы."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Кто-то стёр историю."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Braggi letter: axes were child's size once.",
        "narration": [
          "Письмо: топоры детского размера."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Руки выросли. Память — пока нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Inquisitor of memory hunters offers trade.",
        "narration": [
          "Охотники за памятью."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Сдай тотем!"
          },
          {
            "speaker": "goro",
            "text": "Тотем — мой якорь."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Axe carves own mark beside old name.",
        "narration": [
          "Режет новую метку рядом."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Два имени. Одно тело. Хватит."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Lower gate opens.",
        "narration": [
          "Ворота."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "На песок!"
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Steps on sand.",
        "narration": [
          "Первый шаг на песок."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава IV. Тотем ответил."
          }
        ],
        "sfx": null
      }
    ]
  },
  "5": {
    "title": "Клан старого знака",
    "pages": [
      {
        "page": 1,
        "scene": "Slums: krell gang hunts goro.",
        "narration": [
          "Крелл и банда."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Вернись!"
          },
          {
            "speaker": "goro",
            "text": "Вернусь с именем."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Chase on rooftops — axes cut nets.",
        "narration": [
          "Крыши. Сети рвутся."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Сети — для слабых. Рви."
          }
        ],
        "sfx": "РВАНЬ!"
      },
      {
        "page": 3,
        "scene": "Skald captured as bait.",
        "narration": [
          "Скальд в заложниках."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Пой без меня!"
          },
          {
            "speaker": "goro",
            "text": "Пойду с тобой."
          }
        ],
        "sfx": null
      },
      {
        "page": 4,
        "scene": "Rescue spin attack.",
        "narration": [
          "Спасение вихрем."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Круг — мой ответ. Держись."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 5,
        "scene": "Krell shows photo shard — child goro.",
        "narration": [
          "Осколок: детское лицо."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Это ты."
          },
          {
            "speaker": "goro",
            "text": "Лицо… почти."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Clan knows his past — won't tell free.",
        "narration": [
          "Клан знает — молчит."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Плати кровью."
          },
          {
            "speaker": "goro",
            "text": "Плачу победой. Не кровью."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Totem ritual flash — almost remembers.",
        "narration": [
          "Ритуал. Почти вспомнил."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Ещё шаг."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Hunter captain joins krell.",
        "narration": [
          "Капитан с Креллом."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Память — товар."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Map to memory vault under arena.",
        "narration": [
          "Хранилище памяти под ареной."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Там — имя."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Night eyes glow.",
        "narration": [
          "Ночь. Глаза оранжевые."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава V. Клан старого знака."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "6": {
    "title": "Ярость и пустота",
    "pages": [
      {
        "page": 1,
        "scene": "Cave shrine: empty mirror.",
        "narration": [
          "Пещера. Пустое зеркало."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Победа не отвечает, кем я был. Злюсь."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Flashback voice only — no face.",
        "narration": [
          "Голос без лица."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Голос памяти: стой!"
          },
          {
            "speaker": "goro",
            "text": "Стою. Не помню зачем."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Berserker super preview — speed and damage.",
        "narration": [
          "Ярость берсерка."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Пламя заполняет пустоту. Пока."
          }
        ],
        "sfx": "КРАК!"
      },
      {
        "page": 4,
        "scene": "Skald argues: name vs victory.",
        "narration": [
          "Спор."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Имя важнее победы?"
          },
          {
            "speaker": "goro",
            "text": "Победа — пока единственное имя, что помню."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Carves two notches on axe — rage and truth.",
        "narration": [
          "Две насечки."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Ярость. Правда."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Krell offer: memory restore if surrender.",
        "narration": [
          "Предложение Крелла."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Сдайся — вспомнишь."
          },
          {
            "speaker": "goro",
            "text": "Вспомню на песке."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Dream: axes forged by child hands.",
        "narration": [
          "Сон: детские руки куют."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Голос кузни: это ты."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Tribunal trial by combat for memory vault.",
        "narration": [
          "Трибунал: бой за хранилище."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Победи — открой архив."
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Walks to gate in calm rage.",
        "narration": [
          "Спокойная ярость."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Пустота — не слабость. Запомни."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Northern wind at gate.",
        "narration": [
          "Северный ветер."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава VI. Ярость и пустота — вместе идут."
          }
        ],
        "sfx": null
      }
    ]
  },
  "7": {
    "title": "Ворота северного ветра",
    "pages": [
      {
        "page": 1,
        "scene": "Lower ring entry — crowd roars.",
        "narration": [
          "Нижний круг."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "«Горный излом»!"
          },
          {
            "speaker": "goro",
            "text": "Излом — только начало."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "First foe: shield wall.",
        "narration": [
          "Стена щитов."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Два удара. Два щита. Ноль."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "Spin breaks wall — signature.",
        "narration": [
          "Вихрь ломает стену."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Круг завершён."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 4,
        "scene": "Crowd chants unknown old name.",
        "narration": [
          "Толпа скандирует старое имя."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Они помнят!"
          },
          {
            "speaker": "goro",
            "text": "Я — почти."
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Krell watches from VIP.",
        "narration": [
          "Крелл в ложе."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Ещё один бой — и сдашься."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Child fighter saved from tramplers.",
        "narration": [
          "Спас ребёнка."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Арена жрёт малых."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Night training rage control.",
        "narration": [
          "Контроль ярости."
        ],
        "dialogue": [
          {
            "speaker": "braggi",
            "text": "Голос: не стань пеплом."
          },
          {
            "speaker": "goro",
            "text": "Пепел — не цель."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Signs fight vs Memory Lord.",
        "narration": [
          "Вызов «Лорду памяти»."
        ],
        "dialogue": [
          {
            "speaker": "herald",
            "text": "Крелл на песке!"
          }
        ],
        "sfx": null
      },
      {
        "page": 9,
        "scene": "Axes sharpened.",
        "narration": [
          "Заточка."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Сталь помнит руку."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Upper tier calls.",
        "narration": [
          "Верхний ярус."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Глава VII. Ветер с севера."
          }
        ],
        "sfx": "ШШШ…"
      }
    ]
  },
  "8": {
    "title": "Берсерк на песке",
    "pages": [
      {
        "page": 1,
        "scene": "Mid ring: Krell in bone armor.",
        "narration": [
          "Крелл на песке."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Имя принадлежит клану!"
          },
          {
            "speaker": "goro",
            "text": "Имя — моё. Клан — нет."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "Brutal exchange — shields useless.",
        "narration": [
          "Обмен ударами."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Щиты — ложь. Рублю дальше."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 3,
        "scene": "Berserker super — orange trail.",
        "narration": [
          "Ярость берсерка на песке."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "ПЛАМЯ!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 4,
        "scene": "Memory shard flies from krell mask.",
        "narration": [
          "Осколок памяти из маски."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Лицо… моё?"
          }
        ],
        "sfx": null
      },
      {
        "page": 5,
        "scene": "Wins — spares krell.",
        "narration": [
          "Победа без убийства."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Живи. Расскажи правду."
          }
        ],
        "sfx": null
      },
      {
        "page": 6,
        "scene": "Vault opens — name almost readable.",
        "narration": [
          "Хранилище. Имя почти ясно."
        ],
        "dialogue": [
          {
            "speaker": "totemKeeper",
            "text": "Ещё один бой."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Hunters mass.",
        "narration": [
          "Окружение."
        ],
        "dialogue": [
          {
            "speaker": "hunterCaptain",
            "text": "Память — наша!"
          },
          {
            "speaker": "goro",
            "text": "Память — моя работа. Отдай."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Escape over net tower.",
        "narration": [
          "Побег."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Вверх — как с вершины."
          }
        ],
        "sfx": "ВЖУХ!"
      },
      {
        "page": 9,
        "scene": "Rain on upper walkway.",
        "narration": [
          "Дождь."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Имя в камне — близко."
          }
        ],
        "sfx": null
      },
      {
        "page": 10,
        "scene": "Finale eve.",
        "narration": [
          "Глава VIII."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Берсерк на песке — не конец. Ещё бой."
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
        "scene": "Arena backstage mist — SHADOWED trio, mountain fury + pink medic + crimson honor.",
        "narration": [
          "Закулисье. Туман. Три силуэта у трещины."
        ],
        "dialogue": [
          {
            "speaker": "goro",
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
        "scene": "pink medic coat and red-armored katana SILHOUETTE — NOT full faces.",
        "narration": [
          "Два силуэта по бокам. Лица скрыты."
        ],
        "dialogue": [
          {
            "speaker": "goro",
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
            "speaker": "goro",
            "text": "Если вы против них — говорите быстрее."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 4,
        "scene": "Triangle: mountain fury + pink medic + crimson honor.",
        "narration": [
          "Три цвета в тумане сходятся."
        ],
        "dialogue": [
          {
            "speaker": "shadowVoice",
            "text": "Месть — дорога без выхода."
          },
          {
            "speaker": "goro",
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
            "speaker": "goro",
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
            "speaker": "goro",
            "text": "Легенда — не пустота. Помню топор."
          }
        ],
        "sfx": null
      },
      {
        "page": 7,
        "scene": "Sky marks: bloom, katana, hero symbol.",
        "narration": [
          "В небе проступают три знака."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Три пути. Один враг. Пока вместе."
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
            "speaker": "goro",
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
            "speaker": "goro",
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
            "speaker": "goro",
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
    "title": "Имя в камне",
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
            "speaker": "goro",
            "text": "Сегодня зал полон."
          }
        ],
        "sfx": null
      },
      {
        "page": 2,
        "scene": "FULL COLOR: hana — match hana_skin1.png.",
        "narration": [
          "Хана выходит — полный облик."
        ],
        "dialogue": [
          {
            "speaker": "hana",
            "text": "Линия держится, когда ярость слушает."
          },
          {
            "speaker": "goro",
            "text": "Слушаю. Режу дальше."
          }
        ],
        "sfx": null
      },
      {
        "page": 3,
        "scene": "FULL COLOR: ronin — match ronin_skin1.png.",
        "narration": [
          "Ронин — полный дизайн."
        ],
        "dialogue": [
          {
            "speaker": "ronin",
            "text": "Честь помнит твои топоры."
          },
          {
            "speaker": "goro",
            "text": "Честь — тяжелее камня. Несу."
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
            "speaker": "goro",
            "text": "Слева — сети. Режем вместе."
          },
          {
            "speaker": "hana",
            "text": "Сад держит."
          },
          {
            "speaker": "ronin",
            "text": "Щит держит."
          }
        ],
        "sfx": "КЛАНГ!"
      },
      {
        "page": 5,
        "scene": "Team combo: berserker spin + blooming garden + stone katana.",
        "narration": [
          "Комбо суперов троих."
        ],
        "dialogue": [
          {
            "speaker": "goro",
            "text": "Сейчас!"
          },
          {
            "speaker": "hana",
            "text": "Цвети!"
          },
          {
            "speaker": "ronin",
            "text": "Катана!"
          }
        ],
        "sfx": "КРАК-БУМ!"
      },
      {
        "page": 6,
        "scene": "krell descends upper gate.",
        "narration": [
          "Крелл спускается."
        ],
        "dialogue": [
          {
            "speaker": "krell",
            "text": "Вернись, утраченный! Имя — наше!"
          },
          {
            "speaker": "goro",
            "text": "Имя — моё. Не ваше."
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
            "speaker": "hana",
            "text": "Лечить — не слабость."
          },
          {
            "speaker": "ronin",
            "text": "Суд — сталью."
          },
          {
            "speaker": "goro",
            "text": "Мой путь — мой. Идём."
          }
        ],
        "sfx": null
      },
      {
        "page": 8,
        "scene": "Night sky: northern peaks + pink hospital + red armor over Arena.",
        "narration": [
          "Ночное небо над куполом."
        ],
        "dialogue": [
          {
            "speaker": "skald",
            "text": "Не носи чужое имя как кандалы."
          },
          {
            "speaker": "goro",
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
            "speaker": "goro",
            "text": "Вперёд!"
          },
          {
            "speaker": "krell",
            "text": "Память поглотит тебя!"
          },
          {
            "speaker": "ronin",
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
            "speaker": "goro",
            "text": "Имя на табло — не конец. Ещё не конец."
          },
          {
            "speaker": "hana",
            "text": "Мы рядом."
          },
          {
            "speaker": "ronin",
            "text": "До конца пути."
          }
        ],
        "sfx": "ВЕТЕР…"
      }
    ]
  }
};
const script = {
  brawlerId: "goro",
  brawlerName: "Горо",
  lore: "Горо — горный варвар с северных вершин. Он не помнит детства, но помнит вкус победы. Двойные топоры выкованы его руками; ярость берсерка делает его лучшим ближним бойцом Арены.",
  skinRef: "public/dev-notes/brawler-skins/goro_skin1.png",
  trioId: "oathbound-frontline",
  trioOthers: ["hana","ronin"],
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
  cover: { prompt: "finished full-color comic book cover, vertical 2:3; hero Горо giant bearded barbarian dual axes, northern peaks, fire rage, palette #8D4E2B #FF3D00 #BF360C, title ГОРО Cyrillic, NO speech balloons, match goro_skin1.png" },
  chapters,
};
const outPath = path.join(__dirname, "goro-page-script.json");
fs.writeFileSync(outPath, JSON.stringify(script, null, 2), "utf8");
console.log("Wrote", outPath);
