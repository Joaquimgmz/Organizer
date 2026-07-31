import { de } from "./de";
import { en } from "./en";
import { es } from "./es";
import { fr } from "./fr";
import { ptBR } from "./pt-BR";

/**
 * Translation plumbing. Deliberately free of any React or database import, so
 * it can be used from a client component, a server component or a plain test.
 */

/** Every key the app can translate, derived from the English dictionary. */
export type TranslationKey = keyof typeof en;

/**
 * The shape every locale must satisfy. Because it's `Record<TranslationKey, …>`
 * rather than `Partial<…>`, a locale that forgets a key fails `tsc` instead of
 * rendering an empty label.
 */
export type Translation = Record<TranslationKey, string>;

export const LANGUAGES = [
  // `label` is intentionally the language's own name — someone who has landed in
  // the wrong language still needs to recognise their own in this list.
  { code: "en", label: "English", locale: "en" },
  { code: "pt-BR", label: "Português (Brasil)", locale: "pt-BR" },
  { code: "es", label: "Español", locale: "es" },
  { code: "fr", label: "Français", locale: "fr" },
  { code: "de", label: "Deutsch", locale: "de" },
] as const;

export type Language = (typeof LANGUAGES)[number]["code"];

export const DEFAULT_LANGUAGE: Language = "en";

/**
 * Where the choice is stored.
 *
 * A cookie rather than localStorage, because the server has to know the language
 * to render the first paint in it — localStorage is only readable after
 * hydration, which is what caused the brief flash of English. Not httpOnly: the
 * client sets it directly, and a UI language preference isn't sensitive.
 */
export const LANGUAGE_COOKIE = "ro-language";

/** One year, in seconds — long enough that the preference effectively sticks. */
export const LANGUAGE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DICTIONARIES: Record<Language, Translation> = {
  en,
  "pt-BR": ptBR,
  es,
  fr,
  de,
};

/** Narrow an untrusted string (localStorage, a URL) to a supported language. */
export function isLanguage(value: unknown): value is Language {
  return (
    typeof value === "string" &&
    LANGUAGES.some((entry) => entry.code === value)
  );
}

/** The BCP 47 tag to hand to Intl and the `lang` attribute. */
export function localeOf(language: Language): string {
  return (
    LANGUAGES.find((entry) => entry.code === language)?.locale ??
    DEFAULT_LANGUAGE
  );
}

export function labelOf(language: Language): string {
  return LANGUAGES.find((entry) => entry.code === language)?.label ?? language;
}

export type TranslateParams = Record<string, string | number>;

/**
 * Look up a key and substitute any {placeholders}.
 *
 * Falls back to English for a key that somehow isn't present at runtime — the
 * types make that unreachable in our own code, but a stale cached bundle
 * shouldn't render an empty string. As a last resort the key itself is
 * returned, which is far easier to spot and report than blank space.
 */
export function translate(
  language: Language,
  key: TranslationKey,
  params?: TranslateParams,
): string {
  const template = DICTIONARIES[language]?.[key] ?? en[key] ?? key;
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

/**
 * Label for a value that comes out of the database — an activity category, a
 * muscle group, a diary tag.
 *
 * These can't use `translate` because the key is built at runtime and so isn't
 * in the `TranslationKey` union. Crucially, an unknown value is *not* an error:
 * diary tags are user-invented, so anything without a key falls back to the raw
 * value, which is exactly what the app displayed before it was translated.
 *
 * Spaces are normalised to underscores so "upper body" resolves to
 * `muscle.upper_body`.
 */
export function translateValue(
  language: Language,
  namespace: string,
  value: string,
  fallback: string,
): string {
  const key = `${namespace}.${value.replace(/\s+/g, "_")}`;
  const dict = DICTIONARIES[language] as Record<string, string | undefined>;
  const fallbackDict = en as Record<string, string | undefined>;
  return dict[key] ?? fallbackDict[key] ?? fallback;
}
