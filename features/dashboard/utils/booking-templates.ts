import { createTranslator, type Messages } from "next-intl"

import { fieldsToLabels, fieldsFromLabels, fillFields } from "@/lib/message-fields"
import type { ButtonsProblem, WordingProblem } from "@/types/koblip-messages"
import { formatClock, formatDay } from "@/lib/format-booking-time"
import { durationIn, type DurationWords } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import { DEFAULT_LOCALES, PAGE_LANGUAGES, type PageLanguage } from "@/lib/page-language"
import { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"
import type { BookingMessage } from "@/types/whatsapp"
import type { ButtonAction, MessageButton, OwnerAlert } from "../types/notifications"

// Book's WhatsApp booking messages, as Meta templates (Utility) in every page
// language (docs/koblip-chat-integration.md, step 2). Book creates them in each
// business's Koblip Chat when the owner submits them to Meta; inside the
// 24-hour window the same words go as
// plain text. Owners edit them with named fields ({name}, {service}…); Meta
// gets them as positional {{1}}, {{2}}… in the order they appear.

// The kinds of message are shared with the admin (types/whatsapp.ts, D33).
export type { BookingMessage } from "@/types/whatsapp"

// A template in every language a customer can book in: each language is its
// own template at Meta, reviewed on its own (docs/plans/translations.md, G8).
export type TemplateLanguage = PageLanguage

export type BookingField =
  | "name"
  | "service"
  | "business"
  | "date"
  | "time"
  | "teamMember"
  | "duration"
  | "price"
  | "address"
  | "phone"

// Listed in lib/whatsapp-messages.ts, shared with the admin (D33).
export { BOOKING_MESSAGES } from "@/lib/whatsapp-messages"

// The alerts that go to the owner's own WhatsApp, in the owner's language.
export const OWNER_ALERTS: readonly OwnerAlert[] = [
  "ownerNewBooking",
  "ownerCantCome",
  "ownerCancelled",
  "ownerFailed",
]

export function isOwnerAlert(message: string): message is OwnerAlert {
  return (OWNER_ALERTS as readonly string[]).includes(message)
}

export const TEMPLATE_LANGUAGES: readonly TemplateLanguage[] = PAGE_LANGUAGES

// Meta's code for each language, from Meta's list
// (developers.facebook.com/docs/whatsapp/business-management-api/
// message-templates/supported-languages, read 2026-11-06): English "en",
// Spanish "es", Portuguese (BR) "pt_BR", French "fr". Chat passes it to
// Meta as it is, and lists templates with it.
const META_LANGUAGES: Record<TemplateLanguage, string> = {
  en: "en",
  es: "es",
  pt: "pt_BR",
  fr: "fr",
}

export function metaLanguage(language: TemplateLanguage): string {
  return META_LANGUAGES[language]
}

// The fields each message may use: the customer's messages name the business
// and where it is, the owner's alerts give the customer's phone.
export function messageFields(message: BookingMessage): BookingField[] {
  return isOwnerAlert(message)
    ? ["name", "service", "date", "time", "teamMember", "duration", "price", "phone"]
    : ["name", "service", "business", "date", "time", "teamMember", "duration", "price", "address"]
}

export type Wording = { header: string; body: string; footer: string }

// Book's own words for its messages in one language: the wording and buttons
// a message has until the owner writes their own, the sample values Meta
// reviews with, the words for a value a booking lacks, and the thank-you.
export type BookWords = {
  language: TemplateLanguage
  // Dates, times and prices in the language's own formats, as the booking
  // page writes them by default (DEFAULT_LOCALES in lib/page-language.ts).
  locale: string
  wording: Record<BookingMessage, Wording>
  buttons: Record<ButtonAction, string>
  examples: Record<BookingField, string>
  missing: { teamMember: string; free: string; price: string }
  thankYou: string
}

// Each field as itself: the words keep {name}, {service}… for Book to fill.
const FIELD_TOKENS: Record<BookingField, string> = {
  name: "{name}",
  service: "{service}",
  business: "{business}",
  date: "{date}",
  time: "{time}",
  teamMember: "{teamMember}",
  duration: "{duration}",
  price: "{price}",
  address: "{address}",
  phone: "{phone}",
}

// The sample business, a name, so the same in every language.
const SAMPLE_BUSINESS = "Lumen Studio"

// The sample booking's length, in the app's words for a length of time.
const SAMPLE_MINUTES = 45

// Book's words in one language, from that language's app words
// (owner.whatsapp.bookWording, ../i18n/en/whatsapp-wording.ts): the server
// reads them with wordsFor (../api/message-words.ts, bookWordsFor), where
// English is the code's and every other language is the database's, with
// the English until a translation arrives.
export function bookWordsIn(language: TemplateLanguage, messages: Messages): BookWords {
  const locale = DEFAULT_LOCALES[language]
  const t = createTranslator({ locale, messages, namespace: "owner.whatsapp.bookWording" })
  const duration = createTranslator({ locale, messages, namespace: "app.duration" })
  const footer = t("footer")
  return {
    language,
    locale,
    wording: Object.fromEntries(
      BOOKING_MESSAGES.map((message) => [
        message,
        {
          header: t(`messages.${message}.header`),
          body: t(`messages.${message}.body`, FIELD_TOKENS),
          footer,
        },
      ])
    ) as Record<BookingMessage, Wording>,
    buttons: {
      confirm: t("buttons.confirm"),
      cantCome: t("buttons.cantCome"),
      ok: t("buttons.ok"),
    },
    examples: {
      name: t("examples.name"),
      service: t("examples.service"),
      business: SAMPLE_BUSINESS,
      date: t("examples.date"),
      time: t("examples.time"),
      teamMember: t("examples.teamMember"),
      duration: durationIn(duration, SAMPLE_MINUTES),
      price: t("examples.price"),
      address: t("examples.address"),
      phone: t("examples.phone"),
    },
    missing: {
      teamMember: t("missing.teamMember"),
      free: t("missing.free"),
      price: t("missing.price"),
    },
    thankYou: t("thankYou", FIELD_TOKENS),
  }
}

export function defaultWording(message: BookingMessage, words: BookWords): Wording {
  return words.wording[message]
}

// The buttons a message may carry: the customer answers a reminder or a moved
// booking, may say they can't come after booking, and a cancellation only
// takes an "OK". The owner's alerts have none.
export function messageButtonActions(message: BookingMessage): ButtonAction[] {
  if (isOwnerAlert(message)) return []
  if (message === "cancelled") return ["ok"]
  return ["confirm", "cantCome", "ok"]
}

// Book's buttons for a message (decision D7 in docs/plans/whatsapp-notifications.md).
const DEFAULT_BUTTONS: Record<BookingMessage, ButtonAction[]> = {
  confirmed: [],
  reminder: ["confirm", "cantCome"],
  changed: ["confirm", "cantCome"],
  cancelled: [],
  ownerNewBooking: [],
  ownerCantCome: [],
  ownerCancelled: [],
  ownerFailed: [],
}

export function defaultButtons(message: BookingMessage, words: BookWords): MessageButton[] {
  const { buttons } = words
  return DEFAULT_BUTTONS[message].map((action) => ({ action, label: buttons[action] }))
}

// What is wrong with an owner's buttons, or null. WhatsApp quick replies: at
// most NOTIFICATION_RULES.maxButtons, each a different action and label, one
// line of plain text without fields, formatting or emoji (Meta refuses the
// whole template otherwise: developers.facebook.com/docs/whatsapp/
// business-management-api/message-templates/components#quick-reply-buttons).
export type { ButtonsProblem } from "@/types/koblip-messages"

export function buttonsProblem(message: BookingMessage, buttons: MessageButton[]): ButtonsProblem | null {
  if (buttons.length > NOTIFICATION_RULES.maxButtons) return "tooManyButtons"
  const allowed = messageButtonActions(message)
  for (const { action, label } of buttons) {
    if (
      !allowed.includes(action) ||
      typeof label !== "string" ||
      !label.trim() ||
      label.length > NOTIFICATION_RULES.maxButtonLabel ||
      /[\r\n\t{}*_~`]/.test(label) ||
      /\p{Extended_Pictographic}/u.test(label)
    ) {
      return "badButton"
    }
  }
  const labels = new Set(buttons.map(({ label }) => label.trim().toLowerCase()))
  const actions = new Set(buttons.map(({ action }) => action))
  if (labels.size < buttons.length || actions.size < buttons.length) return "sameButton"
  return null
}

const FIELD = /\{(\w+)\}/g

// What is wrong with an owner's wording, or null. Meta's rules: a body may
// not start or end with a field, nor have two fields side by side; the title
// and footer are one line without fields (developers.facebook.com/docs/
// whatsapp/business-management-api/message-templates); and enough words
// around the fields (Meta's "Params Words Ratio Exceeds Limit", see
// NOTIFICATION_RULES.minWordsPerField).
export type { WordingProblem } from "@/types/koblip-messages"

export function wordingProblem(message: BookingMessage, wording: Wording): WordingProblem | null {
  const { header, body, footer } = wording
  if (!header.trim() || !body.trim()) return "empty"
  if (
    header.length > NOTIFICATION_RULES.maxHeader ||
    body.length > NOTIFICATION_RULES.maxBody ||
    footer.length > NOTIFICATION_RULES.maxFooter
  ) {
    return "tooLong"
  }
  if (/[\r\n]/.test(header) || /[\r\n]/.test(footer)) return "lineBreak"
  if (/[{}]/.test(header) || /[{}]/.test(footer)) return "fieldInLine"
  const allowed = messageFields(message)
  for (const [, key] of body.matchAll(FIELD)) {
    if (!allowed.includes(key as BookingField)) return "unknownField"
  }
  // A brace that is not a whole field is a typo.
  if (/[{}]/.test(body.replace(FIELD, ""))) return "unknownField"
  const trimmed = body.trim()
  if (/^\{\w+\}/.test(trimmed) || /\{\w+\}[.!?]*$/.test(trimmed)) return "fieldAtEdge"
  if (/\}\s*\{/.test(body)) return "fieldsTogether"
  const fields = new Set([...body.matchAll(FIELD)].map(([, key]) => key)).size
  const words = body.replace(FIELD, " ").split(/\s+/).filter((word) => /\p{L}/u.test(word)).length
  if (fields && words <= fields * NOTIFICATION_RULES.minWordsPerField) return "fewWords"
  return null
}

export type BookingTemplate = Wording & {
  message: BookingMessage
  language: TemplateLanguage
  // The language as Meta names it (metaLanguage), for Chat and Meta.
  metaLanguage: string
  name: string
  buttons: MessageButton[]
  // The body in Meta's form ({{1}}…) and which field each number stands for.
  metaBody: string
  fields: BookingField[]
  examples: string[]
}

// Meta's name for a business's own copy of a message (lowercase and
// underscores); the same name in each language. `_v2`: Meta blocks a deleted
// name for weeks, and the first set was deleted (decision D1 in
// docs/plans/whatsapp-notifications.md).
const NAMES: Record<BookingMessage, string> = {
  confirmed: "koblip_book_booking_confirmed_v2",
  reminder: "koblip_book_booking_reminder_v2",
  changed: "koblip_book_booking_changed_v2",
  cancelled: "koblip_book_booking_cancelled_v2",
  ownerNewBooking: "koblip_book_owner_new_booking_v2",
  ownerCantCome: "koblip_book_owner_cant_come_v2",
  ownerCancelled: "koblip_book_owner_cancelled_v2",
  ownerFailed: "koblip_book_owner_message_failed_v2",
}

// Koblip's ready-made set, in Koblip's own workspace (D1): Book's wording and
// buttons for every business, which names itself through {business}.
const KOBLIP_NAMES: Record<BookingMessage, string> = {
  confirmed: "koblip_booking_confirmed_v2",
  reminder: "koblip_booking_reminder_v2",
  changed: "koblip_booking_changed_v2",
  cancelled: "koblip_booking_cancelled_v2",
  ownerNewBooking: "koblip_owner_new_booking_v2",
  ownerCantCome: "koblip_owner_cant_come_v2",
  ownerCancelled: "koblip_owner_cancelled_v2",
  ownerFailed: "koblip_owner_message_failed_v2",
}

// The name of Koblip's copy of a message, the same in each language.
export function koblipTemplateName(message: BookingMessage): string {
  return KOBLIP_NAMES[message]
}

export function koblipTemplate(
  message: BookingMessage,
  words: BookWords,
  wording?: Wording,
  buttons?: MessageButton[]
): BookingTemplate {
  return { ...bookingTemplate(message, words, wording, buttons), name: KOBLIP_NAMES[message] }
}

// One message as Chat gets it, from the owner's wording and buttons or Book's.
export function bookingTemplate(
  message: BookingMessage,
  words: BookWords,
  wording: Wording = defaultWording(message, words),
  buttons: MessageButton[] = defaultButtons(message, words)
): BookingTemplate {
  const { language, examples } = words
  const fields: BookingField[] = []
  const metaBody = wording.body.replace(FIELD, (_, key: BookingField) => {
    if (!fields.includes(key)) fields.push(key)
    return `{{${fields.indexOf(key) + 1}}}`
  })
  return {
    message,
    language,
    metaLanguage: metaLanguage(language),
    name: NAMES[message],
    header: wording.header,
    body: wording.body,
    footer: wording.footer,
    buttons,
    metaBody,
    fields,
    examples: fields.map((field) => examples[field]),
  }
}

// The owner sees fields in their own language ({nombre}); Book keeps them as
// {name}. Both directions leave anything else as it is.
export function fieldsForOwner(text: string, labels: Record<BookingField, string>) {
  return fieldsToLabels(text, labels)
}

export function fieldsFromOwner(text: string, labels: Record<BookingField, string>) {
  return fieldsFromLabels(text, labels)
}

// The sample values Meta reviews with, also used for a test message.
export function exampleValues(words: BookWords): Record<BookingField, string> {
  return { ...words.examples }
}

// A message's text with sample values, as the customer would read it.
export function withExamples(text: string, words: BookWords) {
  return fillFields(text, words.examples)
}

export type BookingFacts = {
  customerName: string
  customerPhone: string | null
  serviceName: string
  teamMemberName: string | null
  durationMinutes: number
  priceMinor: number | null
  currency: string
  businessName: string
  businessAddress: string | null
  // The local day (YYYY-MM-DD) and time (HH:MM) at the business.
  date: string
  time: string
}

// Every field's value for one booking, in the reader's language: `duration`
// is the app's words for a length of time (app.duration) in that language.
// A value the booking does not have reads as words (`missing`): Meta refuses
// an empty template value, and the customer reads a sentence, not a dash.
export function bookingValues(
  facts: BookingFacts,
  words: BookWords,
  duration: DurationWords
): Record<BookingField, string> {
  const { locale, missing } = words
  return {
    name: facts.customerName,
    service: facts.serviceName,
    business: facts.businessName,
    date: formatDay(facts.date, locale),
    time: formatClock(facts.time, locale),
    teamMember: facts.teamMemberName?.trim() || missing.teamMember,
    duration: durationIn(duration, facts.durationMinutes),
    price:
      facts.priceMinor === null
        ? missing.price
        : facts.priceMinor === 0
          ? missing.free
          : formatPrice(facts.priceMinor, facts.currency, locale),
    // Without an address the customer still knows the place by its name.
    address: facts.businessAddress?.trim() || facts.businessName,
    phone: facts.customerPhone || "-",
  }
}

// A message's text with the booking's own values.
export function withValues(text: string, values: Record<BookingField, string>) {
  return text.replace(FIELD, (whole, key: string) =>
    key in values ? values[key as BookingField] : whole
  )
}

// The message as plain WhatsApp text, for inside the 24-hour window: the
// title in bold and the footer in italics, as the template shows them.
export function plainMessage(template: BookingTemplate, values: Record<BookingField, string>) {
  return [
    template.header && `*${withValues(template.header, values)}*`,
    withValues(template.body, values),
    template.footer && `_${template.footer}_`,
  ]
    .filter(Boolean)
    .join("\n\n")
}

// The short thank-you after a customer taps a button (S3, D24): a normal
// message only, since the tap opened the 24-hour window; never a template.
export function thankYouMessage(words: BookWords, values: Record<BookingField, string>) {
  return withValues(words.thankYou, values)
}
