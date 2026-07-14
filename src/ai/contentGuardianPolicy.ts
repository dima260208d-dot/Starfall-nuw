/**
 * Соцсети, пароли, попытки увести общение за пределы игры, ссылки.
 */
import type { GuardianScanMode } from "./contentGuardianContext";
import { looksLikeLink } from "./contentGuardianLinks";

export type PolicyKind = "social" | "password" | "off_platform" | "link";

const SOCIAL_LINK =
  /(?:https?:\/\/)?(?:www\.)?(?:t\.me|discord(?:\.gg|app\.com)|vk\.com|instagram\.com|tiktok\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|twitch\.tv|steamcommunity\.com|facebook\.com|fb\.com|ok\.ru|onlyfans\.com|boosty\.to|wa\.me)\/\S+/i;

const MESSENGER_HANDLE =
  /(?:^|[\s(])(?:t\.me\/|discord\.gg\/)[a-z0-9_./-]{3,}/i;

const PASSWORD_MARKER =
  /(?:\b(?:парол[ьи]|password|passwd|pwd|passcode|pass[\s-]?phrase|api[\s_-]?key|secret[\s_-]?key|секрет(?:ный)?[\s_-]?ключ|auth[\s_-]?key|private[\s_-]?key|access[\s_-]?key|refresh[\s_-]?token|bearer)\b\s*[:=]\s*\S{4,}|\b(?:мой|моя|мои|my)\s+(?:парол[ьи]|password|pwd)\b)/i;

/** Явное приглашение перейти в мессенджер / соцсеть. */
const OFF_PLATFORM_INVITE =
  /(?:\b(?:пиши|напиши|добав(?:ь|ьте)|скин(?:ь|те)|перейд(?:и|ём|ем)|свяж(?:ись|емся)|перепиш(?:емся|ись)|продолж(?:им|и)|поговор(?:им|ите)|увед(?:у|ём|ем)|перенес(?:ём|ем|и))\s+(?:мне\s+)?(?:в|на|через)\s+(?:telegram|телег(?:рам)?|t\.me|whatsapp|вотс(?:ап)?|discord|дискорд|vk|вк|instagram|insta|tiktok|тик\s*ток|viber|signal|max)\b)/i;

const OFF_PLATFORM_MY_CONTACT =
  /(?:\b(?:мой|моя|мои|my)\s+(?:тг|tg|телег(?:рам)?|дс|ds|диск(?:орд)?|ватс(?:ап)?|wa|vk|insta|telegram|discord|whatsapp)\b(?:\s*[:@]\s*\S+)?)/i;

const OFF_PLATFORM_DM_EXTERNAL =
  /(?:\b(?:лс|личк[ау]|dm)\b.{0,20}\b(?:telegram|телег|discord|дискорд|whatsapp|вотс|тг|дс|vk|instagram|insta|tiktok|вне\s+игры)\b)/i;

function normalizeLoose(raw: string): string {
  return (raw ?? "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function looksLikePassword(raw: string): boolean {
  const t = (raw ?? "").trim();
  if (t.length < 8) return false;
  return PASSWORD_MARKER.test(t);
}

export function looksLikeSocialShare(raw: string, mode: GuardianScanMode): boolean {
  const t = (raw ?? "").trim();
  if (t.length < 6) return false;
  if (SOCIAL_LINK.test(t)) return true;
  if (MESSENGER_HANDLE.test(t)) return true;
  if (mode === "strict") {
    if (/\b(?:подпис(?:ывай|аться)|subscribe|follow\s+me|my\s+channel)\b/i.test(t) && SOCIAL_LINK.test(t)) {
      return true;
    }
  }
  return false;
}

export function looksLikeOffPlatformContact(raw: string, mode: GuardianScanMode): boolean {
  const t = (raw ?? "").trim();
  if (t.length < 10) return false;
  const loose = normalizeLoose(t);

  if (OFF_PLATFORM_INVITE.test(loose)) return true;
  if (OFF_PLATFORM_MY_CONTACT.test(loose)) return true;
  if (OFF_PLATFORM_DM_EXTERNAL.test(t)) return true;

  if (mode === "strict") {
    if (/(?:напиши|пиши|добавь).{0,20}(?:t\.me|discord\.gg|@\S{4,})/i.test(loose)) return true;
  }

  return false;
}

export function scanPolicyViolation(raw: string, mode: GuardianScanMode = "strict"): PolicyKind | null {
  const trimmed = (raw ?? "").trim();
  if (!trimmed || trimmed.length < 4) return null;
  if (looksLikePassword(trimmed)) return "password";
  if (looksLikeLink(trimmed, mode)) return "link";
  if (looksLikeOffPlatformContact(trimmed, mode)) return "off_platform";
  if (looksLikeSocialShare(trimmed, mode)) return "social";
  return null;
}
