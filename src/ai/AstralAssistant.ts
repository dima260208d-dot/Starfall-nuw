import {
  getCurrentProfile, openChest, equipPet, unlockBrawlerWithGems, unlockPetWithGems,
  upgradeBrawler, openBox, type UserProfile,
} from "../utils/localStorageAPI";
import {
  isStarGuardianActive, getStarGuardianDaysRemaining, consumePowerUpToken,
  isMainDailyAvailable, isSecondaryDailyAvailable, isSpecialDailyAvailable,
} from "../utils/subscription";
import { BRAWLERS, MAX_BRAWLER_LEVEL } from "../entities/BrawlerData";
import { PETS } from "../entities/PetData";
import { CHESTS, CHEST_RARITY_ORDER, type ChestRarity } from "../utils/chests";
import { getTodaysDeals } from "../utils/dailyDeals";
import { getUnreadNewsCount } from "../utils/news";
import { tryClubChatRuleReply, type AstralGameChatContext } from "./astralChatContext";
import {
  findBrawlerInMessage, findPetInMessage, findModeInMessage,
  describeBrawler, describePet, describeMode, chestPriceList,
  subscriptionDescription, randomGameplayHint,
  listAllBrawlers, listAllPets, listAllModes,
  getBrawlerTactics, getModeTactics, compareBrawlers, topBrawlersByStat,
  recommendBrawlerForMode, brawlerProgressSummary, extendedRandomHint,
} from "../data/astralKnowledge";
import { MODES } from "../data/modes";
import { pickExpandedAstralTip } from "./astralBattleTipPool";

// ─── Chat (FREE) ───────────────────────────────────────────────────────────

export interface ChatReply {
  text: string;
  suggestion?: string;  // optional follow-up the UI can render as a chip
}

/**
 * Главный rule-based обработчик чата. Расширенный набор паттернов:
 *   • приветствия / помощь / о Астрале,
 *   • подписка, ежедневки, news,
 *   • профиль, прогресс, рекомендации,
 *   • описание бойцов/питомцев/режимов (с fuzzy match),
 *   • тактика конкретного бойца / режима,
 *   • топы по статам, сравнение бойцов,
 *   • рекомендация бойца под режим, советы,
 *   • LLM-настройки (как включить, как поменять модель).
 *
 * Если LLM включён — этот rule-based ответ работает как fallback, когда сеть
 * не отвечает. Если LLM выключен — это единственный ответ.
 */
export function chatRespond(message: string, gameContext?: AstralGameChatContext | null): ChatReply {
  const m = (message ?? "").toLowerCase().trim();
  if (!m) return { text: "Спроси что-нибудь — я знаю всё про бойцов, питомцев, режимы и магазин." };

  if (gameContext?.clubSnapshot) {
    const ctxReply = tryClubChatRuleReply(message, gameContext.clubSnapshot);
    if (ctxReply) return ctxReply;
  }

  // ── Приветствия / база ───────────────────────────────────────────────────
  if (/(^привет|здравств|хай|hello|hi|здарова|здоров)\b/.test(m)) {
    return {
      text: "Звёздный свет приветствует тебя! Спроси про любого бойца, режим, питомца или сундук — я расскажу всё. Или попроси: «кого взять для ограбления», «сравни Мию и Юки», «топ-3 по урону».",
      suggestion: "Расскажи про Мию",
    };
  }

  if (/(помощь|что ты умеешь|команды|что ты знаешь|help|как тебя использовать)/.test(m)) {
    return {
      text: [
        "🌟 Я — Астрал, твой звёздный спутник. Я могу:",
        "• Рассказать про бойцов («расскажи про Мию», «тактика на Кендзи»)",
        "• Объяснить режимы («как играть в столкновении», «советы по ограблению»)",
        "• Сравнить бойцов («сравни Мию и Хану», «топ-3 по HP»)",
        "• Порекомендовать состав («кого взять для выноса кристаллов»)",
        "• Рассказать про твой профиль («сколько у меня монет», «мой прогресс»)",
        "• Цены сундуков, подписки, питомцев",
        "",
        "Со Star Guardian: «открой мегасундук», «прокачай Мию до 7», «поставь Феникса».",
        "А если включишь LLM-режим в настройках, я отвечу на любой свободный вопрос про игру.",
      ].join("\n"),
    };
  }

  // ── Подписка / магазин ───────────────────────────────────────────────────
  if (/(подписк|star guardian|стар гард|премиум|сколько стоит подписка)/.test(m)) {
    const active = isStarGuardianActive();
    const days = getStarGuardianDaysRemaining();
    return {
      text: subscriptionDescription() + (active ? `\n\n✅ Активна, осталось ${days} дн.` : "\n\n❌ Сейчас не активна — открой магазин и оформи."),
    };
  }

  if (/(ежедневн|бонус|daily|задани|квест)/.test(m)) {
    const tasks: string[] = [];
    if (isMainDailyAvailable()) tasks.push("• Главная награда подписки готова — забери в разделе «Награды Star Guardian».");
    if (isSecondaryDailyAvailable()) tasks.push("• Дополнительная награда подписки ждёт твоего выбора (3 варианта).");
    if (isSpecialDailyAvailable()) tasks.push("• Готов токен прокачки — можно забрать.");
    if (tasks.length === 0) tasks.push("• Все ежедневки на сегодня собраны.");
    return { text: "📅 Ежедневные дела:\n" + tasks.join("\n") };
  }

  if (/(список бойц|все бойцы|каких бойцов|кто в игре|сколько бойцов)/.test(m)) return { text: listAllBrawlers() };
  if (/(список питом|все питомцы|какие питомцы|сколько питомцев)/.test(m)) return { text: listAllPets() };
  if (/(список режим|все режимы|какие режимы|сколько режимов)/.test(m)) return { text: listAllModes() };

  if (/(сундук|ящик|chest)/.test(m) && /(цен|стои|сколько)/.test(m)) {
    return { text: chestPriceList() };
  }

  if (/(клуб|club|гильд)/.test(m)) {
    return { text: "🏛️ Клубы — социальная фича: создавай клуб или присоединяйся к чужому, чтобы видеть друзей и получать бонусы за командную игру. Раздел «Клубы» в правой панели меню." };
  }

  if (/(star pass|стар пас|пасс)/.test(m)) {
    return { text: "🎟️ Star Pass — 90-уровневый сезонный пропуск (450₽). Качай уровень за победы и квесты, на каждом уровне приз. С платной версией — двойные награды." };
  }

  // ── Топ-листы и сравнения ────────────────────────────────────────────────
  const topMatch = m.match(/топ[ -]?(\d+)?\s*(по\s+)?(хп|hp|здоров|урон|дмг|dmg|скорост|speed|дальност|range)/);
  if (topMatch) {
    const n = topMatch[1] ? Math.max(1, Math.min(10, Number(topMatch[1]))) : 3;
    const what = topMatch[3];
    let stat: "hp" | "damage" | "speed" | "range" = "hp";
    if (/урон|дмг|dmg/.test(what)) stat = "damage";
    else if (/скорост|speed/.test(what)) stat = "speed";
    else if (/дальност|range/.test(what)) stat = "range";
    else stat = "hp";
    return { text: topBrawlersByStat(stat, n) };
  }

  if (/(сравни|сравнен|vs|против)/.test(m)) {
    // Ищем двух бойцов в сообщении.
    const found: typeof BRAWLERS[number][] = [];
    const tokens = m.split(/[^a-zа-яё]+/).filter(Boolean);
    for (const tok of tokens) {
      const b = findBrawlerInMessage(tok);
      if (b && !found.find(x => x.id === b.id)) found.push(b);
      if (found.length >= 2) break;
    }
    if (found.length === 2) {
      return { text: compareBrawlers(found[0] as any, found[1] as any) };
    }
  }

  // ── «Кого взять для X» ───────────────────────────────────────────────────
  if (/(кого\s+(брать|взять|играть)|какой\s+боец|кого\s+выбрать|лучший\s+боец|кто\s+лучше)/.test(m)) {
    const mode = findModeInMessage(m);
    if (mode) return { text: recommendBrawlerForMode(mode.id) };
    // Без указания режима — общая рекомендация фаворита по статам.
    return { text: "💡 Универсальные фавориты: Мия (снайпер), Юки (контроль), Кендзи (burst). Уточни режим — дам прицельный совет." };
  }

  // ── Тактика на конкретного бойца ─────────────────────────────────────────
  if (/(тактик|как\s+играть\s+за|как\s+бить|стратеги|совет\s+по)/.test(m)) {
    const b = findBrawlerInMessage(m);
    if (b) return { text: getBrawlerTactics(b.id) };
    const mode = findModeInMessage(m);
    if (mode) return { text: getModeTactics(mode.id) };
  }

  // ── «Как играть в X режим» — тоже совет ──────────────────────────────────
  if (/(как\s+играть|как\s+побеждать|как\s+выиграть)/.test(m)) {
    const mode = findModeInMessage(m);
    if (mode) return { text: getModeTactics(mode.id) };
    // Без указания режима — общий совет.
    return { text: extendedRandomHint() };
  }

  // ── Профиль и прогресс ───────────────────────────────────────────────────
  const inClubChat = gameContext?.channel === "club";
  const clubFundQuestion = /(фонд|сокровищ|клубн|в\s+клубе)/i.test(m);
  if (/(мой\s+(профил|прогресс)|сколько\s+у\s+меня|статистик|кубки|трофеи|монет|кристалл|поинт)/.test(m)) {
    if (!(inClubChat && clubFundQuestion && !/(мо[ихйе]|у\s+меня|личн)/i.test(m))) {
      const p = getCurrentProfile();
      if (!p) return { text: "Профиль не найден." };
      const progress = brawlerProgressSummary(p.brawlerLevels, p.unlockedBrawlers);
      return {
        text: [
          `🧑 ${p.username} — ${p.trophies} 🏆 (всего побед: ${p.totalWins} из ${p.totalGamesPlayed})`,
          `💰 ${p.coins} монет, 💎 ${p.gems} кристаллов, ⚡ ${p.powerPoints} поинтов`,
          `🐾 Открыто питомцев: ${p.unlockedPets?.length ?? 0} из ${PETS.length}`,
          ``,
          progress,
        ].join("\n"),
      };
    }
  }

  // ── Описания (с fuzzy match) ─────────────────────────────────────────────
  const b = findBrawlerInMessage(m);
  if (b) return { text: describeBrawler(b) };
  const pet = findPetInMessage(m);
  if (pet) return { text: describePet(pet) };
  const mode = findModeInMessage(m);
  if (mode) return { text: describeMode(mode) };

  // ── Общие советы ─────────────────────────────────────────────────────────
  if (/(совет|подскажи|что мне делать|как победить|тип|подсказк)/.test(m)) {
    // Чередуем расширенные и базовые советы.
    return { text: Math.random() < 0.6 ? extendedRandomHint() : randomGameplayHint() };
  }

  // ── LLM настройки ────────────────────────────────────────────────────────
  if (/(llm|нейрос|настоящ\s+ии|gpt|claude|openai|openrouter|api\s+ключ)/.test(m)) {
    return {
      text: [
        "🧠 LLM-режим — это опциональная фича: я могу отвечать через настоящую нейросеть (OpenAI / OpenRouter), если ты дашь мне свой API-ключ.",
        "Открой чат Астрала → «⚙️ ИИ» → включи «Своя нейросеть (LLM)», выбери провайдера и вставь ключ.",
        "Без него я работаю на встроенной базе знаний — этого хватает для 95% вопросов.",
      ].join("\n"),
    };
  }

  // ── Дефолт ───────────────────────────────────────────────────────────────
  return {
    text: "Хм, не уверен, что ты имеешь в виду. Попробуй:\n• «расскажи про Мию»\n• «как играть в столкновении»\n• «тактика на Кендзи»\n• «сравни Хану и Юки»\n• «кого взять для ограбления»\n• «топ-3 по урону»",
  };
}

// Suppress unused warnings for MODES (used indirectly via knowledge helpers).
void MODES;

// ─── Command parsing (PAID) ────────────────────────────────────────────────

export interface CommandResult {
  handled: boolean;
  reply: string;
  refresh?: boolean;
}

const OPEN_VERBS = /(открой|открыть|вскрой|вскрыть|распакуй|опен)/;
const UPGRADE_VERBS = /(прокач|улучш|апгрейд|повысь|возьми уровень)/;
const EQUIP_VERBS = /(поставь|надень|выбери|экипируй|сменить питомца)/;
const BUY_VERBS = /(купи|приобрети|разблокируй|открой бойца|открой питомца)/;
const SUMMON_VERBS = /(забери|собери|получи)/;

function detectChestRarity(text: string): ChestRarity | null {
  if (/(ультра|ultra|ультралегенд)/i.test(text)) return "ultralegendary";
  if (/(мифик|мифич|mythic)/i.test(text)) return "mythic";
  if (/(легендар|legend)/i.test(text)) return "legendary";
  if (/(мега|mega)/i.test(text)) return "mega";
  if (/(эпическ|epic|эпик)/i.test(text)) return "epic";
  if (/(редк|rare)/i.test(text)) return "rare";
  if (/(обычн|common|деревянн)/i.test(text)) return "common";
  return null;
}

export function looksLikeCommand(message: string): boolean {
  const m = message.toLowerCase();
  return OPEN_VERBS.test(m) || UPGRADE_VERBS.test(m) || EQUIP_VERBS.test(m) || BUY_VERBS.test(m) || (SUMMON_VERBS.test(m) && /награ|бонус|токен/.test(m));
}

function parseTargetLevel(message: string): number | null {
  const m = message.match(/до\s*(\d{1,2})\s*(ур|уров|lvl|level)?/i);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v)) return null;
  return Math.max(1, Math.min(MAX_BRAWLER_LEVEL, v));
}

export function executeCommand(message: string): CommandResult {
  if (!isStarGuardianActive()) {
    return {
      handled: true,
      reply: "🔒 Эта команда — фича Star Guardian. Оформи подписку, и я буду выполнять твои поручения сам.",
    };
  }
  const profile = getCurrentProfile();
  if (!profile) return { handled: true, reply: "Профиль не найден." };
  const m = message.toLowerCase();

  if (OPEN_VERBS.test(m) && (/(сундук|ящик|chest|box)/.test(m))) {
    if (/(коробк|box|ящик)\b/.test(m) && !/сундук|chest/.test(m)) {
      if (profile.coins < 100) return { handled: true, reply: "❌ Нужно 100 монет, чтобы открыть ящик." };
      const r = openBox();
      return {
        handled: true,
        reply: `📦 Открыл ящик: +${r.amount} ${r.type === "coins" ? "монет" : r.type === "gems" ? "кристаллов" : "поинтов"}.`,
        refresh: true,
      };
    }
    let rarity = detectChestRarity(m);
    if (!rarity) {
      const owned = CHEST_RARITY_ORDER.filter(r => (profile.chestInventory?.[r] ?? 0) > 0);
      if (owned.length === 0) return { handled: true, reply: "❌ У тебя нет ни одного сундука для открытия. Купи в магазине." };
      rarity = owned[owned.length - 1];
    }
    const r = openChest(rarity);
    if (!r.success) return { handled: true, reply: `❌ ${r.error || "Не удалось открыть"}` };
    const summary = (r.rolls ?? []).map(roll => {
      if (roll.type === "coins")       return `+${roll.amount} монет`;
      if (roll.type === "gems")        return `+${roll.amount} кристаллов`;
      if (roll.type === "powerPoints") return `+${roll.amount} поинтов`;
      if (roll.type === "brawler")     return `🦸 боец: ${roll.brawlerId ?? ""}`;
      if (roll.type === "pet")         return `🐾 питомец: ${roll.petId ?? ""}`;
      return "награда";
    }).join(", ");
    return { handled: true, reply: `🗝️ ${CHESTS[rarity].name} открыт: ${summary}.`, refresh: true };
  }

  if (UPGRADE_VERBS.test(m)) {
    const b = findBrawlerInMessage(message);
    if (!b) return { handled: true, reply: "Скажи кого прокачать, например: «прокачай Мию»." };
    if (!profile.unlockedBrawlers.includes(b.id)) return { handled: true, reply: `❌ ${b.name} ещё не открыт.` };
    const targetLvl = parseTargetLevel(message);
    if (targetLvl && targetLvl > (profile.brawlerLevels[b.id] || 1)) {
      let currentLevel = profile.brawlerLevels[b.id] || 1;
      let upgradedBy = 0;
      while (currentLevel < targetLvl) {
        const tryToken = consumePowerUpToken(b.id);
        if (tryToken.success) {
          currentLevel = tryToken.newLevel || (currentLevel + 1);
          upgradedBy++;
          continue;
        }
        const tryUpgrade = upgradeBrawler(b.id);
        if (!tryUpgrade.success) {
          if (upgradedBy === 0) return { handled: true, reply: `❌ Не получилось прокачать ${b.name}: ${tryUpgrade.error}` };
          return {
            handled: true,
            reply: `⚠️ Прокачал ${b.name} до ур.${currentLevel}, но дальше нельзя: ${tryUpgrade.error}.`,
            refresh: true,
          };
        }
        currentLevel += 1;
        upgradedBy++;
      }
      return { handled: true, reply: `📈 ${b.name} прокачан до ${currentLevel}-го уровня.`, refresh: true };
    }

    const tokenTry = consumePowerUpToken(b.id);
    if (tokenTry.success) {
      return { handled: true, reply: `⚡ Использовал токен прокачки: ${b.name} теперь ${tokenTry.newLevel}-го уровня.`, refresh: true };
    }
    const r = upgradeBrawler(b.id);
    if (!r.success) return { handled: true, reply: `❌ Не получилось: ${r.error}` };
    const lvl = (getCurrentProfile()?.brawlerLevels[b.id]) || 0;
    return { handled: true, reply: `📈 ${b.name} прокачан до ${lvl}-го уровня.`, refresh: true };
  }

  if (EQUIP_VERBS.test(m) && /(питом|зверь|зверя|животн)/.test(m)) {
    const pet = findPetInMessage(message);
    if (!pet) return { handled: true, reply: "Какого питомца поставить? Например: «поставь Феникса»." };
    if (!(profile.unlockedPets ?? []).includes(pet.id)) return { handled: true, reply: `❌ ${pet.name} ещё не открыт.` };
    equipPet(pet.id);
    return { handled: true, reply: `🐾 Экипирован: ${pet.name} — ${pet.effectLabel}.`, refresh: true };
  }

  if (BUY_VERBS.test(m)) {
    const b = findBrawlerInMessage(message);
    if (b) {
      const r = unlockBrawlerWithGems(b.id);
      if (!r.success) return { handled: true, reply: `❌ ${r.error}` };
      return { handled: true, reply: `🎉 ${b.name} открыт за кристаллы.`, refresh: true };
    }
    const pet = findPetInMessage(message);
    if (pet) {
      const r = unlockPetWithGems(pet.id);
      if (!r.success) return { handled: true, reply: `❌ ${r.error}` };
      return { handled: true, reply: `🎉 ${pet.name} разблокирован.`, refresh: true };
    }
    return { handled: true, reply: "Кого открыть? Назови бойца или питомца." };
  }

  return { handled: false, reply: "" };
}

export interface BattleSnapshot {
  mode: string;
  durationSec: number;
  player: {
    brawlerId: string;
    brawlerName: string;
    hp: number;
    maxHp: number;
    ammo: number;
    maxAmmo: number;
    superCharge: number;     // 0..1
    superReadyForSec: number;
    speed: number;
    attackRange: number;
    buffs: string[];
    debuffs: string[];
    x: number;
    y: number;
  } | null;
  nearestEnemy: {
    distance: number;
    hpPct: number;
    brawlerId: string;
    brawlerName: string;
    hasSuperReady: boolean;
    x: number;
    y: number;
  } | null;
  enemyCount: number;
  enemyCloseCount: number;
  allies: Array<{ hpPct: number; carryingObjective: number }>;
  nearestPowerup: { distance: number; x: number; y: number; kind: string } | null;
  nearestHealth:  { distance: number; x: number; y: number; kind: string } | null;
  nearestCoin:    { distance: number; x: number; y: number; kind: string } | null;
  nearestCrate:   { distance: number; x: number; y: number } | null;
  objectiveItemsNearby: number;
  gasDistance: number | null;        // showdown only — px to safe zone (>0 = inside gas)
  carryingGems: number | null;
  enemyGems: number | null;
  carryingObjective: number | null;
  enemyObjective: number | null;
  petEffect: string | null;
}

function fill(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function directionFromPlayer(px: number, py: number, tx: number, ty: number): string {
  const dx = tx - px;
  const dy = ty - py;
  const h = Math.abs(dx) > Math.abs(dy);
  if (h) return dx > 0 ? "справа" : "слева";
  return dy > 0 ? "снизу" : "сверху";
}

function battleName(id: string): string {
  return BRAWLERS.find(b => b.id === id)?.name ?? id;
}

function styleVariant(lines: string[]): string {
  return pick(lines);
}

const BATTLE_TIP_ROTATION_KEY = "astral_battle_tip_rotation_v2";
function pickModeTip(mode: string, lines: string[]): string {
  if (lines.length === 1) return lines[0];
  try {
    const key = `${BATTLE_TIP_ROTATION_KEY}_${mode}`;
    const prev = Number(localStorage.getItem(key) ?? "0");
    const idx = Number.isFinite(prev) ? ((prev + 1) % lines.length) : 0;
    localStorage.setItem(key, String(idx));
    return lines[idx];
  } catch {
    return pick(lines);
  }
}

export function generateBattleTip(s: BattleSnapshot): string | null {
  if (!s.player) return null;
  const p = s.player;
  const hpPct = Math.round((p.hp / Math.max(1, p.maxHp)) * 100);
  const ammoPct = p.maxAmmo > 0 ? p.ammo / p.maxAmmo : 1;
  const e = s.nearestEnemy;
  const lowHpEnemy = e ? Math.round(e.hpPct * 100) : 0;
  const enemyDir = e ? directionFromPlayer(p.x, p.y, e.x, e.y) : "";
  const powerDir = s.nearestPowerup ? directionFromPlayer(p.x, p.y, s.nearestPowerup.x, s.nearestPowerup.y) : "";
  const healthDir = s.nearestHealth ? directionFromPlayer(p.x, p.y, s.nearestHealth.x, s.nearestHealth.y) : "";
  const crateDir = s.nearestCrate ? directionFromPlayer(p.x, p.y, s.nearestCrate.x, s.nearestCrate.y) : "";
  const mode = s.mode;

  // Strong mode-specific framing first, so Astral doesn't feel generic.
  if ((mode === "heist" || mode === "siege") && s.nearestEnemy && s.nearestEnemy.distance < 300) {
    return pickModeTip(mode, [
      `🏰 ${mode === "heist" ? "Ограбление" : "Осада"}: не разменяйся в центре просто так — держи позицию между врагом и целью.`,
      `🧱 ${mode === "heist" ? "Сейф" : "База"} важнее погони. Играй от перехвата и не отдавай свободный проход врагам.`,
      `🎯 В ${mode === "heist" ? "ограблении" : "осаде"} выигрывает контроль линии к цели. Приоритет: сбить пуш и только потом контратаковать.`,
    ]);
  }
  if ((mode === "crystals" || mode === "gemgrab") && s.carryingGems !== null) {
    if (s.carryingGems >= 7) {
      return pickModeTip(mode, [
        `💎 У тебя ${s.carryingGems} кристаллов: играй от выживания и держись за спинами союзников.`,
        `🛡️ ${s.carryingGems} кристаллов на тебе — это вин-кондишен. Не форси дуэль без прикрытия.`,
        `📦 Главная задача: донести ${s.carryingGems} кристаллов, а не добивать любой ценой.`,
      ]);
    }
    if (s.enemyGems !== null && s.enemyGems >= 7) {
      return pickModeTip(mode, [
        `🎯 У врага ${s.enemyGems} кристаллов — фокус только по кэрри, остальные цели вторичны.`,
        `⚠️ Вражеский кэрри с ${s.enemyGems} кристаллами — ломай именно его позицию.`,
        `🔪 Приоритет раунда: выбить кристаллы из вражеского носителя (${s.enemyGems}).`,
      ]);
    }
  }
  if (mode === "showdown" && s.nearestCrate && !s.nearestEnemy) {
    return pickModeTip(mode, [
      `📦 Столкновение: стартуй через ресурсы — ящик ${crateDir} в ${Math.round(s.nearestCrate.distance)}px.`,
      `🌵 В showdown темп даёт фарм. Сначала ящики и позиция, потом файт.`,
      `🧠 Без прямого контакта в showdown выгоднее забрать ящик и улучшить размен.`,
    ]);
  }
  if (mode === "megashowdown" && p.hp / Math.max(1, p.maxHp) < 0.4) {
    return pickModeTip(mode, [
      "🔁 Mega Showdown: сохраняй здоровых бойцов. Если этот на лоу HP — играй аккуратно и не дари фраг.",
      "🛡️ Mega Showdown: важен состав на лейт. Лучше короткий безопасный размен, чем рискованный пуш.",
      "⚖️ Mega Showdown: оцени ресурс отряда — не отдавай бравлера без выгоды по позиции.",
    ]);
  }

  if (s.gasDistance !== null && s.gasDistance > 0) {
    return styleVariant([
      "☠️ Ты уже в газе. Сместись к центру прямо сейчас, иначе срежет HP быстрее, чем успеешь добить цель.",
      "☠️ Газ уронит тебя быстрее врага. Немедленно выходи в безопасную зону.",
      "☠️ Сейчас главный враг — газ. Приоритет: выжить и выйти из кольца.",
    ]);
  }

  if (hpPct <= 30 && e && e.distance < 330) {
    if (s.nearestHealth && s.nearestHealth.distance < 220) {
      return styleVariant([
        `❤️ Осталось ${p.hp} HP, враг ${battleName(e.brawlerId)} ${enemyDir} в ${Math.round(e.distance)}px. Аптечка ${healthDir} в ${Math.round(s.nearestHealth.distance)}px — отходи туда.`,
        `💉 Критическое HP (${p.hp}). Лучшая линия: аптечка ${healthDir}, ${Math.round(s.nearestHealth.distance)}px.`,
      ]);
    }
    return styleVariant([
      `💔 У тебя ${p.hp} HP и рядом ${battleName(e.brawlerId)} (${Math.round(e.distance)}px). Откайть ${enemyDir}, не разменивайся сейчас.`,
      `🛡️ HP слишком низкий (${p.hp}). Не принимай дуэль, разорви контакт ${enemyDir}.`,
    ]);
  }

  if (s.gasDistance !== null && s.gasDistance > -120 && s.gasDistance <= 0) {
    return styleVariant([
      `🌫️ Край газа очень близко (${Math.abs(Math.round(s.gasDistance))}px). Сдвигайся к центру заранее, не стой в коридоре.`,
      `🌫️ До газа меньше ${Math.abs(Math.round(s.gasDistance))}px — меняй позицию уже сейчас.`,
    ]);
  }

  if ((s.mode === "crystals" || s.mode === "gemgrab") && s.carryingGems !== null && s.carryingGems >= 8) {
    return styleVariant([
      `💎 У тебя ${s.carryingGems} кристаллов. Сейчас приоритет — выжить: отступай к союзникам и не пушь первым.`,
      `💎 Носишь ${s.carryingGems} кристаллов: играй от обороны, любой размен сейчас невыгоден.`,
    ]);
  }
  if ((s.mode === "crystals" || s.mode === "gemgrab") && s.enemyGems !== null && s.enemyGems >= 7 && e) {
    return styleVariant([
      `🎯 Враг несёт ${s.enemyGems} кристаллов. Это ключевая цель: фокус в ${enemyDir}, дистанция ${Math.round(e.distance)}px.`,
      `🎯 Главная цель раунда — кэрри с ${s.enemyGems} кристаллами. Лови его ${enemyDir}.`,
    ]);
  }

  if (s.enemyCloseCount >= 2 && hpPct < 70) {
    return `👥 Вблизи ${s.enemyCloseCount} врага. Не стой в открытом секторе — играй от укрытия и сбрасывай агро.`;
  }

  if (e && e.hasSuperReady && e.distance < p.attackRange * 1.35) {
    return `⚠️ У ${battleName(e.brawlerId)} готов супер. Не подставляйся в лоб, вынуди его потратить заряд в пустоту.`;
  }

  if (e && e.hpPct < 0.30 && e.distance <= p.attackRange + 20 && p.ammo > 0) {
    const superHint = p.superCharge >= 0.98 ? " Супер готов — можешь гарантированно добрать." : "";
    return `☠️ ${battleName(e.brawlerId)} ${enemyDir} и всего ${lowHpEnemy}% HP. Добивай сейчас, он в рабочей дальности.${superHint}`;
  }

  if (s.nearestHealth && s.nearestHealth.distance < 250 && hpPct < 70) {
    return `🟢 Аптечка ${healthDir} в ${Math.round(s.nearestHealth.distance)}px. При твоих ${hpPct}% HP это самый выгодный мув прямо сейчас.`;
  }
  if (s.nearestPowerup && s.nearestPowerup.distance < 200) {
    return `🟣 Усиление ${powerDir} в ${Math.round(s.nearestPowerup.distance)}px. Возьми его перед файтом — получишь темп по урону и живучести.`;
  }

  if (s.nearestPowerup && s.nearestPowerup.distance < 300 && e && e.distance < p.attackRange * 0.9 && hpPct > 60) {
    return `🧠 Сначала разменивай ${battleName(e.brawlerId)}, потом забирай усиление ${powerDir} — иначе отдашь позицию.`;
  }

  if (p.superCharge >= 0.99 && p.superReadyForSec >= 5 && e) {
    return `⚡ Супер простаивает уже ${Math.round(p.superReadyForSec)}с. Цель ${battleName(e.brawlerId)} ${enemyDir} на ${Math.round(e.distance)}px — пора реализовать.`;
  }

  if (ammoPct < 0.15 && e && e.distance < 250) {
    return `🪫 Патроны почти пусты (${p.ammo}/${p.maxAmmo}), а враг рядом (${Math.round(e.distance)}px). Дай перезарядку и только потом входи.`;
  }

  if (ammoPct > 0.9 && e && e.distance < p.attackRange * 1.1 && hpPct > 55) {
    return `🔫 Полный боекомплект (${p.ammo}/${p.maxAmmo}) и хорошая дистанция. Можно входить агрессивнее по ${battleName(e.brawlerId)}.`;
  }

  if (e && e.distance > p.attackRange * 1.6 && e.distance < p.attackRange * 3) {
    return `📏 ${battleName(e.brawlerId)} вне твоей рабочей зоны. Твоя дальность ~${Math.round(p.attackRange)}px, текущая ${Math.round(e.distance)}px — сократи дистанцию через смещение ${enemyDir}.`;
  }

  if (s.mode === "showdown" && s.nearestCrate && s.nearestCrate.distance < p.attackRange * 1.1 && !e) {
    return `📦 Ящик ${crateDir} в ${Math.round(s.nearestCrate.distance)}px. Безопасно разбить его сейчас и забрать ресурс.`;
  }

  if (s.objectiveItemsNearby >= 2 && !e) {
    return `🎯 Рядом ${s.objectiveItemsNearby} важных объекта(ов) — забери их в приоритете, пока нет прямого контакта с врагом.`;
  }

  const weakAllies = s.allies.filter(a => a.hpPct < 0.35).length;
  if ((s.mode === "crystals" || s.mode === "gemgrab") && weakAllies >= 1 && e && e.distance < 320) {
    return `🛡️ Союзник(и) просел(и) по HP. Поддержи размен по ${battleName(e.brawlerId)} и прикрой отход команды.`;
  }

  if (p.debuffs.length > 0) {
    return `🧪 На тебе дебафф (${p.debuffs.join(", ")}). Снизь темп и дождись окна для контратаки.`;
  }

  if (p.buffs.length > 0 && e && e.distance < p.attackRange * 1.4) {
    return `✨ Активен бафф (${p.buffs.join(", ")}). Используй окно силы и продави ${battleName(e.brawlerId)}.`;
  }

  if (s.durationSec < 8 && s.petEffect) {
    return `🐾 Учитывай эффект питомца: ${s.petEffect}. Подстрой стиль боя под этот бонус с первых секунд.`;
  }

  if (s.durationSec < 4) {
    return "▶️ Старт боя: забери ближайшие ресурсы, оцени позиции врагов и не входи в центр без инфы.";
  }

  if (s.mode === "megashowdown" && hpPct < 30) {
    return "🔁 В МЕГА-столкновении этот боец на грани. Сыграй им в размен и сохрани более здорового на лейт.";
  }

  if (s.mode === "showdown" && e && hpPct > 75 && lowHpEnemy > 70 && s.enemyCount <= 2) {
    return `🎯 Ситуация выгодная: ты здоровее и контроль поля за тобой. Дожми ${battleName(e.brawlerId)} через позиционку.`;
  }

  return pickExpandedAstralTip();
}

export interface MenuNotification { text: string; cta?: { label: string; screen: "shop" | "starGuardianRewards" | "collection" | "pets" | "clashPass" } }

const MENU_NOTE_ROTATION_KEY = "astral_menu_note_rotation_v1";

function nextRotationIndex(max: number): number {
  try {
    const raw = localStorage.getItem(MENU_NOTE_ROTATION_KEY);
    const prev = raw ? Number(raw) : 0;
    const next = Number.isFinite(prev) ? (prev + 1) % Math.max(1, max) : 0;
    localStorage.setItem(MENU_NOTE_ROTATION_KEY, String(next));
    return next;
  } catch {
    return 0;
  }
}

export function generateMenuNotification(profile: UserProfile): MenuNotification | null {
  const variants: MenuNotification[] = [];
  const unopened = Object.values(profile.chestInventory || {}).reduce((a, b) => a + b, 0);
  if (unopened >= 3) {
    variants.push({ text: `📦 У тебя ${unopened} неоткрытых сундуков. Это быстрая прокачка, открой хотя бы часть сейчас.`, cta: { label: "В магазин", screen: "shop" } });
  }
  const unreadNews = getUnreadNewsCount(profile.username);
  if (unreadNews > 0) {
    variants.push({ text: `📰 Есть ${unreadNews} новых новостей. Проверь патчноуты и акции, чтобы не пропустить бонусы.` });
  }
  const deals = getTodaysDeals();
  if (deals.length > 0) {
    const best = deals[0];
    variants.push({ text: `🔥 Сегодня в магазине: «${best.title}». Это выгодное предложение дня.`, cta: { label: "Открыть", screen: "shop" } });
  }
  if (isMainDailyAvailable()) {
    variants.push({ text: "⭐ Главная награда подписки готова. Забери прямо сейчас!", cta: { label: "Забрать", screen: "starGuardianRewards" } });
  }
  if (isSecondaryDailyAvailable()) {
    variants.push({ text: "🎁 Доп.награда дня ждёт твоего выбора (3 варианта).", cta: { label: "Выбрать", screen: "starGuardianRewards" } });
  }
  if (isSpecialDailyAvailable()) {
    variants.push({ text: "⚡ Готов токен прокачки! Применю на любого бойца.", cta: { label: "Открыть", screen: "starGuardianRewards" } });
  }
  const fav = profile.favoriteBrawlerId ?? "miya";
  const lvl = profile.brawlerLevels[fav] || 1;
  if (lvl < 6 && profile.powerPoints >= 200) {
    const b = BRAWLERS.find(x => x.id === fav);
    variants.push({ text: `📈 У тебя ${profile.powerPoints} поинтов — самое время прокачать ${b?.name ?? "бойца"} (сейчас ур.${lvl}).`, cta: { label: "К коллекции", screen: "collection" } });
  }
  if (!profile.equippedPetId && (profile.unlockedPets?.length ?? 0) > 0) {
    variants.push({ text: "🐾 У тебя открыты питомцы, но никто не экипирован — дай напарнику место в бою!", cta: { label: "К питомцам", screen: "pets" } });
  }
  if (profile.coins >= 5000) {
    variants.push({ text: `💰 Накопилось ${profile.coins} монет. Сундуки в магазине ждут.`, cta: { label: "В магазин", screen: "shop" } });
  }
  const sgDays = getStarGuardianDaysRemaining();
  if (sgDays > 0 && sgDays <= 3) {
    variants.push({ text: `⏳ Star Guardian скоро закончится: осталось ${sgDays} дн. Продли вовремя, чтобы не потерять расширенный Астрал.` });
  }
  if (profile.clashPassLevel < 70) {
    variants.push({ text: `🎟️ Star Pass: ур. ${profile.clashPassLevel}. Сыграй пару матчей, чтобы добежать до следующей награды.` });
  }
  variants.push({ text: randomGameplayHint() });
  return variants[nextRotationIndex(variants.length)] ?? variants[0] ?? null;
}

export { isStarGuardianActive };
