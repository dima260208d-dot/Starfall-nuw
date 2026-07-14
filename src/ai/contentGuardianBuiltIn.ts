/**
 * Встроенный ИИ «Стража» — эвристический анализ без внешнего API.
 * Всегда работает; дополняется LLM при настройке Star Guardian.
 */
import { scanModeForSurface, type GuardianScanMode } from "./contentGuardianContext";
import type { ModerationSurface } from "./contentGuardian";
import { scanPersonalData, type PiiKind } from "./contentGuardianPii";
import { scanPolicyViolation, type PolicyKind } from "./contentGuardianPolicy";
import { looksLikeLink } from "./contentGuardianLinks";

export type BuiltInViolationKind = PiiKind | PolicyKind;

export interface BuiltInAiVerdict {
  block: boolean;
  kind?: BuiltInViolationKind;
  confidence: number;
  /** Нужна дополнительная проверка внешней LLM */
  needsLlmReview: boolean;
}

function scoreOffPlatformHints(raw: string, mode: GuardianScanMode): number {
  let score = 0;
  const lower = raw.toLowerCase();

  if (mode === "lenient") {
    if (
      /\b(?:пиши|напиши|добав(?:ь|ьте)|скин(?:ь|те)|перейд(?:и|ём|ем)|свяж(?:ись|емся))\s+(?:мне\s+)?(?:в|на|через)\s+(?:telegram|телег(?:рам)?|t\.me|whatsapp|вотс(?:ап)?|discord|дискорд|vk|вк|instagram|insta|tiktok|тик\s*ток)\b/i.test(raw)
    ) {
      score += 0.75;
    }
    if (/\b(?:мой|моя|my)\s+(?:тг|tg|телег(?:рам)?|дс|ds|диск(?:орд)?|ватс(?:ап)?|wa|vk|insta|telegram|discord|whatsapp)\b/i.test(lower)) {
      score += 0.65;
    }
    if (/(?:t\.me\/|discord\.gg\/|@[a-z0-9_]{4,})/i.test(raw)) score += 0.45;
    if (looksLikeLink(raw, mode)) score = Math.max(score, 0.9);
    return Math.min(1, score);
  }

  if (/\b(?:тг|tg|ds|дс|wa|ватс)\b/.test(lower)) score += 0.35;
  if (/(?:контакт|contact|@\S{4,}|t\.me\/|discord\.gg\/|https?:|www\.)/i.test(raw)) score += 0.25;
  if (/[a-z]/i.test(raw) && /[а-яё]/i.test(raw)) score += 0.15;
  if (/@\w{3,}/.test(raw)) score += 0.25;
  if (looksLikeLink(raw, mode)) score = Math.max(score, 0.9);
  if (/\b(?:мессендж|messenger)\b/i.test(raw) && /(?:telegram|discord|whatsapp|телег|дискорд)/i.test(raw)) {
    score += 0.2;
  }
  return Math.min(1, score);
}

/** Встроенный ИИ-анализ текста (синхронно, без API). */
export function guardianBuiltInAnalyze(
  text: string,
  surface?: ModerationSurface,
): BuiltInAiVerdict {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { block: false, confidence: 0, needsLlmReview: false };

  const mode = surface ? scanModeForSurface(surface) : "strict";

  const policy = scanPolicyViolation(trimmed, mode);
  if (policy) {
    return {
      block: true,
      kind: policy,
      confidence: 0.92,
      needsLlmReview: false,
    };
  }

  const pii = scanPersonalData(trimmed, mode);
  if (pii) {
    return {
      block: true,
      kind: pii,
      confidence: 0.95,
      needsLlmReview: false,
    };
  }

  const hintScore = scoreOffPlatformHints(trimmed, mode);
  const llmThreshold = mode === "lenient" ? 0.55 : 0.35;
  const needsLlmReview = hintScore >= llmThreshold;

  return {
    block: false,
    confidence: hintScore,
    needsLlmReview,
  };
}
