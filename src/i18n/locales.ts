/** Supported game UI locales. */
export const LOCALE_STORAGE_KEY = "clash_locale_v1";

export type LocaleCode = "ru" | "en";

export type LocaleMeta = {
  code: LocaleCode;
  /** Name in that language (for the picker list). */
  nativeName: string;
  /** BCP-47 tag for Intl / translate APIs. */
  bcp47: string;
};

export const GAME_LOCALES: readonly LocaleMeta[] = [
  { code: "ru", nativeName: "Русский", bcp47: "ru" },
  { code: "en", nativeName: "English", bcp47: "en" },
] as const;

export const DEFAULT_LOCALE: LocaleCode = "ru";

const META_BY_CODE = new Map<LocaleCode, LocaleMeta>(
  GAME_LOCALES.map((m) => [m.code, m]),
);

export function isLocaleCode(v: string): v is LocaleCode {
  return META_BY_CODE.has(v as LocaleCode);
}

export function getLocaleMeta(code: LocaleCode): LocaleMeta {
  return META_BY_CODE.get(code) ?? META_BY_CODE.get(DEFAULT_LOCALE)!;
}

/** Human-readable language name for Astral / system prompts. */
export const LOCALE_PROMPT_NAMES: Record<LocaleCode, string> = {
  ru: "Russian",
  en: "English",
};
