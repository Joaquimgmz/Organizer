import { cookies } from "next/headers";
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, isLanguage, type Language } from ".";

/**
 * The selected language, read on the server so the first paint is already in the
 * right language.
 *
 * Kept in its own module because `next/headers` can only be imported from server
 * code — pulling it into ./index.ts would break every client component that
 * imports the dictionaries.
 */
export async function getLanguage(): Promise<Language> {
  const store = await cookies();
  const value = store.get(LANGUAGE_COOKIE)?.value;
  // Anything unrecognised falls back rather than rendering raw keys.
  return isLanguage(value) ? value : DEFAULT_LANGUAGE;
}
