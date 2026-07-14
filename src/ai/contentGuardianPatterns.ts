/** Корни и фразы для фильтра (латиница + кириллица, в т.ч. обфускация после нормализации). */
export const GUARDIAN_PROFANITY_ROOTS: readonly string[] = [
  "хуй", "хуя", "хуе", "хую", "хуи", "hui", "huy", "xuy", "xyi", "xyj",
  "пизд", "pizd", "pisd", "pezd",
  "ебан", "ебат", "ебал", "ебло", "ебну", "ебё", "ебл", "eban", "ebal", "ebat", "eblan", "yeban",
  "бляд", "блят", "blyad", "blyat", "bljat", "blia",
  "сука", "suka", "cyka", "syka",
  "пидор", "pidor", "pedik", "педик", "peder", "пeder",
  "гандон", "gandon", "гондон",
  "мудак", "mudak", "мудил",
  "залуп", "zalup",
  "шлюх", "slyuh", "shlyuh",
  "ублюд", "ublud",
  "долбоеб", "dolboeb", "долбаеб",
  "чмо", "chmo",
  "fuck", "fuk", "fck", "fukk", "fuc",
  "shit", "sht", "bullsh",
  "bitch", "btch", "biatch",
  "asshole", "ashole",
  "nigger", "nigga", "n1gga", "negr",
  "faggot", "fagot", "fgt",
  "retard", "retar",
  "whore", "slut",
  "cunt", "cnt",
  "dick", "d1ck",
  "pussy", "puss",
  "bastard", "bstrd",
];

/** Короткие фрагменты — блокируются только как отдельное слово / короткое сообщение. */
export const GUARDIAN_CRITICAL_FRAGMENTS: readonly string[] = [
  "ху", "хй", "xy", "xu", "hue",
  "пи", "pz", "eb", "e6", "бл", "bl",
  "xyi", "hui", "fuk", "fck", "cnt", "fgt",
];

export const GUARDIAN_VIOLENCE_ROOTS: readonly string[] = [
  "убий", "убью", "убей", "убив", "убил",
  "зареж", "зарез", "закол",
  "расстрел", "повеш", "задуш",
  "изнаси", "rape", "rapist",
  "террор", "terror", "взорв", "bomb",
  "killyour", "kys", "suicide", "самоуб",
  "повеситься", "сдохни", "sdohni", "diebitch",
];

export const GUARDIAN_HATE_ROOTS: readonly string[] = [
  "hitler", "nazi", "нацист", "racist", "расист", "antisemit", "антисем",
  "kkk", "whitepower", "heil",
];

export const GUARDIAN_HARASSMENT_PHRASES: readonly string[] = [
  "идинах", "idinah", "иди нах", "go die", "kill yourself", "уничтож",
];
