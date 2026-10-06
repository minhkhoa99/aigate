import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LANGUAGE_KEY, persistLanguage, readLanguage, translate, type Language, type MessageKey, type Params } from "./i18n";

interface Locale { language: Language; setLanguage: (language: Language) => void; t: (key: MessageKey, params?: Params) => string }
const LocaleContext = createContext<Locale | null>(null);
export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(() => readLanguage(() => localStorage.getItem(LANGUAGE_KEY)));
  useEffect(() => {
    document.documentElement.lang = language;
    persistLanguage(language, value => localStorage.setItem(LANGUAGE_KEY, value));
  }, [language]);
  const t = useCallback((key: MessageKey, params?: Params) => translate(language, key, params), [language]);
  const value = useMemo(() => ({ language, setLanguage, t }), [language, t]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
export function useLocale() {
  const locale = useContext(LocaleContext);
  if (!locale) throw new Error("LocaleProvider is missing");
  return locale;
}
