/**
 * Обнаружение личных данных в тексте чата и профиля.
 * Email, телефоны, карты, адреса, ФИО, документы, IP и т.п.
 */
import { scanPolicyViolation, type PolicyKind } from "./contentGuardianPolicy";
import type { GuardianScanMode } from "./contentGuardianContext";
import { looksLikeGameStatsContext } from "./contentGuardianContext";

export type PiiKind =
  | "email"
  | "phone"
  | "card"
  | "address"
  | "fio"
  | "document"
  | "ip"
  | "social";

/** Маркеры намерения перед ФИО / документами. */
const FIO_MARKERS =
  /(?:\b(?:ф\.?\s*и\.?\s*о\.?|фio|фио|меня\s+зовут|мое\s+имя|моё\s+имя|my\s+name\s+is|full\s+name|surname|lastname|firstname|фамилия|имя\s+и\s+фамилия|отчество)\b)/i;

const DOC_MARKERS =
  /(?:\b(?:инн|inn|снилс|snils|паспорт|passport|огрн|ogrn|огрнип|бик|bic|iban|расч[её]тный\s+сч[её]t?|р\/\s*с|к\/\s*с|cvv|cvc|pin[\s-]?code)\b)/i;

const ADDRESS_MARKERS =
  /(?:\b(?:ул(?:ица)?\.?|пр(?:оспект)?\.?|пер(?:еулок)?\.?|бульвар|б-?р|шоссе|набережная|пл(?:ощадь)?\.?|д(?:ом)?\.?|к(?:орп)?\.?|кв(?:артира)?\.?|стр(?:оение)?\.?|подъезд|этаж|микрорайон|мкр\.?|район|область|обл\.?|город|г\.?|пос(?:[её]лок)?\.?|деревня|д\.?|index|индекс|zip\s*code|postal)\b)/i;

const SOCIAL_MARKERS =
  /(?:\b(?:telegram|телеграм|whatsapp|вотсап|viber|вайбер|signal|discord|дискорд|vk\.com|instagram|инстаграм|tiktok|тик\s*ток)\b)/i;

const CYR_WORD = "[А-ЯЁ][а-яё]{1,}(?:-[А-ЯЁ][а-яё]{1,})?";
const PATRONYMIC =
  /(?:ович|евич|ич|овна|евна|ична|inich|ovna|evich|ovich)$/i;

/** Три слова с заглавной — типичное «Фамилия Имя Отчество». */
const TRIPLE_CYR_NAME = new RegExp(
  `\\b${CYR_WORD}\\s+${CYR_WORD}\\s+${CYR_WORD}\\b`,
  "u",
);

/** Два слова с заглавной + отчество на третьем или маркер. */
const DOUBLE_CYR_NAME = new RegExp(`\\b${CYR_WORD}\\s+${CYR_WORD}\\b`, "u");

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/** Luhn — проверка номера банковской карты. */
function passesLuhn(digits: string): boolean {
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

/** Раскрывает обфuscated email: «user (at) mail dot ru». */
function expandEmailObfuscation(raw: string): string {
  return raw
    .replace(/\(\s*at\s*\)|\[\s*at\s*\]|\{\s*at\s*\}/gi, "@")
    .replace(/\b(?:at|собака|sobaka|dog)\b/gi, "@")
    .replace(/\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\}/gi, ".")
    .replace(/\b(?:dot|точка)\b/gi, ".")
    .replace(/\s+@\s+/g, "@")
    .replace(/\s*\.\s*/g, ".");
}

function looksLikeEmail(raw: string): boolean {
  const expanded = expandEmailObfuscation(raw.toLowerCase());
  const re = /[a-z0-9._%+\-]{2,}@[a-z0-9.\-]{2,}\.[a-z]{2,24}/i;
  if (re.test(expanded)) return true;
  const spaced = raw.replace(/\s+/g, "");
  return /[a-z0-9._%+\-]{2,}@[a-z0-9.\-]{2,}\.[a-z]{2,24}/i.test(spaced);
}

function looksLikePhone(raw: string, mode: GuardianScanMode): boolean {
  const compact = digitsOnly(raw);
  if (compact.length < 10 || compact.length > 15) return false;

  const hasPhoneFormatting = /(?:\+7|\+?\d{1,3}[\s\-().]|8[\s\-(]\d{3})/.test(raw);
  if (mode === "lenient" && !hasPhoneFormatting && !raw.includes("+")) {
    if (looksLikeGameStatsContext(raw)) return false;
    return false;
  }

  const phoneLikePattern =
    /(?:\+?\d{1,3}[\s\-().]*)?(?:\d[\s\-().]*){9,12}\d/;
  if (!phoneLikePattern.test(raw) && compact.length < 10) return false;

  let normalized = compact;
  if (normalized.length === 11 && (normalized.startsWith("8") || normalized.startsWith("7"))) {
    normalized = normalized.slice(1);
  }
  if (normalized.length === 10) {
    const ruMobile = /^9\d{9}$/.test(normalized);
    if (ruMobile) return true;
    if (mode === "strict") {
      const ruLand = /^[3-8]\d{9}$/.test(normalized);
      if (ruLand) return true;
    }
  }

  if (mode === "strict" && compact.length >= 10 && compact.length <= 15) {
    const sepCount = (raw.match(/[\s\-().+]/g) ?? []).length;
    if (sepCount >= 2 || raw.includes("+")) return true;
  }

  return hasPhoneFormatting && compact.length >= 10 && compact.length <= 12;
}

function findCardNumbers(raw: string): string[] {
  const found: string[] = [];
  const groupRe = /\b(?:\d[\s\-]*){13,19}\b/g;
  let m: RegExpExecArray | null;
  while ((m = groupRe.exec(raw)) !== null) {
    const d = digitsOnly(m[0]!);
    if (d.length >= 13 && d.length <= 19) found.push(d);
  }
  const plainRe = /\d{13,19}/g;
  while ((m = plainRe.exec(digitsOnly(raw))) !== null) {
    found.push(m[0]!);
  }
  return [...new Set(found)];
}

function looksLikeCard(raw: string): boolean {
  const hasCardContext =
    /\b(?:карт[аы]|card|visa|mastercard|mir|мир|debitcard|creditcard|cvv|cvc)\b/i.test(raw);

  const candidates = findCardNumbers(raw);
  for (const d of candidates) {
    if (passesLuhn(d)) return true;
  }

  if (hasCardContext) {
    for (const d of candidates) {
      if (d.length >= 13 && d.length <= 19) return true;
    }
  }

  const grouped = raw.match(/\b\d{4}[\s\-]\d{4}[\s\-]\d{4}[\s\-]\d{4}\b/);
  if (grouped) {
    const d = digitsOnly(grouped[0]!);
    if (d.length === 16 && passesLuhn(d)) return true;
  }
  return false;
}

function looksLikeAddress(raw: string, mode: GuardianScanMode): boolean {
  if (mode === "lenient") return false;
  const lower = raw.toLowerCase();
  if (!ADDRESS_MARKERS.test(lower)) return false;
  const hasNumber = /\d{1,5}/.test(raw);
  const hasPostal = /\b\d{6}\b/.test(raw);
  return hasNumber || hasPostal;
}

function looksLikeFio(raw: string, mode: GuardianScanMode): boolean {
  if (mode === "lenient") {
    if (!FIO_MARKERS.test(raw)) return false;
  }

  const SURNAME_ENDING =
    /(?:ов|ев|ин|ова|ева|ая|енко|ук|юк|ский|ская|швили|дзе)$/i;

  if (FIO_MARKERS.test(raw)) {
    const after = raw.split(FIO_MARKERS).pop()?.trim() ?? "";
    if (after.length >= 4 && (TRIPLE_CYR_NAME.test(after) || DOUBLE_CYR_NAME.test(after))) {
      return true;
    }
    if (/[А-ЯЁ][а-яё\-]{2,}/.test(after)) return true;
  }

  const triple = raw.match(TRIPLE_CYR_NAME);
  if (triple && mode === "strict") {
    const words = triple[0]!.split(/\s+/);
    const third = words[2] ?? "";
    const first = words[0] ?? "";
    if (PATRONYMIC.test(third)) return true;
    if (SURNAME_ENDING.test(first) && (words[1]?.length ?? 0) >= 3) return true;
  }

  return false;
}

function looksLikeDocument(raw: string): boolean {
  const lower = raw.toLowerCase();
  if (!DOC_MARKERS.test(lower)) return false;

  const digits = digitsOnly(raw);
  if (digits.length === 10 || digits.length === 11 || digits.length === 12) return true;

  if (/\d{2}[\s\-]?\d{2}[\s\-]?\d{6}/.test(raw)) return true;
  if (/\d{3}[\s\-]?\d{3}[\s\-]?\d{3}[\s\-]?\d{2}/.test(raw)) return true;
  if (/\b\d{3,4}\b/.test(raw)) return true;

  return DOC_MARKERS.test(raw);
}

function looksLikeIp(raw: string): boolean {
  const re = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})\b/;
  return re.test(raw);
}

function looksLikeSocialHandle(raw: string): boolean {
  if (/@[a-z0-9_]{4,}/i.test(raw) && SOCIAL_MARKERS.test(raw)) return true;
  if (/t\.me\/[a-z0-9_]{3,}/i.test(raw)) return true;
  if (/(?:vk\.com|instagram\.com|tiktok\.com)\/[a-z0-9_.]{3,}/i.test(raw)) return true;
  if (SOCIAL_MARKERS.test(raw) && looksLikePhone(raw)) return true;
  return false;
}

/** Длинная «голая» цифровая последовательность без игрового контекста. */
function looksLikeRawSensitiveDigits(raw: string, mode: GuardianScanMode): boolean {
  if (mode === "lenient") return false;
  const d = digitsOnly(raw);
  if (d.length < 10) return false;
  const letterRatio = (raw.match(/[a-zа-яё]/gi) ?? []).length / Math.max(raw.length, 1);
  if (letterRatio > 0.35) return false;
  if (d.length === 10 || d.length === 11) return looksLikePhone(raw);
  if (d.length >= 13 && d.length <= 19) return passesLuhn(d) || d.length === 16;
  return d.length >= 10 && letterRatio < 0.15;
}

export type SensitiveKind = PiiKind | PolicyKind;

/** Полная проверка: PII + соцсети + пароли + увод общения. */
export function scanSensitiveContent(raw: string, mode: GuardianScanMode = "strict"): SensitiveKind | null {
  return scanPolicyViolation(raw, mode) ?? scanPersonalData(raw, mode);
}

/** Проверка текста на личные данные. */
export function scanPersonalData(raw: string, mode: GuardianScanMode = "strict"): PiiKind | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.length < 5) return null;

  if (looksLikeEmail(trimmed)) return "email";
  if (looksLikeCard(trimmed)) return "card";
  if (looksLikeDocument(trimmed)) return "document";
  if (looksLikePhone(trimmed, mode)) return "phone";
  if (mode === "strict" && looksLikeIp(trimmed)) return "ip";
  if (looksLikeFio(trimmed, mode)) return "fio";
  if (looksLikeAddress(trimmed, mode)) return "address";
  if (mode === "strict" && looksLikeSocialHandle(trimmed)) return "social";
  if (looksLikeRawSensitiveDigits(trimmed, mode)) return "phone";

  if (mode === "strict") {
    const parts = trimmed.split(/[\s,;|/\\]+/).filter(Boolean);
    for (const part of parts) {
      if (part.length < 5) continue;
      if (looksLikeEmail(part)) return "email";
      if (looksLikePhone(part, mode)) return "phone";
    }
  }

  return null;
}
