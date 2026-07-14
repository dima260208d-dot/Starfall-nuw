import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  type LocaleCode,
  getLocaleMeta,
  isLocaleCode,
} from "./locales";
import ruMessages from "./messages/ru.json";
import enMessages from "./messages/en.json";

export type MessageTable = Record<string, string>;

/** Eager static imports — runtime `import.meta.glob` is undefined in the browser bundle. */
const messageModules: Record<LocaleCode, MessageTable> = {
  ru: ruMessages,
  en: enMessages,
};

function bundledTable(code: LocaleCode): MessageTable {
  return messageModules[code] ?? messageModules[DEFAULT_LOCALE];
}

let activeLocale: LocaleCode = DEFAULT_LOCALE;
let activeMessages: MessageTable = bundledTable(DEFAULT_LOCALE);
let fallbackMessages: MessageTable = bundledTable(DEFAULT_LOCALE);

/** Pick ru/en from browser languages when the player has not chosen a locale yet. */
export function detectBrowserLocale(): LocaleCode {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const langs = [...(navigator.languages ?? []), navigator.language].filter(Boolean);
  for (const lang of langs) {
    const base = lang.split("-")[0]?.toLowerCase();
    if (base === "ru") return "ru";
    if (base === "en") return "en";
  }
  return DEFAULT_LOCALE;
}

export function readStoredLocale(): LocaleCode {
  try {
    if (typeof localStorage === "undefined") return detectBrowserLocale();
    const raw = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (raw && isLocaleCode(raw)) return raw;
  } catch {
    /* ignore */
  }
  return detectBrowserLocale();
}

export function applyDocumentLocale(code: LocaleCode): void {
  if (typeof document === "undefined" || !document.documentElement) return;
  const meta = getLocaleMeta(code);
  document.documentElement.lang = meta.bcp47;
  document.documentElement.dir = "ltr";
  document.body?.setAttribute("dir", "ltr");
}

export function getLocale(): LocaleCode {
  return activeLocale;
}

function applyActiveMessages(code: LocaleCode): void {
  activeMessages = bundledTable(code);
  fallbackMessages =
    code === DEFAULT_LOCALE ? activeMessages : bundledTable(DEFAULT_LOCALE);
}

export function setLocale(code: LocaleCode): void {
  activeLocale = code;
  applyActiveMessages(code);
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
  applyDocumentLocale(code);
}

/** Bootstrap locale from storage (call once before first render). */
export function initLocale(): LocaleCode {
  const code = readStoredLocale();
  setLocale(code);
  return code;
}

export type TranslateParams = Record<string, string | number>;

const PARAM_RE = /\{\{(\w+)\}\}|\{(\w+)\}/g;

export function formatMessage(
  template: string,
  params?: TranslateParams,
): string {
  if (!params) return template;
  return template.replace(PARAM_RE, (_, dbl, sgl) => {
    const key = dbl ?? sgl;
    const v = params[key];
    return v === undefined ? `{${key}}` : String(v);
  });
}

export function translate(
  key: string,
  params?: TranslateParams,
  fallback?: string,
): string {
  const raw =
    activeMessages[key] ??
    fallbackMessages[key] ??
    fallback ??
    key;
  return formatMessage(raw, params);
}

export const LOCALE_CHANGE_EVENT = "clash-locale-change";

export function notifyLocaleChange(): void {
  window.dispatchEvent(
    new CustomEvent(LOCALE_CHANGE_EVENT, { detail: { locale: activeLocale } }),
  );
}

export function changeLocale(code: LocaleCode): void {
  if (code === activeLocale) return;
  setLocale(code);
  notifyLocaleChange();
}

/** No-op: all strings are bundled in ru/en JSON. */
export function bootstrapLocaleHydration(): void {}

export function getLocaleHydrationProgress(): null {
  return null;
}

export function subscribeHydration(_cb: () => void): () => void {
  return () => {};
}
