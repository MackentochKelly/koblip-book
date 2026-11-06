import { createTranslator, type Messages } from "next-intl"

import { DEFAULT_LOCALES, PAGE_LANGUAGES } from "@/lib/page-language"
import type {
  AutomationAction,
  AutomationButton,
  AutomationLanguage,
  AutomationWording,
} from "../types/automations"

// The Welcome flow's words in one language.
export type WelcomeWords = {
  body: string
  handoffReply: string
  servicesIntro: string
  buttons: Record<AutomationAction["type"], string>
}

// The Welcome flow's words in one language, from that language's app words
// (owner.whatsapp.bookWording.welcome): the server reads them with wordsFor
// (../api/message-words.ts, welcomeWords).
export function welcomeWordsIn(language: AutomationLanguage, messages: Messages): WelcomeWords {
  const t = createTranslator({
    locale: DEFAULT_LOCALES[language],
    messages,
    namespace: "owner.whatsapp.bookWording.welcome",
  })
  return {
    body: t("body", { business: "{business}" }),
    handoffReply: t("handoffReply"),
    servicesIntro: t("servicesIntro"),
    buttons: {
      bookingLink: t("buttons.bookingLink"),
      servicesList: t("buttons.servicesList"),
      handoff: t("buttons.handoff"),
    },
  }
}

// Book's buttons, each with a stable id (the WhatsApp payload).
const BUTTONS: { id: string; action: AutomationAction }[] = [
  { id: "welcome-booking", action: { type: "bookingLink" } },
  { id: "welcome-services", action: { type: "servicesList" } },
  { id: "welcome-handoff", action: { type: "handoff" } },
]

// Book's Welcome flow in every language, from each language's words.
// New businesses store these words once; later reads keep their saved
// choices (withEveryLanguage).
export function welcomeDefaults(words: Record<AutomationLanguage, WelcomeWords>): {
  wording: AutomationWording
  buttons: AutomationButton[]
} {
  return {
    wording: Object.fromEntries(
      PAGE_LANGUAGES.map((language) => {
        const { body, handoffReply, servicesIntro } = words[language]
        return [language, { body, handoffReply, servicesIntro }]
      })
    ) as AutomationWording,
    buttons: BUTTONS.map(({ id, action }) => ({
      id,
      label: Object.fromEntries(
        PAGE_LANGUAGES.map((language) => [language, words[language].buttons[action.type]])
      ) as AutomationButton["label"],
      action,
    })),
  }
}

// A flow as saved: a flow saved before a language came lacks it.
type SavedButton = Omit<AutomationButton, "label"> & { label: Partial<AutomationButton["label"]> }

export type WithEveryLanguage<T> = Omit<T, "wording" | "buttons"> & {
  wording: AutomationWording
  buttons: AutomationButton[]
}

// A saved flow in every language. A language it was saved without reads
// Book's words for it; so does every language while the flow is still
// Book's own (`isDefault`), so the newest words show (an admin's edit on
// Translations, Google's newest translation). A button's label comes from
// Book's button with the same action.
export function withEveryLanguage<
  T extends { wording: Partial<AutomationWording>; buttons: SavedButton[]; isDefault: boolean },
>(flow: T, defaults: ReturnType<typeof welcomeDefaults>): WithEveryLanguage<T> {
  return {
    ...flow,
    wording: Object.fromEntries(
      PAGE_LANGUAGES.map((language) => [
        language,
        flow.isDefault ? defaults.wording[language] : (flow.wording[language] ?? defaults.wording[language]),
      ])
    ) as AutomationWording,
    buttons: flow.buttons.map((button) => {
      const own = button.label
      const fallback =
        defaults.buttons.find((item) => item.action.type === button.action.type)?.label ??
        defaults.buttons[0].label
      return {
        ...button,
        label: Object.fromEntries(
          PAGE_LANGUAGES.map((language) => [
            language,
            flow.isDefault ? fallback[language] : (own[language] ?? fallback[language]),
          ])
        ) as AutomationButton["label"],
      }
    }),
  }
}
