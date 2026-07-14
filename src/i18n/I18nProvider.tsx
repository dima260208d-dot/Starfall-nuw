import {

  createContext,

  useCallback,

  useContext,

  useMemo,

  useSyncExternalStore,

  type ReactNode,

} from "react";

import {

  changeLocale,

  getLocale,

  initLocale,

  translate,

  type TranslateParams,

} from "./core";

import { GAME_LOCALES, getLocaleMeta, type LocaleCode } from "./locales";



initLocale();



type I18nContextValue = {

  locale: LocaleCode;

  localeMeta: ReturnType<typeof getLocaleMeta>;

  setLocale: (code: LocaleCode) => void;

  t: (key: string, params?: TranslateParams, fallback?: string) => string;

};



const I18nContext = createContext<I18nContextValue | null>(null);



function subscribeLocale(cb: () => void) {

  const handler = () => cb();

  window.addEventListener("clash-locale-change", handler);

  return () => window.removeEventListener("clash-locale-change", handler);

}



function getLocaleSnapshot(): LocaleCode {

  return getLocale();

}



export function I18nProvider({ children }: { children: ReactNode }) {

  const locale = useSyncExternalStore(

    subscribeLocale,

    getLocaleSnapshot,

    () => DEFAULT_LOCALE_SNAPSHOT,

  );



  const setLocale = useCallback((code: LocaleCode) => {

    changeLocale(code);

  }, []);



  const value = useMemo<I18nContextValue>(

    () => ({

      locale,

      localeMeta: getLocaleMeta(locale),

      setLocale,

      t: translate,

    }),

    [locale, setLocale],

  );



  return (

    <I18nContext.Provider value={value}>{children}</I18nContext.Provider>

  );

}



const DEFAULT_LOCALE_SNAPSHOT: LocaleCode = "ru";



export function useI18n(): I18nContextValue {

  const ctx = useContext(I18nContext);

  if (!ctx) {

    throw new Error("useI18n must be used within I18nProvider");

  }

  return ctx;

}



/** Safe hook for modules that may render outside provider. */

export function useI18nOptional(): I18nContextValue {

  const ctx = useContext(I18nContext);

  if (ctx) return ctx;

  return {

    locale: getLocale(),

    localeMeta: getLocaleMeta(getLocale()),

    setLocale: changeLocale,

    t: translate,

  };

}



export { GAME_LOCALES };


