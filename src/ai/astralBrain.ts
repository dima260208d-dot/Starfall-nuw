/**
 * Единый «мозг» Астрала: если подключён LLM (Star Guardian + ключ),
 * используется везде — чат, советы в бою, уведомления в меню, автобой.
 * Иначе — rule-based из AstralAssistant.
 */
import {
  chatRespond,
  generateBattleTip,
  generateMenuNotification,
  type BattleSnapshot,
  type ChatReply,
  type MenuNotification,
} from "./AstralAssistant";
import { callLlm, isLlmReady, type LlmResult } from "./astralLlm";
import type { AstralGameChatContext } from "./astralChatContext";
import { tryClubChatRuleReply } from "./astralChatContext";
import type { UserProfile } from "../utils/localStorageAPI";
import { getBrawlerDisplayName } from "../utils/brawlerDisplay";
import { getLearnedLessonHint } from "./aiCombatLearning";

let lastLlmAt = 0;
let inFlight = false;

const MIN_GAP_MS = 2200;
const GAME_NAME = "Starfall";

async function astralLlmRequest(
  userPrompt: string,
  opts?: { maxTokens?: number; temperature?: number; systemPromptExtra?: string },
): Promise<LlmResult | null> {
  if (!isLlmReady()) return null;
  const now = Date.now();
  if (inFlight || now - lastLlmAt < MIN_GAP_MS) return null;
  inFlight = true;
  lastLlmAt = now;
  try {
    const res = await callLlm(userPrompt, undefined, {
      maxTokens: opts?.maxTokens ?? 180,
      temperature: opts?.temperature ?? 0.55,
      systemPromptExtra: opts?.systemPromptExtra,
    });
    return res.ok ? { ...res, text: res.text.trim() } : res;
  } finally {
    inFlight = false;
  }
}

async function astralLlmTask(
  userPrompt: string,
  opts?: { maxTokens?: number; temperature?: number },
): Promise<string | null> {
  const res = await astralLlmRequest(userPrompt, opts);
  return res?.ok ? res.text : null;
}

function snapLine(s: BattleSnapshot): string {
  const p = s.player;
  if (!p) return `mode=${s.mode}`;
  const e = s.nearestEnemy;
  return [
    `mode=${s.mode}`,
    `hp=${Math.round((p.hp / Math.max(1, p.maxHp)) * 100)}%`,
    `ammo=${p.ammo}/${p.maxAmmo}`,
    `super=${Math.round(p.superCharge * 100)}%`,
    `carry_gems=${s.carryingGems ?? "?"}`,
    `enemy_gems=${s.enemyGems ?? "?"}`,
    e ? `foe=${getBrawlerDisplayName(e.brawlerId)} dist=${e.distance < 120 ? "близко" : e.distance < 280 ? "средне" : "далеко"} hp=${Math.round(e.hpPct * 100)}%` : "foe=none",
    `enemies_near=${s.enemyCloseCount}`,
    s.gasDistance != null ? `gas=${s.gasDistance < 0 ? "внутри" : "рядом"}` : "",
    s.nearestHealth ? `heal=${s.nearestHealth.distance < 150 ? "рядом" : "далеко"}` : "",
  ].filter(Boolean).join("; ");
}

/** Чат / свободные вопросы. */
export async function astralReply(message: string): Promise<ChatReply> {
  return astralChatReply(message);
}

/** Чат с игровым контекстом (клуб, команда). */
export async function astralChatReply(
  userMessage: string,
  gameContext?: AstralGameChatContext | null,
  llmPrompt?: string,
): Promise<ChatReply> {
  const llmText = llmPrompt ?? userMessage;

  if (gameContext?.clubSnapshot) {
    const ctxReply = tryClubChatRuleReply(userMessage, gameContext.clubSnapshot);
    if (ctxReply) return ctxReply;
  }

  const systemExtra = gameContext?.systemBlock;
  if (isLlmReady()) {
    const res = await astralLlmRequest(llmText, {
      maxTokens: 500,
      temperature: 0.6,
      systemPromptExtra: systemExtra,
    });
    if (res?.ok) return { text: res.text };
    if (res && !res.ok) {
      const fallback = gameContext?.clubSnapshot
        ? tryClubChatRuleReply(userMessage, gameContext.clubSnapshot)?.text
        : undefined;
      const local = fallback ?? chatRespond(userMessage, gameContext).text;
      return {
        text: `⚠️ LLM сейчас не ответил: ${res.error}\n\nПока отвечаю локальным Астралом:\n${local}`,
      };
    }
  }

  if (gameContext?.clubSnapshot) {
    const ctxReply = tryClubChatRuleReply(userMessage, gameContext.clubSnapshot);
    if (ctxReply) return ctxReply;
  }
  return chatRespond(userMessage, gameContext);
}

/** Совет в бою (асинхронно). */
export async function astralBattleTip(s: BattleSnapshot): Promise<string | null> {
  const rule = generateBattleTip(s);
  if (!isLlmReady()) return rule;

  const hint = rule ? `Подсказка по правилам (ориентир): ${rule}` : "";
  const learned = getLearnedLessonHint(s.mode);
  const text = await astralLlmTask(
    [
      `Ты Астрал — тактический советник в бою ${GAME_NAME}. Игру называй только ${GAME_NAME} или Старфал.`,
      "Дай ОДИН короткий совет игроку СТРОГО на русском (1-2 предложения, можно эмодзи).",
      "Запрещён английский язык в ответе. Имена бойцов только по-русски: Мия, Ронин, Юки, Кендзи, Хана, Горо, Сора, Рин, Таро, Зафкиэль.",
      "Только тактика по текущей ситуации, без воды.",
      `Ситуация: ${snapLine(s)}`,
      hint,
      learned ? `Урок из прошлых боёв игрока: ${learned}` : "",
    ].filter(Boolean).join("\n"),
    { maxTokens: 120, temperature: 0.5 },
  );
  return text ?? rule;
}

/** Уведомление в главном меню. */
export async function astralMenuNotification(profile: UserProfile): Promise<MenuNotification | null> {
  const rule = generateMenuNotification(profile);
  if (!isLlmReady()) return rule;

  const text = await astralLlmTask(
    [
      `Ты Астрал — помощник в меню ${GAME_NAME}. Игру называй только ${GAME_NAME} или Старфал.`,
      "Напиши одно короткое полезное уведомление игроку на русском (до 2 предложений). Имена бойцов только по-русски.",
      `Профиль: трофеи=${profile.trophies}, монеты=${profile.coins}, кристаллы=${profile.gems},`,
      `бойцов=${profile.unlockedBrawlers.length}, сундуков=${JSON.stringify(profile.chestInventory ?? {})}.`,
      rule ? `Идея по правилам: ${rule.text}` : "",
    ].filter(Boolean).join("\n"),
    { maxTokens: 100, temperature: 0.55 },
  );
  if (!text) return rule;
  return { text, cta: rule?.cta };
}

export type AutoplayLlmMode = "engage" | "pickup" | "flee" | "explore" | "break_crates";

/** Тактический режим автобоя (раз в несколько секунд). */
export async function astralAutoplayMode(s: BattleSnapshot): Promise<AutoplayLlmMode | null> {
  if (!isLlmReady()) return null;
  const rule = generateBattleTip(s);
  const text = await astralLlmTask(
    [
      `Ты тактический ИИ автопилота ${GAME_NAME}.`,
      "Ответь СТРОГО одним словом из списка: engage | pickup | flee | explore | break_crates",
      `Ситуация: ${snapLine(s)}`,
      rule ? `Контекст: ${rule}` : "",
    ].filter(Boolean).join("\n"),
    { maxTokens: 12, temperature: 0.2 },
  );
  if (!text) return null;
  const w = text.toLowerCase();
  if (w.includes("flee")) return "flee";
  if (w.includes("pickup")) return "pickup";
  if (w.includes("break")) return "break_crates";
  if (w.includes("explore")) return "explore";
  if (w.includes("engage")) return "engage";
  return null;
}
