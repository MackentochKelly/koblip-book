import { headers } from "next/headers"
import { getRequestConfig } from "next-intl/server"

import {
  DEFAULT_LANGUAGE,
  DEFAULT_LOCALES,
  isPageLanguage,
  languageOf,
  PAGE_LANGUAGE_HEADER,
  type PageLanguage,
  pickLocale,
} from "@/lib/page-language"
import {
  registerEnglishWords,
  wordsFor,
} from "@/lib/translations/interface-words"
import { SOURCE_LANGUAGE } from "@/lib/translations/languages"
import messages from "./messages"

registerEnglishWords(messages)

let pseudoMessages: typeof messages | undefined

// A language's words. Development only: with I18N_PSEUDO=1 in .env.local
// the English is a long made-up language, to test layouts
// (lib/translations/pseudo.ts); production never reads it.
async function wordsIn(language: PageLanguage) {
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.I18N_PSEUDO === "1" &&
    language === SOURCE_LANGUAGE
  ) {
    const { pseudoWords } = await import("@/lib/translations/pseudo")
    pseudoMessages ??= pseudoWords(messages)
    return pseudoMessages
  }
  return wordsFor(language)
}

// Each request's words and formats (next-intl without i18n routing,
// node_modules/next-intl/dist/types/server/react-server/getRequestConfig.d.ts).
// The language is the page's own (proxy.ts picks it per area); numbers,
// prices and dates read as in the visitor's region (pickLocale), so the
// locale is a format one ("es-ES"): languageOf(locale) gives the language.
// Code that names a language itself (getTranslations({ locale: "es" }),
// an email to a customer) gets that language and its default region.
export default getRequestConfig(async ({ locale }) => {
  if (locale) {
    const language = languageOf(locale)
    // A region only for a language the app has ("es-ES", "pt-PT"); anything
    // else reads as the language's default, never German formats on English.
    const ownRegion =
      locale.includes("-") && isPageLanguage(locale.split("-")[0].toLowerCase())
    return {
      locale: ownRegion ? locale : DEFAULT_LOCALES[language],
      messages: await wordsIn(language),
    }
  }
  const asked = await headers()
  const picked = asked.get(PAGE_LANGUAGE_HEADER)
  const language = isPageLanguage(picked) ? picked : DEFAULT_LANGUAGE
  return {
    locale: pickLocale(language, asked.get("accept-language")),
    messages: await wordsIn(language),
  }
})
