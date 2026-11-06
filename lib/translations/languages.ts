import { PAGE_LANGUAGES, type PageLanguage } from "@/lib/page-language"

// Everything is written in English first and translated into the app's
// other languages (docs/plans/translations.md, Language scope).
export const SOURCE_LANGUAGE = "en" as const

export type TranslationLanguage = Exclude<PageLanguage, typeof SOURCE_LANGUAGE>

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] =
  PAGE_LANGUAGES.filter(
    (language): language is TranslationLanguage => language !== SOURCE_LANGUAGE
  )

// Google's code for each language
// (https://docs.cloud.google.com/translate/docs/languages). Portuguese is
// "pt-BR" and French "fr-FR" once they join the page languages (G8).
export const GOOGLE_LANGUAGE_CODES: Record<TranslationLanguage, string> = {
  es: "es",
}

export function isTranslationLanguage(
  value: string
): value is TranslationLanguage {
  return (TRANSLATION_LANGUAGES as readonly string[]).includes(value)
}
