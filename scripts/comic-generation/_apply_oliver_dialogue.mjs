import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildPath = path.join(__dirname, "build-oliver-script-v2.mjs");

/** chapter -> page -> dialogue[] */
const DIALOGUE = {
  "1": [
    [
      { speaker: "emma", text: "Оливер, опять не спал? Жуки жужжат с пяти утра." },
      { speaker: "oliver", text: "Они не спят. Я с ними." },
    ],
    [
      { speaker: "beetleBrother", text: "Ж-ж. Память проснулась. Репликатор держит?" },
      { speaker: "oliver", text: "Держит. Ещё один тест — и поедем." },
    ],
    [{ speaker: "oliver", text: "Тогда завод рухнул. Брат успел нажать одну кнопку." }],
    [
      { speaker: "rivalTinker", text: "Пакс опять подсматривает через окно!" },
      { speaker: "oliver", text: "Пусть смотрит. Сегодня я не один." },
    ],
    [
      { speaker: "emma", text: "Ты опять выпустил их на улицу!" },
      { speaker: "oliver", text: "Все вернулись. Это главное." },
    ],
    [{ speaker: "oliver", text: "Мама спит. А я думаю — прав ли был брат." }],
    [
      { speaker: "collector", text: "Купол Арены пульсирует. Слышишь?" },
      { speaker: "oliver", text: "Слышу. Отвечу, когда закончу корпус." },
    ],
    [
      { speaker: "rivalTinker", text: "Подашь заявку — назад не вернёшься." },
      { speaker: "oliver", text: "Назад и не надо. Вперёд — к схеме." },
    ],
    [{ speaker: "oliver", text: "Рой вспыхнул… Репликатор что-то схватил." }],
    [
      { speaker: "beetleBrother", text: "Схема жива. Идём?" },
      { speaker: "oliver", text: "Идём. Жуки впереди." },
    ],
  ],
  "2": [
    [
      { speaker: "collector", text: "Открой. Мне нужен один жук для витрины." },
      { speaker: "oliver", text: "Нет. Это не вещь." },
    ],
    [
      { speaker: "rivalTinker", text: "Покажи чип. Я знаю, ты его спрятал." },
      { speaker: "oliver", text: "Спрятал — значит, не твоё." },
    ],
    [{ speaker: "oliver", text: "Первый раз увидел его… уже без глаз. Только жужжание." }],
    [
      { speaker: "beetleBrother", text: "Я помню его голос. Теперь он во мне." },
      { speaker: "oliver", text: "Тогда не молчи. Я слушаю." },
    ],
    [
      { speaker: "collector", text: "Назови цену. Любую." },
      { speaker: "oliver", text: "Цены нет. Есть память." },
    ],
    [{ speaker: "oliver", text: "Это всё ещё он… или только моя копия?" }],
    [
      { speaker: "emma", text: "Ты тоже слышишь этот гул?" },
      { speaker: "oliver", text: "Слышу. Арена зовёт не меня одного." },
    ],
    [
      { speaker: "rivalTinker", text: "Охотники уже смотрят на твою комнату." },
      { speaker: "oliver", text: "Пусть смотрят. Жуки не сдадут." },
    ],
    [{ speaker: "oliver", text: "Рой проснулся сам. Без команды." }],
    [
      { speaker: "beetleBrother", text: "Мы помним вместе." },
      { speaker: "oliver", text: "Тогда держись. Дальше — лаборатория." },
    ],
  ],
  "3": [
    [
      { speaker: "emma", text: "Зачем ты снова в чужой лаборатории?" },
      { speaker: "oliver", text: "Здесь ток чище. Репликатору нужен чистый ток." },
    ],
    [
      { speaker: "beetleBrother", text: "Ж-ж… тишина. Он молчит." },
      { speaker: "oliver", text: "Значит, ещё не готов. Подожду." },
    ],
    [{ speaker: "oliver", text: "Первая попытка копии… ударила меня, не врага." }],
    [
      { speaker: "rivalTinker", text: "Я видел твой чертёж. Отдай кусок!" },
      { speaker: "oliver", text: "Видел — не значит понял. Отойди." },
    ],
    [
      { speaker: "emma", text: "Хватит. Ты сгоришь вместе с этой машиной." },
      { speaker: "oliver", text: "Не сгорю. Я уже однажды выжил." },
    ],
    [{ speaker: "oliver", text: "Репликатор молчит. Как брат в тот день." }],
    [
      { speaker: "collector", text: "Лабораторию сдают завтра. У тебя ночь." },
      { speaker: "oliver", text: "Ночи хватит. Жуки прикроют." },
    ],
    [
      { speaker: "rivalTinker", text: "Продай схему — куплю тебе новую лабораторию." },
      { speaker: "oliver", text: "Не продаю. Особенно тебе." },
    ],
    [{ speaker: "oliver", text: "Вспышка… Репликатор на секунду ожил." }],
    [
      { speaker: "beetleBrother", text: "Он сказал: 뿯½ещё рано뿯½." },
      { speaker: "oliver", text: "Значит, успею." },
    ],
  ],
  "4": [
    [
      { speaker: "collector", text: "Рынок любит редкости. Твои жуки — редкость." },
      { speaker: "oliver", text: "Не товар. Уберите витрину." },
    ],
    [
      { speaker: "rivalTinker", text: "Я не стучал в охотников. Клянусь!" },
      { speaker: "oliver", text: "Клянись работой. Покажи схему." },
    ],
    [{ speaker: "oliver", text: "Обвал. Темно. Жук нашёл меня по запаху масла." }],
    [
      { speaker: "beetleBrother", text: "Я тащил тебя три часа. Не отпускал." },
      { speaker: "oliver", text: "Помню каждый поворот." },
    ],
    [
      { speaker: "collector", text: "Сто тысяч за рой. Последнее предложение." },
      { speaker: "oliver", text: "И последний отказ." },
    ],
    [{ speaker: "oliver", text: "Память не продаётся. Даже голодным." }],
    [
      { speaker: "emma", text: "За нами следят. Я видела белые маски." },
      { speaker: "oliver", text: "Видела — значит, уходим через крышу." },
    ],
    [
      { speaker: "rivalTinker", text: "Они знают, где ты. Я… случайно болтал." },
      { speaker: "oliver", text: "Потом разберёмся. Сейчас — беги." },
    ],
    [{ speaker: "oliver", text: "Рой! Закрой им выход!" }],
    [
      { speaker: "collector", text: "Это не конец, мальчик." },
      { speaker: "oliver", text: "Для вас — только начало проблем." },
    ],
  ],
  "5": [
    [
      { speaker: "emma", text: "На крыше? Ты с ума сошёл!" },
      { speaker: "oliver", text: "Снизу маски. Сверху — воздух." },
    ],
    [
      { speaker: "beetleBrother", text: "Ветер мешает калибровке." },
      { speaker: "oliver", text: "Подстрою. Репликатор любит вызов." },
    ],
    [{ speaker: "oliver", text: "После завода мы спали на крыше. Брат смеялся впервые." }],
    [
      { speaker: "rivalTinker", text: "Я принёс еду. Не думай, что прощаю." },
      { speaker: "oliver", text: "Еду возьму. Доверие — потом." },
    ],
    [
      { speaker: "collector", text: "Некуда бежать, механик!" },
      { speaker: "oliver", text: "Вам некуда прятаться от роя!" },
    ],
    [{ speaker: "oliver", text: "Клянусь: ни одного жука в чужую витрину." }],
    [
      { speaker: "collector", text: "Листовка Арены. Нижний круг. Завтра." },
      { speaker: "oliver", text: "Завтра. Сегодня — дожить до рассвета." },
    ],
    [
      { speaker: "rivalTinker", text: "Возьми меня. Я знаю их схемы охоты." },
      { speaker: "oliver", text: "Иди за мной. Один шаг — и проверим." },
    ],
    [{ speaker: "oliver", text: "Рой накрывает квартал… Люди смотрят вверх." }],
    [
      { speaker: "beetleBrother", text: "Они видят нас. Не прячься." },
      { speaker: "oliver", text: "Не спрячусь. Завтра — песок." },
    ],
  ],
  "6": [
    [
      { speaker: "emma", text: "Ты клянёшься снова. На что на этот раз?" },
      { speaker: "oliver", text: "Копировать — только ради жизни. Не ради шоу." },
    ],
    [
      { speaker: "beetleBrother", text: "Чужой супер… это его голос?" },
      { speaker: "oliver", text: "Нет. Это мой выбор. Он бы так сказал." },
    ],
    [{ speaker: "oliver", text: "뿯½Любой дар — во благо뿯½. Он говорил это до конца." }],
    [
      { speaker: "rivalTinker", text: "Копия — это кража. Ты станешь вором." },
      { speaker: "oliver", text: "Стану живым вором. Лучше мёртвого честного." },
    ],
    [
      { speaker: "emma", text: "Я боюсь, кем ты станешь на том песке." },
      { speaker: "oliver", text: "Останусь собой. Жуки не дадут соврать." },
    ],
    [{ speaker: "oliver", text: "Цена копии — чужая боль в моих руках." }],
    [
      { speaker: "collector", text: "Подпиши контракт — жуков не тронут." },
      { speaker: "oliver", text: "Контракт горит. Смотри." },
    ],
    [
      { speaker: "rivalTinker", text: "Они предложили мне место… если сдам тебя." },
      { speaker: "oliver", text: "Ты здесь. Значит, уже выбрал." },
    ],
    [{ speaker: "oliver", text: "Репликатор… проглотил чужой супер. Больно." }],
    [
      { speaker: "beetleBrother", text: "Держись. Это не он. Это ты." },
      { speaker: "oliver", text: "Знаю. Завтра — проверим на песке." },
    ],
  ],
  "7": [
    [
      { speaker: "herald", text: "Новичок с жуками! Нижний круг!" },
      { speaker: "oliver", text: "Я здесь. Жуки уже на песке." },
    ],
    [
      { speaker: "rivalTinker", text: "Они поставили против тебя меха!" },
      { speaker: "oliver", text: "Мехи ломаются. Рой — нет." },
    ],
    [{ speaker: "oliver", text: "Первый бой… жук прикрыл мне лицо от осколка." }],
    [
      { speaker: "beetleBrother", text: "Песок скрипит. Сканирую." },
      { speaker: "oliver", text: "Видишь слабое место? Бей туда." },
    ],
    [
      { speaker: "collector", text: "Ставлю против тебя всё!" },
      { speaker: "oliver", text: "Проиграешь — вернёшь имена." },
    ],
    [{ speaker: "oliver", text: "Руки дрожат. Жуки — нет." }],
    [
      { speaker: "emma", text: "Я на трибуне. Не смотри на меня — смотри на него!" },
      { speaker: "oliver", text: "Смотрю. Уже вижу дыру в броне." },
    ],
    [
      { speaker: "rivalTinker", text: "Слева подключают турель!" },
      { speaker: "oliver", text: "Спасибо. Рой — налево!" },
    ],
    [{ speaker: "oliver", text: "Есть! Рой держит! Он сдаётся!" }],
    [
      { speaker: "herald", text: "Победа! Верхний ярус открыт!" },
      { speaker: "oliver", text: "Открыт… значит, коллекционер уже там." },
    ],
  ],
  "8": [
    [
      { speaker: "herald", text: "Средний круг! Покажи супер!" },
      { speaker: "oliver", text: "Покажу. Не свой — но честный." },
    ],
    [
      { speaker: "collector", text: "Смотри на его супер. Запоминай, мальчик." },
      { speaker: "oliver", text: "Уже запоминаю. Репликатор жужжит." },
    ],
    [{ speaker: "oliver", text: "Копия… встала. Чужая сила в моих ладонях." }],
    [
      { speaker: "beetleBrother", text: "Больно? Я с тобой." },
      { speaker: "oliver", text: "Больно. Но работает." },
    ],
    [
      { speaker: "collector", text: "Отдай репликатор! Сейчас!" },
      { speaker: "oliver", text: "Приди и возьми. Жуки ждут." },
    ],
    [{ speaker: "oliver", text: "Я использовал чужое… ради своих." }],
    [
      { speaker: "emma", text: "Это был его удар… Ты прав?" },
      { speaker: "oliver", text: "Прав, если никто не погиб." },
    ],
    [
      { speaker: "rivalTinker", text: "Ты стал как они!" },
      { speaker: "oliver", text: "Нет. Я взял инструмент. Не душу." },
    ],
    [{ speaker: "oliver", text: "Репликатор… выстрелил! Копия жива!" }],
    [
      { speaker: "rivalTinker", text: "За кулисами… кто-то смотрит. Трое." },
      { speaker: "oliver", text: "Видел тени. Завтра — поговорим." },
    ],
  ],
};

const EXTRA = {
  "9": {
    "6": [
      { speaker: "shadowVoice", text: "Убьёшь врага — станешь легендой." },
      { speaker: "oliver", text: "Я не пустышка. Проверь на песке." },
    ],
  },
  "10": {
    "7": [
      { speaker: "kenji", text: "Доказать — не сломать." },
      { speaker: "taro", text: "Изобретение — с сердцем." },
      { speaker: "oliver", text: "Чужой супер сработал. Я не ошибся." },
    ],
    "8": [
      { speaker: "beetleBrother", text: "Не продавай память за болт." },
      { speaker: "oliver", text: "Не продам. Даже за витрину." },
    ],
    "10": [
      { speaker: "oliver", text: "Табло мигает. Мы ещё не закончили." },
      { speaker: "kenji", text: "Мы рядом." },
      { speaker: "taro", text: "До конца пути." },
    ],
  },
};

function fmtDialogue(arr) {
  return arr
    .map(
      (d) =>
        `          {\n            "speaker": "${d.speaker}",\n            "text": "${d.text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"\n          }`,
    )
    .join(",\n");
}

let src = fs.readFileSync(buildPath, "utf8");

for (const [ch, pages] of Object.entries(DIALOGUE)) {
  for (let pi = 0; pi < pages.length; pi++) {
    const pageNum = pi + 1;
    const re = new RegExp(
      `("${ch}":[\\s\\S]*?"page": ${pageNum},[\\s\\S]*?"dialogue": \\[)[\\s\\S]*?(\\][\\s\\S]*?"sfx")`,
    );
    const dlg = fmtDialogue(pages[pi]);
    src = src.replace(re, `$1\n${dlg}\n        $2`);
  }
}

for (const [ch, pages] of Object.entries(EXTRA)) {
  for (const [pageNum, lines] of Object.entries(pages)) {
    const re = new RegExp(
      `("${ch}":[\\s\\S]*?"page": ${pageNum},[\\s\\S]*?"dialogue": \\[)[\\s\\S]*?(\\][\\s\\S]*?"sfx")`,
    );
    const dlg = fmtDialogue(lines);
    src = src.replace(re, `$1\n${dlg}\n        $2`);
  }
}

fs.writeFileSync(buildPath, src, "utf8");
console.log("Patched", buildPath);
