import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { translations } from "./translations.js";

const SUPPORTED_LOCALES = ["en", "es"];
const LanguageContext = createContext(null);

function getInitialLocale() {
  if (typeof window === "undefined") {
    return "en";
  }

  const savedLocale = window.localStorage.getItem("budget_locale");
  if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
    return savedLocale;
  }

  const browserLocale = window.navigator.language?.slice(0, 2)?.toLowerCase();
  return SUPPORTED_LOCALES.includes(browserLocale) ? browserLocale : "en";
}

function getValueAtPath(target, path) {
  return path.split(".").reduce((current, segment) => current?.[segment], target);
}

function LanguageProvider({ children }) {
  const [locale, setLocale] = useState(getInitialLocale);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("budget_locale", locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => {
    function t(path, fallback = path) {
      return (
        getValueAtPath(translations[locale], path) ??
        getValueAtPath(translations.en, path) ??
        fallback
      );
    }

    return {
      locale,
      setLocale,
      supportedLocales: SUPPORTED_LOCALES,
      t,
    };
  }, [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function useLanguage() {
  const context = useContext(LanguageContext);

  if (!context) {
    throw new Error("useLanguage must be used inside LanguageProvider.");
  }

  return context;
}

export { LanguageProvider, useLanguage };
