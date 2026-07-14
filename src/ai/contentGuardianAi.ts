/**
 * ИИ-модерация «Стража»: встроенный анализ + LLM (Star Guardian).
 */
import { callLlm, isLlmReady } from "./astralLlm";
import { guardianBuiltInAnalyze } from "./contentGuardianBuiltIn";
import { isChatSurface } from "./contentGuardianContext";
import {
  guardianModerate,
  guardianModerateChat,
  messageForViolationKind,
  MODERATION_BLOCKED_CODE,
  MODERATION_CHAT_AI_BLOCK,
  type ModerationSurface,
  type ModerationVerdict,
} from "./contentGuardian";
import type { SensitiveKind } from "./contentGuardianPii";

const GUARDIAN_AI_SYSTEM_STRICT = [
  "Ты встроенный ИИ-модератор игрового чата «Страж Starfall».",
  "Проанализируй текст и определи, можно ли его отправить в игровой чат.",
  "BLOCK — если есть:",
  "• мат, оскорбления, угрозы, hate speech, harassment;",
  "• личные данные: ФИО, email, телефон, адрес, банковская карта, паспорт, ИНН, СНИЛС;",
  "• пароли, API-ключи, токены, секреты, логины с паролями;",
  "• контакты и ссылки на соцсети/мессенджеры (Telegram, Discord, WhatsApp, VK, Instagram, TikTok и др.);",
  "• любые ссылки и URL (http/https, www, domain.com/path, обфускация «site dot com», «hxxp://»);",
  "• попытки увести общение из игры на другие платформы («пиши в тг», «добавь в дискорд», «мой телеграм» и т.п.).",
  "Учитывай обходы: leet, латиница, пропуск букв, разбивку, «user at mail dot com», смешение языков.",
  "ALLOW — обычная игровая речь без мата, без личных данных и без попыток общения вне игры.",
  "Ответь СТРОГО одним словом: BLOCK или ALLOW.",
].join("\n");

const GUARDIAN_AI_SYSTEM_LENIENT = [
  "Ты модератор игрового чата Starfall. Отличай обычную беседу от реальных нарушений.",
  "BLOCK только при явных нарушениях:",
  "• нецензурная лексика и прямые оскорбления;",
  "• реальные личные данные (email, телефон, ФИО, адрес, номер карты);",
  "• пароли, ключи, токены;",
  "• явная попытка увести общение в Telegram/Discord/WhatsApp/VK с контактом или ссылкой.",
  "ALLOW для:",
  "• приветствий, вопросов, координации в игре («привет», «как дела», «когда будешь», «давай в бой», «сколько трофеев»);",
  "• игровых фраз про бой, урон, победу, боссов;",
  "• упоминания платформ без контактов и без приглашения перейти туда.",
  "При сомнениях — ALLOW.",
  "Ответь СТРОГО одним словом: BLOCK или ALLOW.",
].join("\n");

function categoryForKind(kind: SensitiveKind): ModerationVerdict["category"] {
  if (kind === "password" || kind === "social" || kind === "off_platform" || kind === "link") {
    return "policy";
  }
  return "pii";
}

function blockVerdict(
  surface: ModerationSurface,
  kind: SensitiveKind | undefined,
  userMessage: string,
): ModerationVerdict {
  return {
    allowed: false,
    errorCode: MODERATION_BLOCKED_CODE,
    category: kind ? categoryForKind(kind) : "policy",
    violationKind: kind,
    suspicion: 1,
    userMessage,
  };
}

export async function guardianAiShouldBlock(
  text: string,
  surface?: ModerationSurface,
): Promise<boolean | null> {
  if (!isLlmReady()) return null;
  const trimmed = (text ?? "").trim();
  if (!trimmed || trimmed.length > 400) return null;

  const system = surface && isChatSurface(surface)
    ? GUARDIAN_AI_SYSTEM_LENIENT
    : GUARDIAN_AI_SYSTEM_STRICT;

  const res = await callLlm(
    [
      system,
      `Текст сообщения:\n"""${trimmed}"""`,
    ].join("\n\n"),
    [],
    {
      minimal: true,
      maxTokens: 8,
      temperature: 0,
    },
  );
  if (!res.ok || !res.text) return null;
  const answer = res.text.trim().toUpperCase();
  if (answer.startsWith("BLOCK")) return true;
  if (answer.startsWith("ALLOW")) return false;
  return null;
}

/**
 * Быстрая проверка перед отправкой: правила + встроенный ИИ.
 * LLM — только для подозрительных сообщений (не блокирует обычный чат).
 */
export async function guardianModerateForSend(
  text: string,
  surface: ModerationSurface,
): Promise<ModerationVerdict> {
  const sync = guardianModerateWithBuiltIn(text, surface);
  if (!sync.allowed) return sync;

  if (!isChatSurface(surface) || !isLlmReady()) return sync;

  const builtIn = guardianBuiltInAnalyze(text, surface);
  const llmThreshold = 0.55;
  if (!builtIn.needsLlmReview && (builtIn.confidence ?? 0) < llmThreshold) return sync;

  const ai = await guardianAiShouldBlock(text, surface);
  if (ai === true) {
    return blockVerdict(surface, undefined, MODERATION_CHAT_AI_BLOCK);
  }

  return sync;
}

/**
 * Полная модерация: правила + встроенный ИИ + внешняя LLM (если настроена).
 * Используйте для перескана истории, не для каждой клавиши в чате.
 */
export async function guardianModerateWithAi(
  text: string,
  surface: ModerationSurface,
): Promise<ModerationVerdict> {
  const sync = guardianModerate(text, surface);
  if (!sync.allowed) return sync;

  const builtIn = guardianBuiltInAnalyze(text, surface);
  if (builtIn.block && builtIn.kind) {
    return blockVerdict(surface, builtIn.kind, messageForViolationKind(surface, builtIn.kind));
  }

  if (isChatSurface(surface) && isLlmReady()) {
    const llmThreshold = 0.55;
    if (builtIn.needsLlmReview || (builtIn.confidence ?? 0) >= llmThreshold) {
      const ai = await guardianAiShouldBlock(text, surface);
      if (ai === true) {
        return blockVerdict(surface, undefined, MODERATION_CHAT_AI_BLOCK);
      }
    }
  }

  return sync;
}

export type GuardianAiPurgeItem = {
  id: string;
  text: string;
};

export async function guardianAiFilterMessages<T extends GuardianAiPurgeItem>(
  messages: T[],
  surface: Extract<ModerationSurface, "club_chat" | "party_chat">,
): Promise<{ kept: T[]; removed: T[] }> {
  const recent = messages.slice(-40);
  const removed: T[] = [];

  for (const msg of recent) {
    const trimmed = msg.text?.trim() ?? "";
    if (!trimmed) continue;
    const verdict = guardianModerateWithBuiltIn(trimmed, surface);
    if (!verdict.allowed) removed.push(msg);
  }

  if (isLlmReady()) {
    const llmThreshold = 0.55;
    const suspicious = recent
      .filter(m => {
        const trimmed = m.text?.trim() ?? "";
        if (!trimmed || removed.some(r => r.id === m.id)) return false;
        const builtIn = guardianBuiltInAnalyze(trimmed, surface);
        return builtIn.needsLlmReview || (builtIn.confidence ?? 0) >= llmThreshold;
      })
      .slice(-5);

    for (const msg of suspicious) {
      const ai = await guardianAiShouldBlock(msg.text ?? "", surface);
      if (ai === true) removed.push(msg);
    }
  }

  const removedIds = new Set(removed.map(m => m.id));
  const kept = messages.filter(m => !removedIds.has(m.id));
  return { kept, removed };
}

/** Синхронная проверка для имён и описаний (встроенный ИИ без LLM). */
export function guardianModerateWithBuiltIn(
  text: string,
  surface: ModerationSurface,
): ModerationVerdict {
  const sync = guardianModerate(text, surface);
  if (!sync.allowed) return sync;

  const builtIn = guardianBuiltInAnalyze(text, surface);
  if (builtIn.block && builtIn.kind) {
    return blockVerdict(surface, builtIn.kind, messageForViolationKind(surface, builtIn.kind));
  }

  return sync;
}

export { guardianModerateChat };
