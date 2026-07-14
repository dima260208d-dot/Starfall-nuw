/**
 * Обнаружение ссылок. В lenient-режиме (чат) — только явные URL, без «domain.com» в тексте.
 */
import type { GuardianScanMode } from "./contentGuardianContext";

const TLD_STRICT =
  "(?:com|ru|org|net|io|gg|me|co|uk|de|fr|info|biz|xyz|app|dev|online|site|shop|store|link|click|top|pro|live|tv|cc|su|by|kz|ua|edu|gov|eu|us)";

const URL_PROTOCOL =
  /(?:https?|ftp|ftps|hxxps?):\/\/[^\s<>"']+/i;

const URL_PROTOCOL_OBF =
  /\bh\s*t\s*t\s*p\s*s?\s*[:/\\]+\s*\/?\s*\S/i;

const URL_WWW =
  /\bwww\.[a-z0-9][a-z0-9.\-_]{0,120}\.[a-z]{2,24}(?:\/[^\s<>"']*)?/i;

const URL_PROTOCOL_RELATIVE =
  /(?:^|[\s([{"'])\/\/[a-z0-9][a-z0-9.\-_]{0,120}\.[a-z]{2,24}(?:\/[^\s<>"']*)?/i;

const URL_BARE_DOMAIN = new RegExp(
  `\\b[a-z0-9][a-z0-9\\-]{0,62}(?:\\.[a-z0-9][a-z0-9\\-]{0,62})+\\.${TLD_STRICT}\\b(?:\\/[^\\s<>"']+)`,
  "i",
);

const URL_KNOWN_SOCIAL_PATH =
  /\b(?:t\.me|discord\.gg|vk\.com|instagram\.com|tiktok\.com|youtu\.be|youtube\.com|twitch\.tv|wa\.me|steamcommunity\.com)\/\S+/i;

const URL_IPV4_WITH_PROTOCOL =
  /\bhttps?:\/\/(?:\d{1,3}\.){3}\d{1,3}(?::\d{1,5})?(?:\/[^\s<>"']*)?/i;

const DANGEROUS_SCHEME =
  /\b(?:javascript|data|file|vbscript|blob):[^\s]+/i;

const OBF_WWW =
  /\b(?:w\s*w\s*w|дабл\s*ю)\s*(?:[.\s(]|dot|точка)\s*\S/i;

const OBF_PROTOCOL =
  /\b(?:https?|ftp|hxxp)\s*(?:[:\s(]|colon|двоеточ)\s*\/?\/?\s*\S/i;

function expandLinkObfuscation(raw: string): string {
  let s = (raw ?? "").normalize("NFKC");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\(\s*dot\s*\)|\[\s*dot\s*\]|\{\s*dot\s*\}/gi, ".");
  s = s.replace(/\b(?:dot|точка)\b/gi, ".");
  s = s.replace(/:\s*\/\s*\//g, "://");
  s = s.replace(/hxxp/gi, "http");
  return s;
}

function compactUrlSpaces(raw: string): string {
  return raw.replace(/(?<=[:/])\s+|\s+(?=[:/])/g, "").replace(/\s*\.\s*/g, ".");
}

function testUrlPatterns(text: string, mode: GuardianScanMode): boolean {
  if (URL_PROTOCOL.test(text)) return true;
  if (URL_PROTOCOL_OBF.test(text)) return true;
  if (URL_WWW.test(text)) return true;
  if (URL_PROTOCOL_RELATIVE.test(text)) return true;
  if (URL_KNOWN_SOCIAL_PATH.test(text)) return true;
  if (URL_IPV4_WITH_PROTOCOL.test(text)) return true;
  if (DANGEROUS_SCHEME.test(text)) return true;
  if (mode === "strict" && URL_BARE_DOMAIN.test(text)) return true;
  return false;
}

function isLikelyVersionOrNumber(token: string): boolean {
  return /^(?:v?\d+(?:\.\d+)+|\d+\.\d+)$/i.test(token.trim());
}

/** Явная ссылка или URL. */
export function looksLikeLink(raw: string, mode: GuardianScanMode = "strict"): boolean {
  const t = (raw ?? "").trim();
  if (t.length < 6) return false;

  const expanded = compactUrlSpaces(expandLinkObfuscation(t));
  if (testUrlPatterns(expanded, mode)) return true;

  if (OBF_WWW.test(t) || OBF_PROTOCOL.test(t)) return true;

  const noSpaces = expanded.replace(/\s+/g, "");
  if (noSpaces.length >= 8 && testUrlPatterns(noSpaces, mode)) return true;

  const parts = t.split(/[\s,;|]+/).filter(Boolean);
  for (const part of parts) {
    if (isLikelyVersionOrNumber(part)) continue;
    const pExp = compactUrlSpaces(expandLinkObfuscation(part));
    if (testUrlPatterns(pExp, mode)) return true;
  }

  if (/\b[a-z0-9][a-z0-9-]{0,30}\s+(?:dot|точка|\(dot\))\s+[a-z]{2,12}(?:\s|$)/i.test(t)) {
    const joined = t.replace(/\s+(?:dot|точка|\(dot\))\s+/gi, ".");
    if (testUrlPatterns(compactUrlSpaces(expandLinkObfuscation(joined)), mode)) return true;
  }

  return false;
}
