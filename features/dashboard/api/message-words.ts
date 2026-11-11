import "server-only"

import { createTranslator } from "next-intl"

import { DEFAULT_LOCALES } from "@/lib/page-language"
import { wordsFor } from "@/lib/translations/interface-words"
import { welcomeWordsIn, type WelcomeWords } from "../utils/automation-defaults"
import {
  TEMPLATE_LANGUAGES,
  bookWordsIn,
  type BookingField,
  type BookWords,
  type TemplateLanguage,
} from "../utils/booking-templates"

// Book's own words for its WhatsApp messages in each language
// (docs/plans/translations.md, G8), from the app's words
// (owner.whatsapp.bookWording): English is the code's, Spanish the
// hand-written text Meta approved (Edited), Portuguese and French Google's;
// a language without its translation yet shows the English, and an admin's
// edit on Translations wins.

export async function bookWordsFor(
  language: TemplateLanguage
): Promise<BookWords> {
  return bookWordsIn(language, await wordsFor(language))
}

// Every language's words, for a page or a check that shows them all.
export async function allBookWords(): Promise<
  Record<TemplateLanguage, BookWords>
> {
  const all = await Promise.all(TEMPLATE_LANGUAGES.map(bookWordsFor))
  return Object.fromEntries(
    all.map((words) => [words.language, words])
  ) as Record<TemplateLanguage, BookWords>
}

// Every language's sample values, for an editor's live preview.
export async function bookExamples(): Promise<
  Record<TemplateLanguage, Record<BookingField, string>>
> {
  const all = await allBookWords()
  return Object.fromEntries(
    TEMPLATE_LANGUAGES.map((language) => [language, all[language].examples])
  ) as Record<TemplateLanguage, Record<BookingField, string>>
}

// The Welcome flow's words in every language, for welcomeDefaults.
export async function welcomeWords(): Promise<
  Record<TemplateLanguage, WelcomeWords>
> {
  const all = await Promise.all(
    TEMPLATE_LANGUAGES.map(
      async (language): Promise<[TemplateLanguage, WelcomeWords]> => [
        language,
        welcomeWordsIn(language, await wordsFor(language)),
      ]
    )
  )
  return Object.fromEntries(all) as Record<TemplateLanguage, WelcomeWords>
}

// A length of time in the message's language (app.duration). Messages and
// emails go out on the server's timer, with no page behind them, so the
// words come straight from the app's words, as a Google Calendar event's do
// (lib/google-calendar-event.ts).
export async function durationWordsFor(language: TemplateLanguage) {
  return createTranslator({
    locale: DEFAULT_LOCALES[language],
    messages: await wordsFor(language),
    namespace: "app.duration",
  })
}
