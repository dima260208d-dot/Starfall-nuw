// ─── Astral Knowledge Base ─────────────────────────────────────────────────
// Helpers Astral uses to answer questions in chat. Everything here is read
// from the existing game data (BRAWLERS, MODES, PETS, CHESTS) so when balance
// or content changes, Astral's answers update automatically.

import { BRAWLERS, BRAWLER_LORE, BRAWLER_RARITY_LABEL, BRAWLER_GEM_COST, MAX_BRAWLER_LEVEL } from "../entities/BrawlerData";
import { MODES } from "../data/modes";
import { PETS, PET_GEM_COST, PET_RARITY_LABEL } from "../entities/PetData";
import { CHESTS, CHEST_RARITY_ORDER } from "../utils/chests";
import { getEffectiveChestGemPrice } from "../utils/characterBalance";
import { STAR_GUARDIAN_PRICE_RUB, MAIN_DAILY_COINS, MAIN_DAILY_GEMS, MAIN_DAILY_POWER, SPECIAL_REWARD_INTERVAL_DAYS } from "../utils/subscription";
import { BRAWLER_NAME_ALIASES, BRAWLER_RUSSIAN_NAMES } from "../utils/brawlerDisplay";
import { BRAWLER_CONSTELLATIONS, MAX_STARS_PER_BRAWLER, STAR_COST_GEMS } from "../utils/constellations";
import { PIN_KIND_META } from "../entities/PinData";
import { COLLECTIBLE_PIN_RARITY_LABEL } from "../entities/CollectiblePinData";

const NORM_RE = /[^a-zа-яё0-9]/gi;
function norm(s: string): string {
  return (s ?? "").toLowerCase().replace(NORM_RE, "");
}

/**
 * Расстояние Дамерау–Левенштейна между двумя строками. Лимит дешёвый
 * O(n*m), но для имён бойцов (~10 символов) это копейки. Возвращает число
 * правок (вставка/удаление/замена/перестановка соседних) — для fuzzy match
 * имён с опечатками.
 */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const al = a.length, bl = b.length;
  if (al === 0) return bl;
  if (bl === 0) return al;
  const prev = new Array<number>(bl + 1);
  const cur = new Array<number>(bl + 1);
  for (let j = 0; j <= bl; j++) prev[j] = j;
  for (let i = 1; i <= al; i++) {
    cur[0] = i;
    for (let j = 1; j <= bl; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      cur[j] = Math.min(
        cur[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      // Транспозиция (Дамерау)
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        cur[j] = Math.min(cur[j], prev[j - 2] + cost);
      }
    }
    for (let j = 0; j <= bl; j++) prev[j] = cur[j];
  }
  return prev[bl];
}

/**
 * Извлекает «токены» из сообщения: куски >= 3 символов, разделённые
 * не-буквенными символами. Для fuzzy match по каждому токену.
 */
function tokensOf(msg: string): string[] {
  const lower = (msg ?? "").toLowerCase();
  const parts = lower.split(/[^a-zа-яё0-9]+/g).filter(s => s.length >= 3);
  return parts;
}

/**
 * Универсальный поиск с fuzzy fallback: сначала пытается найти подстроку
 * нормализованного имени/id в сообщении (exact match, как раньше), а если
 * не получилось — для каждого имени считает editDistance до каждого токена
 * и выбирает лучший в пределах допустимой ошибки (≤25% длины имени, мин. 1).
 */
function fuzzyFind<T extends { id: string; name: string }>(msg: string, items: readonly T[]): T | null {
  const n = norm(msg);
  // Exact substring match (как было)
  for (const it of items) {
    if (n.includes(norm(it.id)) || n.includes(norm(it.name))) return it;
  }
  // Fuzzy: для каждого токена считаем минимальную дистанцию к каждому
  // имени/id, и берём лучшее совпадение.
  const tokens = tokensOf(msg);
  if (tokens.length === 0) return null;
  let best: T | null = null;
  let bestDist = Infinity;
  for (const it of items) {
    const candidates = [norm(it.id), norm(it.name)];
    for (const cand of candidates) {
      if (!cand) continue;
      const tol = Math.max(1, Math.floor(cand.length * 0.25));
      for (const tok of tokens) {
        const d = editDistance(tok, cand);
        if (d <= tol && d < bestDist) {
          bestDist = d;
          best = it;
        }
      }
    }
  }
  return best;
}

/** Найти бойца: русские имена, латиница, опечатки. */
export function findBrawlerInMessage(msg: string) {
  const n = norm(msg);
  for (const b of BRAWLERS) {
    const cands = [
      norm(b.id),
      norm(b.name),
      ...(BRAWLER_NAME_ALIASES[b.id] ?? []).map(norm),
    ];
    if (cands.some(c => c.length >= 2 && n.includes(c))) return b;
  }
  return fuzzyFind(msg, BRAWLERS);
}

export function findPetInMessage(msg: string) {
  return fuzzyFind(msg, PETS);
}

export function findModeInMessage(msg: string) {
  const n = norm(msg);
  for (const m of MODES) {
    if (n.includes(norm(m.id)) || n.includes(norm(m.name)) || n.includes(norm(m.subtitle))) return m;
  }
  // Russian aliases
  if (/showdown|столк|выживан|battle royale/i.test(msg)) return MODES.find(m => m.id === "showdown") ?? null;
  if (/crystal|кристалл/i.test(msg)) return MODES.find(m => m.id === "crystals") ?? null;
  if (/heist|сейф|ограбл/i.test(msg)) return MODES.find(m => m.id === "heist") ?? null;
  if (/gemgrab|гем|самоцвет/i.test(msg)) return MODES.find(m => m.id === "gemgrab") ?? null;
  if (/siege|осад/i.test(msg)) return MODES.find(m => m.id === "siege") ?? null;
  if (/training|тренир/i.test(msg)) return MODES.find(m => m.id === "training") ?? null;
  if (/mega|мега/i.test(msg)) return MODES.find(m => m.id === "megashowdown") ?? null;
  if (/bounty|охот|звёзд|звезд/i.test(msg)) return MODES.find(m => m.id === "bounty") ?? null;
  if (/starstrike|мяч|футбол/i.test(msg)) return MODES.find(m => m.id === "starstrike") ?? null;
  if (/boss|босс|рейд/i.test(msg)) return MODES.find(m => m.id === "bossraid") ?? null;
  return null;
}

export function describeBrawler(b: ReturnType<typeof findBrawlerInMessage> & {}): string {
  if (!b) return "";
  const lore = BRAWLER_LORE[b.id] ?? "";
  const rarity = BRAWLER_RARITY_LABEL[b.rarity];
  const cost = BRAWLER_GEM_COST[b.rarity];
  return [
    `🔥 *${b.name}* (${b.role}, ${rarity}) — HP ${b.hp}, урон ${b.attackDamage}, скорость ${b.speed}.`,
    `⚔️ Атака «${b.attackName}»: ${b.attackDesc}`,
    `💥 Супер «${b.superName}»: ${b.superDesc}`,
    `💎 Открывается за ${cost} кристаллов или из сундука.`,
    lore && `📖 ${lore}`,
  ].filter(Boolean).join("\n");
}

export function describePet(p: ReturnType<typeof findPetInMessage> & {}): string {
  if (!p) return "";
  const cost = PET_GEM_COST[p.rarity];
  return [
    `🐾 *${p.name}* (${PET_RARITY_LABEL[p.rarity]}).`,
    `✨ Эффект: ${p.effectLabel}.`,
    `💎 В магазине: ${cost} кристаллов.`,
    p.description && `📖 ${p.description}`,
  ].filter(Boolean).join("\n");
}

/** Русское имя режима для UI и Астрала (подзаголовок). */
export function getModeDisplayName(m: { name: string; subtitle: string }): string {
  return m.subtitle || m.name;
}

export function describeMode(m: ReturnType<typeof findModeInMessage> & {}): string {
  if (!m) return "";
  return [
    `${m.icon} *${getModeDisplayName(m)}* (${m.name}).`,
    `🗺️ Карта: ${m.mapName}.`,
    `👥 ${m.players}.`,
    `📜 ${m.desc}`,
  ].join("\n");
}

export function chestPriceList(): string {
  const lines = CHEST_RARITY_ORDER.map(r => {
    const c = CHESTS[r];
    const gems = getEffectiveChestGemPrice(r);
    return `• ${c.name}: ${gems} кристаллов`;
  });
  return `🎁 Цены сундуков (только кристаллы):\n${lines.join("\n")}`;
}

export function subscriptionDescription(): string {
  return [
    `⭐ *Star Guardian* — ${STAR_GUARDIAN_PRICE_RUB}₽ в месяц.`,
    `📅 Каждый день: ${MAIN_DAILY_COINS} монет + ${MAIN_DAILY_GEMS} кристаллов + ${MAIN_DAILY_POWER} поинтов.`,
    `🎁 Каждый день: дополнительная награда на выбор (3 варианта).`,
    `⚡ Раз в ${SPECIAL_REWARD_INTERVAL_DAYS} дня: токен прокачки (+1 уровень любому бойцу).`,
    `🤖 Все функции Астрала: автобой, подсказки в бою, выполнение команд через чат.`,
    `🎨 15 переливающихся цветов имени в профиле (пока подписка активна).`,
  ].join("\n");
}

/** Top-level random tip (shown when player asks "что мне делать?"). */
export function randomGameplayHint(): string {
  const HINTS = [
    "💡 В столкновении прячься в кустах и наноси первый удар — это 90% победы.",
    "💡 В выносе кристаллов не лезь в драку, если несёшь 8+ кристаллов: лучше отступить и сохранить очки.",
    "💡 В ограблении обходи врагов с фланга — большинство ботов фокусируются на сейфе.",
    "💡 Питомец *Огневик* поджигает врагов с шансом 10% — отличный выбор для дальнобоев.",
    "💡 Питомец *Феникс* воскрешает один раз за бой — спасатель в Showdown.",
    "💡 В Siege атакуй вражеский робот сбоку — у него меньше брони с боков.",
    "💡 Покупай мега-сундуки только в дни скидок (загляни в магазин ежедневно).",
    "💡 Уровень бойца важнее редкости — прокачай одного любимца до 9–11 уровня.",
    "💡 В МЕГА-столкновении переключайся на свежего бойца, как только у текущего HP < 30%.",
    "💡 Используй супер сразу при заряде 100% — нет смысла «копить про запас».",
  ];
  return HINTS[Math.floor(Math.random() * HINTS.length)];
}

export function listAllBrawlers(): string {
  const byRarity: Record<string, string[]> = {};
  for (const b of BRAWLERS) {
    const k = BRAWLER_RARITY_LABEL[b.rarity];
    (byRarity[k] ||= []).push(b.name);
  }
  const lines = Object.entries(byRarity).map(([r, names]) => `• ${r}: ${names.join(", ")}`);
  return `👥 Все бойцы:\n${lines.join("\n")}`;
}

export function listAllPets(): string {
  return `🐾 Все питомцы (${PETS.length}):\n` + PETS.map(p =>
    `• ${p.name} — ${p.effectLabel}`
  ).join("\n");
}

export function listAllModes(): string {
  return `🎮 Игровые режимы:\n` + MODES.map(m => `• ${m.icon} ${getModeDisplayName(m)} (${m.name})`).join("\n");
}

// ─── Расширенные знания: тактика и советы ────────────────────────────────────

/**
 * Тактический совет под конкретного бойца. Если совета для этого `id` нет,
 * генерируется обобщённый по роли бойца (assassin/sniper/tank/support/etc).
 */
export function getBrawlerTactics(brawlerId: string): string {
  const b = BRAWLERS.find(x => x.id === brawlerId);
  if (!b) return "";
  const specific: Record<string, string> = {
    miya: "🎯 Мия — снайпер. Держи дистанцию ~80% от attackRange, бей через стены союзникам по выходящим. Супер — на скопление врагов или дальние цели.",
    yuki: "❄️ Юки — контроль. Используй замедление чтобы порезать кайтящих, супер ставь на чокпоинты у объективов.",
    kenji: "⚡ Кендзи — burst-DPS. Лучший в коротких разменах: подходишь под атаку, бьёшь, отступаешь под стену.",
    hana: "🌸 Хана — отравительница. Зоны DoT — на маршруты движения врагов; не стой в собственной зоне.",
    goro: "👊 Горо — танк-ближник. Тарань ластов в кустах, супер копит больше при размене. Сильно теряет в открытом поле.",
    sora: "🔥 Сора — мортирщик. Не пытайся стрелять прямо: лучший damage идёт через предсказание движения.",
    rin: "🐍 Рин — пирс-снайпер. Лучшая позиция — узкие коридоры с союзниками за спиной.",
    taro: "🛠️ Таро — инженер. Турель на ключевой развилке, сам играй вторым номером.",
    ronin: "⚔️ Ронин — ассассин. Заходи через кусты, удар → щит → размен. В открытом поле уязвим.",
    zafkiel: "🌟 Зафкиэль — обстрел-кэрри. Высокая дальность, но низкое HP — играй из-за линии тима.",
  };
  if (specific[b.id]) return specific[b.id];
  return `📘 ${b.name} (${b.role}): HP ${b.hp}, урон ${b.attackDamage}, дальность ${b.attackRange}. ${b.attackDesc}`;
}

/** Подсказка под режим: что важно, кого играть, чего избегать. */
export function getModeTactics(modeId: string): string {
  switch (modeId) {
    case "showdown": return "🏆 Столкновение: первая фаза — фарм ящиков, не лезь в драку. С 1-2 усилениями двигайся к центру. Газ убивает быстрее любого врага.";
    case "megashowdown": return "🏆 МЕГА-столкновение: ресурс отряда важнее одного фрага. Меняй бойца как только HP < 30%.";
    case "crystals": return "💎 Вынос кристаллов: до 5 кристаллов — лезь в драку. С 8+ играй от обороны и держись за спинами тимы.";
    case "gemgrab": return "💎 Ограбление кристаллов: контроль центра. Не таскай больше 7 гемов в одиночку — потеряешь раунд за 1 смерть.";
    case "heist": return "🏰 Ограбление: фокус на сейфе. Не размен на пол-карты, а push по линии. Кэрри-урон под защитой тима.";
    case "siege": return "🤖 Осада: контроль болтов. Сторона с роботом всегда побеждает раунд — приоритет на болты в середине.";
    case "training": return "🎓 Тренировка: отрабатывай попадания и расход супер-заряда. Боты не пушат и не дают полный игровой опыт.";
    case "bossraid": return "👹 Рейд босса: ставь приоритеты на фазы — анг/яр/режим бога. Не стой в DoT-зонах, держи дистанцию у мили-боссов.";
    case "bounty": return "⭐ Охота за звёздами: убийства дают звёзды (1–6). До 6 личных звёзд — не умирай зря. Командная цель — 25 звёзд.";
    case "starstrike": return "⚽ Звёздный мяч: веди мяч, пасуй, не стреляй в союзника с мячом. Защита ворот важнее фрагов.";
    default: return "🎮 Изучай карту и роли — расстановка важнее реакции.";
  }
}

/** Сравнение двух бойцов по статам, в чате. */
export function compareBrawlers(a: { id: string; name: string; hp: number; attackDamage: number; speed: number; attackRange: number; role: string }, b: typeof a): string {
  const lines = [
    `⚔️ Сравнение: ${a.name} vs ${b.name}`,
    `• HP: ${a.hp} vs ${b.hp} ${a.hp > b.hp ? "→ +" + (a.hp - b.hp) + " у " + a.name : a.hp < b.hp ? "→ +" + (b.hp - a.hp) + " у " + b.name : "= равны"}`,
    `• Урон: ${a.attackDamage} vs ${b.attackDamage}`,
    `• Скорость: ${a.speed} vs ${b.speed}`,
    `• Дальность: ${a.attackRange} vs ${b.attackRange}`,
    `• Роль: ${a.role} vs ${b.role}`,
  ];
  return lines.join("\n");
}

/** Возвращает топ-3 самых сильных по HP/уроне (для «кто лучший»). */
export function topBrawlersByStat(stat: "hp" | "damage" | "speed" | "range", count = 3): string {
  const key: keyof typeof BRAWLERS[number] = stat === "damage" ? "attackDamage" : stat === "range" ? "attackRange" : stat as any;
  const sorted = [...BRAWLERS].sort((x: any, y: any) => (y[key] ?? 0) - (x[key] ?? 0)).slice(0, count);
  const label = stat === "hp" ? "HP" : stat === "damage" ? "урон" : stat === "speed" ? "скорость" : "дальность";
  return `🏆 Топ-${count} по ${label}:\n` + sorted.map((b: any, i) => `${i + 1}. ${b.name} — ${b[key]}`).join("\n");
}

/** Рекомендация бойца под режим. */
export function recommendBrawlerForMode(modeId: string): string {
  const recs: Record<string, string[]> = {
    showdown: ["goro", "ronin", "kenji"],
    megashowdown: ["miya", "zafkiel", "hana"],
    crystals: ["miya", "yuki", "hana"],
    gemgrab: ["miya", "yuki", "rin"],
    heist: ["kenji", "sora", "zafkiel"],
    siege: ["taro", "miya", "hana"],
    training: ["miya"],
    bossraid: ["zafkiel", "miya", "rin"],
  };
  const ids = recs[modeId] ?? ["miya"];
  const names = ids
    .map(id => BRAWLERS.find(b => b.id === id)?.name ?? id)
    .filter(Boolean);
  const mode = MODES.find(m => m.id === modeId);
  const modeName = mode ? getModeDisplayName(mode) : modeId;
  return `🎯 Топовые бойцы для «${modeName}»:\n` + names.map((n, i) => `${i + 1}. ${n}`).join("\n");
}

/** Краткая сводка по бойцам игрока: открытые / уровни / прокачка. */
export function brawlerProgressSummary(brawlerLevels: Record<string, number>, unlocked: string[]): string {
  const total = BRAWLERS.length;
  const unlockedCount = unlocked.length;
  const maxedCount = unlocked.filter(id => (brawlerLevels[id] ?? 1) >= 11).length;
  const avgLvl = unlocked.length === 0
    ? 0
    : Math.round((unlocked.reduce((s, id) => s + (brawlerLevels[id] ?? 1), 0) / unlocked.length) * 10) / 10;
  return [
    `📊 Прогресс по бойцам:`,
    `• Открыто: ${unlockedCount} из ${total}`,
    `• Максимальный уровень (11): ${maxedCount}`,
    `• Средний уровень: ${avgLvl}`,
  ].join("\n");
}

/**
 * Расширенный набор советов — больше разнообразия. Используется
 * `randomGameplayHint` (старый набор — короткий, этот — широкий).
 */
const EXTENDED_HINTS = [
  "💡 Куст — твой лучший друг в столкновении: первый удар увеличивает шанс победы вдвое.",
  "💡 В выносе кристаллов оптимально иметь 6-7 кристаллов: если умрёшь — потеряешь меньше.",
  "💡 В ограблении приоритет — push: 2 атакующих лучше 1 атакующего + защитник.",
  "💡 Питомец Огневик отлично работает с дальнобоями (Мия, Зафкиэль).",
  "💡 Феникс — пет для рисковой игры: 1 респаун за бой.",
  "💡 В Siege контролируй болты — это победа.",
  "💡 Не копи супер: рабочий супер ценнее «запасного».",
  "💡 В МЕГА-столкновении меняй бойца на 30% HP — сэкономишь.",
  "💡 Зеркало напротив игрока в чате Астрала покажет статистику матча.",
  "💡 Уровень бойца важнее редкости — лучше один на 11, чем 10 на 5.",
  "💡 В столкновении убегай в кусты при низком HP — пет не виден.",
  "💡 Star Pass даёт удвоенные награды только в платной версии.",
  "💡 Ультралегендарные сундуки — самые выгодные по среднему урон/монета.",
  "💡 Не покупай дешёвых питомцев — они часто слабее даже базовых.",
  "💡 В рейде босса фаза «режим бога» иммунит к CC — не трать оглушения.",
];

export function extendedRandomHint(): string {
  return EXTENDED_HINTS[Math.floor(Math.random() * EXTENDED_HINTS.length)];
}

/** Полная сводка игры для LLM (обновляется из тех же данных, что и игра). */
export function buildFullAstralKnowledge(): string {
  const lines: string[] = [];

  lines.push("=== ПРАВИЛА ИМЁН ===");
  lines.push("Бойцы ТОЛЬКО по-русски: " + Object.values(BRAWLER_RUSSIAN_NAMES).join(", ") + ".");
  lines.push("Никогда: Ronin, Yuki, Kenji, Miya, Hana, Goro, Sora, Rin, Taro, Zafkiel.");
  lines.push("Режимы в UI: англ. название + рус. подзаголовок — в ответах предпочитай подзаголовок (Столкновение, Ограбление…).");
  lines.push(`Макс. уровень бойца: ${MAX_BRAWLER_LEVEL}. Созвездия: до ${MAX_STARS_PER_BRAWLER} звёзд, ${STAR_COST_GEMS}💎 за звезду.`);

  lines.push("\n=== БОЙЦЫ (полные карточки) ===");
  for (const b of BRAWLERS) {
    const lore = BRAWLER_LORE[b.id] ?? "";
    const stars = BRAWLER_CONSTELLATIONS[b.id];
    const starLine = stars?.length
      ? `Созвездия: ${stars.map(s => `${s.index}.${s.name}(${s.effect})`).join("; ")}`
      : "";
    lines.push([
      `[${b.id}] ${b.name} — ${BRAWLER_RARITY_LABEL[b.rarity]}, ${b.role}. HP ${b.hp}, урон ${b.attackDamage}, скор ${b.speed}, дальн ${b.attackRange}. Цена: ${BRAWLER_GEM_COST[b.rarity]}💎.`,
      `Атака «${b.attackName}»: ${b.attackDesc}`,
      `Супер «${b.superName}»: ${b.superDesc}`,
      lore && `Лор: ${lore}`,
      starLine,
    ].filter(Boolean).join(" "));
  }

  lines.push("\n=== РЕЖИМЫ ===");
  for (const m of MODES) {
    lines.push(`${m.id}: «${m.name}» / ${m.subtitle}. ${m.players}. Карта: ${m.mapName}. ${m.desc}`);
  }

  lines.push("\n=== ПИТОМЦЫ ===");
  for (const p of PETS) {
    lines.push(`${p.id}: ${p.name} (${PET_RARITY_LABEL[p.rarity]}, ${PET_GEM_COST[p.rarity]}💎) — ${p.effectLabel}. ${p.description}`);
  }

  lines.push("\n=== СУНДУКИ ===");
  for (const r of CHEST_RARITY_ORDER) {
    const c = CHESTS[r];
    lines.push(`${c.name}: ${getEffectiveChestGemPrice(r)}💎. ${c.description}`);
  }

  lines.push("\n=== ПИНЫ (эмоции в бою) ===");
  lines.push("На каждого бойца: " + Object.values(PIN_KIND_META).map(m => m.label).join(", ") + ".");
  lines.push("Коллекционные пины: редкости " + Object.values(COLLECTIBLE_PIN_RARITY_LABEL).join(", ") + ".");

  lines.push("\n=== STAR GUARDIAN ===");
  lines.push(subscriptionDescription());

  lines.push("\n=== ЭКРАНЫ МЕНЮ ===");
  lines.push("Главное меню, выбор режима, коллекция, сундуки, магазин, квесты, клубы, Star Pass (Clash Pass), питомцы, настройки, карта (редактор для админа), рейд босса, Mega Squad.");

  return lines.join("\n");
}
