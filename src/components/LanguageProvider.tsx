"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_COOKIE,
  LANGUAGE_COOKIE_MAX_AGE,
  isLanguage,
  localeOf,
  translate,
  translateValue,
  type Language,
  type TranslateParams,
  type TranslationKey,
} from "@/lib/i18n";
import { titleCase } from "@/lib/utils";
import { Select } from "./ui/Field";

/**
 * Legacy key. The preference used to live in localStorage, which the server
 * can't read; anything still stored there is migrated to the cookie once, so an
 * existing choice isn't silently reset.
 */
const LEGACY_STORAGE_KEY = "ro-language";

function writeCookie(language: Language) {
  document.cookie = `${LANGUAGE_COOKIE}=${language}; path=/; max-age=${LANGUAGE_COOKIE_MAX_AGE}; samesite=lax`;
}

type LanguageContextValue = {
  language: Language;
  setLanguage: (next: Language) => void;
  /** Translate a key, substituting any {placeholders}. */
  t: (key: TranslationKey, params?: TranslateParams) => string;
  /**
   * Label for a value stored in the database, e.g. `tv("category", "gym")`.
   * Unknown values fall back to the title-cased raw value, which keeps
   * user-invented diary tags working.
   */
  tv: (namespace: string, value: string) => string;
  /** BCP 47 tag for Intl calls — date and money formatting. */
  locale: string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

/**
 * Holds the selected interface language and persists it to a cookie.
 *
 * `initial` comes from the server, which read the same cookie before rendering.
 * That's what removes the flash of English on first paint: the very first HTML
 * is already in the right language, so there's nothing to correct after
 * hydration. State starts from that value rather than from a default.
 *
 * (ThemeProvider still uses the localStorage-then-effect approach. A theme flip
 * is far less jarring than text changing language, so it was left alone.)
 */
export function LanguageProvider({
  initial,
  children,
}: {
  initial: Language;
  children: ReactNode;
}) {
  const [language, setLanguageState] = useState<Language>(initial);

  useEffect(() => {
    // One-time migration for anyone whose choice is still only in localStorage
    // from the previous implementation. Only applies when the server saw no
    // cookie, so it can't override a real cookie-backed choice.
    if (initial !== DEFAULT_LANGUAGE) return;
    if (document.cookie.includes(`${LANGUAGE_COOKIE}=`)) return;

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!isLanguage(legacy) || legacy === DEFAULT_LANGUAGE) return;

    setLanguageState(legacy);
    writeCookie(legacy);
    document.documentElement.lang = localeOf(legacy);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }, [initial]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    writeCookie(next);
    // Keep the document in step: screen readers and browser translation
    // prompts both key off this attribute.
    document.documentElement.lang = localeOf(next);
  }, []);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key, params) => translate(language, key, params),
      tv: (namespace, value) =>
        translateValue(language, namespace, value, titleCase(value)),
      locale: localeOf(language),
    }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return context;
}

/** Shorthand for components that only need the translate function. */
export function useT() {
  return useLanguage().t;
}

/** Language picker for the settings screen. */
export function LanguageSelect() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="max-w-xs">
      <Select
        label={t("settings.language")}
        value={language}
        onChange={(event) => setLanguage(event.target.value as Language)}
      >
        {LANGUAGES.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
