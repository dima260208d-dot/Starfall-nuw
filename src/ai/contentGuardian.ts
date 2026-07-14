/**
 * 🛡️ Страж Starfall — умный фильтр текста.
 * Ловит мат, оскорбления и обход: пропуски букв, разбивку, leet, смешение языков и символов.
 */
import {
  GUARDIAN_CRITICAL_FRAGMENTS,
  GUARDIAN_HARASSMENT_PHRASES,
  GUARDIAN_HATE_ROOTS,
  GUARDIAN_PROFANITY_ROOTS,
  GUARDIAN_VIOLENCE_ROOTS,
} from "./contentGuardianPatterns";
import { scanSensitiveContent, type SensitiveKind } from "./contentGuardianPii";
import { scanModeForSurface, type GuardianScanMode } from "./contentGuardianContext";

export const MODERATION_BLOCKED_CODE = "moderation_blocked";

export const GUARDIAN_NAME = "🛡️ Страж";

export const MODERATION_NAME_ERROR =
  "Имя или название недоступно — попробуйте другое.";

export const MODERATION_DESC_ERROR =
  "Описание недоступно — попробуйте изменить текст.";

export const MODERATION_CHAT_SYSTEM =
  `${GUARDIAN_NAME}: сообщение не отправлено — недопустимая лексика, ссылки, личные данные и призывы к насилию запрещены правилами игры.`;

export const MODERATION_CHAT_PII =
  `${GUARDIAN_NAME}: нельзя отправлять личные данные — ФИО, почту, телефон, адрес, номера карт, документы и другую персональную информацию.`;

export const MODERATION_CHAT_SOCIAL =
  `${GUARDIAN_NAME}: нельзя передавать контакты и ссылки на соцсети — общение только внутри игры.`;

export const MODERATION_CHAT_PASSWORD =
  `${GUARDIAN_NAME}: нельзя отправлять пароли, ключи, токены и другие секреты.`;

export const MODERATION_CHAT_OFF_PLATFORM =
  `${GUARDIAN_NAME}: нельзя уводить общение на другие платформы — чат и связь только в Starfall.`;

export const MODERATION_CHAT_LINK =
  `${GUARDIAN_NAME}: ссылки запрещены — нельзя отправлять URL, адреса сайтов и любые гиперссылки.`;

export const MODERATION_CHAT_AI_BLOCK =
  `${GUARDIAN_NAME}: сообщение заблокировано — ИИ обнаружил личные данные, попытку связи вне игры или другие нарушения.`;

export const MODERATION_CHAT_PURGED =
  `${GUARDIAN_NAME}: сообщение удалено — нарушение правил чата.`;

export const MODERATION_CHAT_PURGED_PII =
  `${GUARDIAN_NAME}: сообщение удалено — обнаружены личные данные.`;

export const MODERATION_ASTRAL_INLINE =
  `${GUARDIAN_NAME}: это сообщение нельзя отправить — недопустимая лексика или личные данные запрещены.`;

export const MODERATION_NAME_PII =
  "Нельзя использовать личные данные в имени — укажите игровой ник.";

export const MODERATION_DESC_PII =
  "Описание не должно содержать личные данные — измените текст.";

export type ModerationSurface =
  | "club_chat"
  | "party_chat"
  | "astral_chat"
  | "player_name"
  | "club_name"
  | "club_description"
  | "pet_name"
  | "feedback";

export type ModerationCategory = "profanity" | "violence" | "hate" | "harassment" | "pii" | "policy";

export interface ModerationVerdict {
  allowed: boolean;
  errorCode?: typeof MODERATION_BLOCKED_CODE;
  category?: ModerationCategory;
  /** Сообщение для UI или системного чата */
  userMessage: string;
  /** 0–1: насколько текст подозрителен (для асинхронной проверки ИИ) */
  suspicion?: number;
  /** Конкретный тип нарушения (PII, соцсеть, пароль и т.д.) */
  violationKind?: SensitiveKind;
}

const LATIN_TO_CYR: Record<string, string> = {
  a: "а", b: "б", c: "к", d: "д", e: "е", f: "ф", g: "г", h: "х",
  i: "и", j: "й", k: "к", l: "л", m: "м", n: "н", o: "о", p: "п",
  q: "к", r: "р", s: "с", t: "т", u: "у", v: "в", w: "в", x: "кс",
  y: "у", z: "з",
};

const LEET: Record<string, string> = {
  "@": "а", "4": "а", "0": "о", "1": "и", "3": "е", "$": "с", "5": "с",
  "6": "б", "7": "т", "8": "в", "9": "g", "!": "и", "|": "l",
};

/** Unicode-подделки букв → кириллица/латиница. */
const HOMOGLYPHS: Record<string, string> = {
  "а": "а", "a": "а", "α": "а", "@": "а", "4": "а", "ä": "а", "à": "а", "á": "а",
  "в": "в", "b": "б", "β": "в",
  "с": "с", "c": "с", "¢": "с",
  "е": "е", "e": "е", "ё": "е", "3": "е", "€": "е",
  "о": "о", "o": "о", "0": "о", "ο": "о", "ö": "о",
  "р": "р", "p": "р", "ρ": "р",
  "х": "х", "x": "кс", "χ": "х", "h": "х",
  "у": "у", "y": "у", "u": "у", "υ": "у",
  "и": "и", "i": "и", "1": "и", "!": "и", "í": "и",
  "й": "й", "j": "й",
  "к": "к", "k": "к", "κ": "к",
  "н": "н", "n": "н", "η": "н",
  "м": "м", "m": "м",
  "т": "т", "t": "т",
  "л": "л", "l": "л",
  "д": "д", "d": "д",
  "г": "г", "g": "г", "6": "б",
  "з": "з", "z": "з",
  "п": "п",
  "б": "б",
  "ч": "ч",
  "ш": "ш",
  "щ": "щ",
  "ж": "ж",
  "ы": "ы",
  "э": "э",
  "ю": "ю",
  "я": "я",
  "ъ": "", "ь": "", "’": "", "'": "", "`": "", "´": "",
};

const TOKEN_SPLIT = /[\s,.;:!?()[\]{}«»"'`\\/|+\-_=~#@*]+/;

const VOWELS = /[aeiouyаеёиоуыэюя]/g;

function mapChar(ch: string): string {
  const lower = ch.toLowerCase();
  if (LEET[ch] !== undefined) return LEET[ch];
  if (HOMOGLYPHS[ch] !== undefined) return HOMOGLYPHS[ch];
  if (HOMOGLYPHS[lower] !== undefined) return HOMOGLYPHS[lower];
  return LATIN_TO_CYR[lower] ?? lower;
}

/** Сжимает текст: lower, homoglyphs, leet, без разделителей, сжатие повторов. */
export function normalizeForGuardian(input: string): string {
  let s = (input ?? "").normalize("NFKC").toLowerCase();
  s = s.replace(/ё/g, "е");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.split("").map(mapChar).join("");
  s = s.replace(/ph/g, "f").replace(/ck/g, "k").replace(/ks/g, "кс");
  s = s.replace(/(.)\1{2,}/g, "$1$1");
  return s.replace(/[^a-zа-я0-9]/g, "");
}

function vowelSkeleton(compact: string): string {
  return compact.replace(VOWELS, "");
}

/** Подпоследовательность с ограничением «мусора» между буквами паттерна. */
function matchesSubsequence(compact: string, pattern: string, maxJunkBetween = 3): boolean {
  if (!pattern || !compact) return false;
  let pi = 0;
  let junk = 0;
  for (let i = 0; i < compact.length && pi < pattern.length; i++) {
    if (compact[i] === pattern[pi]) {
      pi++;
      junk = 0;
    } else if (pi > 0) {
      junk++;
      if (junk > maxJunkBetween) return false;
    }
  }
  return pi === pattern.length;
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function matchesRootDeep(compact: string, root: string, mode: GuardianScanMode): boolean {
  if (!compact || !root) return false;
  if (root.length >= 3 && compact.includes(root)) return true;

  if (mode === "lenient") {
    if (compact.length > 24) return false;
    if (root.length >= 4 && compact.includes(root)) return true;
    if (root.length >= 3 && compact.length <= 12 && compact.includes(root)) return true;
    return false;
  }

  const maxJunk = Math.max(2, Math.floor(root.length / 2));
  if (root.length >= 3 && matchesSubsequence(compact, root, maxJunk)) return true;

  if (root.length >= 3) {
    const shorter = root.slice(0, -1);
    if (
      compact.length >= shorter.length
      && compact.length <= root.length + 1
      && matchesSubsequence(compact, shorter, 1)
    ) {
      return true;
    }
  }

  if (compact.length >= 2 && compact.length <= root.length + 2) {
    const dist = levenshtein(compact, root);
    const limit = root.length <= 4 ? 1 : 2;
    if (dist <= limit && Math.abs(compact.length - root.length) <= 2) return true;
  }

  if (root.length >= 3 && compact.length >= root.length - 1) {
    const skel = vowelSkeleton(compact);
    const rootSkel = vowelSkeleton(root);
    if (rootSkel.length >= 2 && skel.includes(rootSkel)) return true;
    if (matchesSubsequence(skel, rootSkel, maxJunk)) return true;
  }

  return false;
}

function matchesCriticalFragment(compact: string, fragment: string): boolean {
  if (!compact || !fragment) return false;
  if (compact === fragment) return true;
  if (compact.length <= 5 && fragment.length <= 3) {
    if (matchesSubsequence(compact, fragment, 0)) return true;
  }
  return false;
}

function scanRoots(
  compact: string,
  roots: readonly string[],
  category: ModerationCategory,
  mode: GuardianScanMode,
): ModerationCategory | null {
  for (const root of roots) {
    if (matchesRootDeep(compact, root, mode)) return category;
  }
  return null;
}

function scanFragments(compact: string, mode: GuardianScanMode): ModerationCategory | null {
  if (mode === "lenient") return null;
  for (const frag of GUARDIAN_CRITICAL_FRAGMENTS) {
    if (matchesCriticalFragment(compact, frag)) return "profanity";
  }
  return null;
}

/** Варианты текста для проверки: склейка букв, slug, первые буквы слов. */
export function buildGuardianScanVariants(raw: string, mode: GuardianScanMode = "strict"): string[] {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return [];

  const variants = new Set<string>();
  const compact = normalizeForGuardian(trimmed);
  if (compact) variants.add(compact);

  const parts = trimmed.split(TOKEN_SPLIT).filter(Boolean);
  for (const part of parts) {
    const pc = normalizeForGuardian(part);
    if (pc) variants.add(pc);
  }

  if (mode === "strict") {
    const singleLetterParts = parts
      .map(p => normalizeForGuardian(p))
      .filter(p => p.length === 1);
    if (singleLetterParts.length >= 2) {
      variants.add(singleLetterParts.join(""));
    }
    if (parts.length >= 3) {
      const initials = parts
        .map(p => normalizeForGuardian(p)[0])
        .filter(Boolean)
        .join("");
      if (initials.length >= 2) variants.add(initials);
    }

    const slug = normalizeForGuardian(trimmed.replace(/[\s\-_|/\\.,]+/g, ""));
    if (slug) variants.add(slug);

    if (compact.length >= 3 && compact.length <= 12) {
      const skel = vowelSkeleton(compact);
      if (skel.length >= 2) variants.add(skel);
    }
  }

  return [...variants];
}

function deepScanVariant(compact: string, mode: GuardianScanMode): ModerationCategory | null {
  const profanity = scanRoots(compact, GUARDIAN_PROFANITY_ROOTS, "profanity", mode);
  if (profanity) return profanity;

  if (mode === "lenient") return null;

  return (
    scanRoots(compact, GUARDIAN_VIOLENCE_ROOTS, "violence", mode)
    ?? scanRoots(compact, GUARDIAN_HATE_ROOTS, "hate", mode)
    ?? scanRoots(compact, GUARDIAN_HARASSMENT_PHRASES, "harassment", mode)
    ?? scanFragments(compact, mode)
  );
}

function computeSuspicion(raw: string, compact: string, mode: GuardianScanMode): number {
  let score = 0;
  if (mode === "strict") {
    if (/[\d@$!|0-9]/.test(raw)) score += 0.15;
    if (/[a-z]/i.test(raw) && /[а-яё]/i.test(raw)) score += 0.2;
    if ((raw.match(TOKEN_SPLIT) ?? []).length >= 3 && raw.length <= 20) score += 0.15;
    if (compact.length > 0 && compact.length <= 4) score += 0.1;
    const parts = raw.split(TOKEN_SPLIT).filter(Boolean);
    if (parts.every(p => p.length === 1) && parts.length >= 2) score += 0.35;
    if (/@[a-z0-9]/i.test(raw) || /\b(?:at|dot|собака|точка)\b/i.test(raw)) score += 0.25;
    if (/\d[\d\s\-().]{8,}\d/.test(raw)) score += 0.2;
    if (/(?:https?:|www\.|\/\/)/i.test(raw)) score += 0.35;
    if (scanSensitiveContent(raw, mode)) score = Math.max(score, 0.85);
  } else {
    if (/(?:https?:\/\/|www\.|t\.me\/|discord\.gg\/)/i.test(raw)) score += 0.5;
  }
  return Math.min(1, score);
}

export function messageForViolationKind(
  surface: ModerationSurface,
  kind: SensitiveKind,
): string {
  if (kind === "password") return MODERATION_CHAT_PASSWORD;
  if (kind === "link") return MODERATION_CHAT_LINK;
  if (kind === "social") return MODERATION_CHAT_SOCIAL;
  if (kind === "off_platform") return MODERATION_CHAT_OFF_PLATFORM;
  if (kind === "email" || kind === "phone" || kind === "card" || kind === "address"
    || kind === "fio" || kind === "document" || kind === "ip") {
    if (surface === "club_description") return MODERATION_DESC_PII;
    if (surface === "player_name" || surface === "club_name" || surface === "pet_name") {
      return MODERATION_NAME_PII;
    }
    return MODERATION_CHAT_PII;
  }
  return MODERATION_CHAT_PII;
}

function messageForSurface(surface: ModerationSurface, category: ModerationCategory, kind?: SensitiveKind): string {
  if (category === "policy" || category === "pii") {
    if (kind) return messageForViolationKind(surface, kind);
    if (category === "policy") return MODERATION_CHAT_OFF_PLATFORM;
    if (surface === "club_chat" || surface === "party_chat") return MODERATION_CHAT_PII;
    if (surface === "astral_chat") return MODERATION_ASTRAL_INLINE;
    if (surface === "club_description") return MODERATION_DESC_PII;
    if (surface === "feedback") {
      return "Нельзя отправлять личные данные — измените текст и попробуйте снова.";
    }
    return MODERATION_NAME_PII;
  }
  if (surface === "club_chat" || surface === "party_chat") return MODERATION_CHAT_SYSTEM;
  if (surface === "astral_chat") return MODERATION_ASTRAL_INLINE;
  if (surface === "club_description") return MODERATION_DESC_ERROR;
  if (surface === "feedback") {
    return "Сообщение содержит недопустимые слова — измените текст и попробуйте снова.";
  }
  return MODERATION_NAME_ERROR;
}

function categoryForSensitiveKind(kind: SensitiveKind): ModerationCategory {
  if (kind === "password" || kind === "social" || kind === "off_platform" || kind === "link") {
    return "policy";
  }
  return "pii";
}

/** Глубокая проверка — все варианты обфускации. */
export function guardianDeepScan(
  text: string,
  surface?: ModerationSurface,
): {
  category: ModerationCategory | null;
  suspicion: number;
  violationKind?: SensitiveKind;
} {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { category: null, suspicion: 0 };

  const mode = surface ? scanModeForSurface(surface) : "strict";
  const variants = buildGuardianScanVariants(trimmed, mode);
  const compact = variants[0] ?? "";
  let category: ModerationCategory | null = null;
  let violationKind: SensitiveKind | undefined;

  for (const variant of variants) {
    category = deepScanVariant(variant, mode);
    if (category) break;
  }

  if (!category && mode === "strict") {
    for (const part of trimmed.split(TOKEN_SPLIT).filter(Boolean)) {
      const pc = normalizeForGuardian(part);
      if (pc.length <= 5) {
        category = scanFragments(pc, mode);
        if (category) break;
      }
    }
  }

  if (!category) {
    const sensitive = scanSensitiveContent(trimmed, mode);
    if (sensitive) {
      violationKind = sensitive;
      category = categoryForSensitiveKind(sensitive);
    }
  }

  return {
    category,
    violationKind,
    suspicion: category ? 1 : computeSuspicion(trimmed, compact, mode),
  };
}

/** Основная проверка текста «Стражом». */
export function guardianModerate(text: string, surface: ModerationSurface): ModerationVerdict {
  const trimmed = (text ?? "").trim();
  if (!trimmed) {
    return { allowed: true, userMessage: "" };
  }

  const { category, suspicion, violationKind } = guardianDeepScan(trimmed, surface);

  if (!category) {
    return { allowed: true, userMessage: "", suspicion };
  }

  return {
    allowed: false,
    errorCode: MODERATION_BLOCKED_CODE,
    category,
    violationKind,
    suspicion,
    userMessage: messageForSurface(surface, category, violationKind),
  };
}

export function isModerationBlocked(result: {
  errorCode?: string;
  error?: string;
}): boolean {
  return result.errorCode === MODERATION_BLOCKED_CODE;
}

export function guardianBlockResult(
  _surface: ModerationSurface,
  verdict: ModerationVerdict,
): { success: false; error: string; errorCode: typeof MODERATION_BLOCKED_CODE } {
  return {
    success: false,
    error: verdict.userMessage,
    errorCode: MODERATION_BLOCKED_CODE,
  };
}

/** Сообщение чата, которое не нужно проверять / удалять. */
export function isGuardianSkippableMessage(msg: {
  system?: boolean;
  astral?: boolean;
  username?: string;
  text?: string;
  pinId?: string;
  battleShare?: unknown;
}): boolean {
  if (msg.system || msg.astral || msg.pinId || msg.battleShare) return true;
  if (msg.username === GUARDIAN_NAME || msg.username === "🛡️ Страж") return true;
  return !(msg.text ?? "").trim();
}

/** Проверка имени / названия. */
export function guardianModerateName(text: string, surface: "player_name" | "club_name" | "pet_name"): ModerationVerdict {
  return guardianModerate(text, surface);
}

/** Проверка текста чата. */
export function guardianModerateChat(text: string, surface: "club_chat" | "party_chat" | "astral_chat"): ModerationVerdict {
  return guardianModerate(text, surface);
}

/** Отфильтровать историю чата — удалить нарушающие сообщения. */
export function guardianFilterChatHistory<T extends { text?: string; system?: boolean; astral?: boolean; username?: string; pinId?: string; battleShare?: unknown }>(
  messages: T[],
  surface: "club_chat" | "party_chat",
): { filtered: T[]; removedCount: number } {
  let removedCount = 0;
  const filtered = messages.filter(msg => {
    if (isGuardianSkippableMessage(msg)) return true;
    const mod = guardianModerateChat(msg.text ?? "", surface);
    if (!mod.allowed) {
      removedCount++;
      return false;
    }
    return true;
  });
  return { filtered, removedCount };
}
