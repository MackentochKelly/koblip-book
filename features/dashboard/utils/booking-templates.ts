import { formatClock, formatDay } from "@/lib/format-booking-time"
import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { NOTIFICATION_RULES } from "@/lib/notification-rules"
import type { ButtonAction, MessageButton } from "../types/notifications"

// Book's WhatsApp booking messages, as Meta templates (Utility) in English and
// Spanish (docs/koblip-chat-integration.md, step 2). Book creates them in each
// business's Koblip Chat when the owner submits them to Meta; inside the
// 24-hour window the same words go as
// plain text. Owners edit them with named fields ({name}, {service}…); Meta
// gets them as positional {{1}}, {{2}}… in the order they appear.

export type BookingMessage =
  | "confirmed"
  | "reminder"
  | "changed"
  | "cancelled"
  | "ownerNewBooking"

export type TemplateLanguage = "en" | "es"

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

export const BOOKING_MESSAGES: readonly BookingMessage[] = [
  "confirmed",
  "reminder",
  "changed",
  "cancelled",
  "ownerNewBooking",
]

export const TEMPLATE_LANGUAGES: readonly TemplateLanguage[] = ["en", "es"]

// The fields each message may use: the customer's messages name the business
// and where it is, the owner's alert gives the customer's phone.
export function messageFields(message: BookingMessage): BookingField[] {
  return message === "ownerNewBooking"
    ? ["name", "service", "date", "time", "teamMember", "duration", "price", "phone"]
    : ["name", "service", "business", "date", "time", "teamMember", "duration", "price", "address"]
}

export type Wording = { header: string; body: string; footer: string }

const DEFAULT_WORDING: Record<TemplateLanguage, Record<BookingMessage, Wording>> = {
  en: {
    confirmed: {
      header: "Booking confirmed",
      body: "Hi {name}, your {service} at {business} is booked for {date} at {time}. We look forward to seeing you then!",
      footer: "Reply here to talk to us",
    },
    reminder: {
      header: "Appointment reminder",
      body: "Hi {name}, a reminder of your {service} at {business} on {date} at {time}. See you soon!",
      footer: "Reply here to talk to us",
    },
    changed: {
      header: "Booking changed",
      body: "Hi {name}, your {service} at {business} has been moved to {date} at {time}. We look forward to seeing you then!",
      footer: "Reply here to talk to us",
    },
    cancelled: {
      header: "Booking cancelled",
      body: "Hi {name}, your {service} at {business} on {date} at {time} has been cancelled. We hope to see you soon.",
      footer: "Reply here to talk to us",
    },
    ownerNewBooking: {
      header: "New booking",
      body: "New booking from {name}: {service} on {date} at {time}. Phone: {phone}. Open Koblip Book for details.",
      footer: "Reply here to talk to us",
    },
  },
  es: {
    confirmed: {
      header: "Reserva confirmada",
      body: "Hola {name}, tu {service} en {business} está reservado para el {date} a las {time}. ¡Te esperamos!",
      footer: "Responde aquí para hablar con nosotros",
    },
    reminder: {
      header: "Recordatorio de cita",
      body: "Hola {name}, te recordamos tu cita de {service} en {business} el {date} a las {time}. ¡Te esperamos, hasta pronto!",
      footer: "Responde aquí para hablar con nosotros",
    },
    changed: {
      header: "Reserva cambiada",
      body: "Hola {name}, tu cita de {service} en {business} se ha movido al {date} a las {time}. ¡Te esperamos con gusto!",
      footer: "Responde aquí para hablar con nosotros",
    },
    cancelled: {
      header: "Reserva cancelada",
      body: "Hola {name}, tu {service} en {business} el {date} a las {time} fue cancelado. Esperamos verte pronto.",
      footer: "Responde aquí para hablar con nosotros",
    },
    ownerNewBooking: {
      header: "Nueva reserva",
      body: "Nueva reserva de {name}: {service} el {date} a las {time}. Teléfono: {phone}. Abre Koblip Book para ver más.",
      footer: "Responde aquí para hablar con nosotros",
    },
  },
}

export function defaultWording(message: BookingMessage, language: TemplateLanguage): Wording {
  return DEFAULT_WORDING[language][message]
}

// The buttons a message may carry: the customer answers a reminder or a moved
// booking, may say they can't come after booking, and a cancellation only
// takes an "OK". The owner's alerts have none.
export function messageButtonActions(message: BookingMessage): ButtonAction[] {
  if (message === "ownerNewBooking") return []
  if (message === "cancelled") return ["ok"]
  return ["confirm", "cantCome", "ok"]
}

const BUTTON_LABELS: Record<TemplateLanguage, Record<ButtonAction, string>> = {
  en: { confirm: "I'll be there", cantCome: "Can't make it", ok: "OK" },
  es: { confirm: "Ahí estaré", cantCome: "No podré ir", ok: "De acuerdo" },
}

// Book's buttons for a message (decision D7 in docs/plans/whatsapp-notifications.md).
const DEFAULT_BUTTONS: Record<BookingMessage, ButtonAction[]> = {
  confirmed: [],
  reminder: ["confirm", "cantCome"],
  changed: ["confirm", "cantCome"],
  cancelled: [],
  ownerNewBooking: [],
}

export function defaultButtons(message: BookingMessage, language: TemplateLanguage): MessageButton[] {
  return DEFAULT_BUTTONS[message].map((action) => ({ action, label: BUTTON_LABELS[language][action] }))
}

// What is wrong with an owner's buttons, or null. WhatsApp quick replies: at
// most NOTIFICATION_RULES.maxButtons, each a different action and label, one
// line of plain text without fields, formatting or emoji (Meta refuses the
// whole template otherwise: developers.facebook.com/docs/whatsapp/
// business-management-api/message-templates/components#quick-reply-buttons).
export type ButtonsProblem = "tooManyButtons" | "badButton" | "sameButton"

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

// Meta reviews each template with sample values for its fields.
const EXAMPLES: Record<TemplateLanguage, Record<BookingField, string>> = {
  en: {
    name: "Alex",
    service: "Haircut",
    business: "Lumen Studio",
    date: "Friday, May 8",
    time: "3:30 PM",
    teamMember: "Sam",
    duration: "45 min",
    price: "$35.00",
    address: "123 Main Street",
    phone: "+1 555 123 4567",
  },
  es: {
    name: "Ana",
    service: "Corte de pelo",
    business: "Lumen Studio",
    date: "viernes 8 de mayo",
    time: "15:30",
    teamMember: "Lucía",
    duration: "45 min",
    price: "35,00 €",
    address: "Calle Mayor 12",
    phone: "+34 600 123 456",
  },
}

const FIELD = /\{(\w+)\}/g

// What is wrong with an owner's wording, or null. Meta's rules: a body may
// not start or end with a field, nor have two fields side by side; the title
// and footer are one line without fields (developers.facebook.com/docs/
// whatsapp/business-management-api/message-templates); and enough words
// around the fields (Meta's "Params Words Ratio Exceeds Limit", see
// NOTIFICATION_RULES.minWordsPerField).
export type WordingProblem =
  | "empty"
  | "tooLong"
  | "unknownField"
  | "fieldAtEdge"
  | "fieldsTogether"
  | "fieldInLine"
  | "lineBreak"
  | "fewWords"

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
}

// One message as Chat gets it, from the owner's wording and buttons or Book's.
export function bookingTemplate(
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording = defaultWording(message, language),
  buttons: MessageButton[] = defaultButtons(message, language)
): BookingTemplate {
  const fields: BookingField[] = []
  const metaBody = wording.body.replace(FIELD, (_, key: BookingField) => {
    if (!fields.includes(key)) fields.push(key)
    return `{{${fields.indexOf(key) + 1}}}`
  })
  return {
    message,
    language,
    name: NAMES[message],
    header: wording.header,
    body: wording.body,
    footer: wording.footer,
    buttons,
    metaBody,
    fields,
    examples: fields.map((field) => EXAMPLES[language][field]),
  }
}

// The owner sees fields in their own language ({nombre}); Book keeps them as
// {name}. Both directions leave anything else as it is.
export function fieldsForOwner(text: string, labels: Record<BookingField, string>) {
  return text.replace(FIELD, (whole, key: string) =>
    key in labels ? `{${labels[key as BookingField]}}` : whole
  )
}

export function fieldsFromOwner(text: string, labels: Record<BookingField, string>) {
  const byLabel = new Map(
    Object.entries(labels).map(([key, label]) => [label.toLowerCase(), key])
  )
  return text.replace(FIELD, (whole, label: string) => {
    const key = byLabel.get(label.toLowerCase())
    return key ? `{${key}}` : whole
  })
}

// The sample values Meta reviews with, also used for a test message.
export function exampleValues(language: TemplateLanguage): Record<BookingField, string> {
  return { ...EXAMPLES[language] }
}

// A message's text with sample values, as the customer would read it.
export function withExamples(text: string, language: TemplateLanguage) {
  return text.replace(FIELD, (whole, key: string) =>
    key in EXAMPLES[language] ? EXAMPLES[language][key as BookingField] : whole
  )
}

// Dates, times and prices as the customer saw them on the booking page
// (lib/i18n.ts).
const LOCALES: Record<TemplateLanguage, string> = { en: "en-US", es: "es-US" }

// The words for a value the booking does not have: Meta refuses an empty
// template value, and the customer reads a sentence, not a dash.
const MISSING: Record<TemplateLanguage, { teamMember: string; free: string; price: string }> = {
  en: { teamMember: "our team", free: "free", price: "to be confirmed" },
  es: { teamMember: "nuestro equipo", free: "gratis", price: "por confirmar" },
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

// Every field's value for one booking, in the reader's language.
export function bookingValues(
  facts: BookingFacts,
  language: TemplateLanguage
): Record<BookingField, string> {
  const locale = LOCALES[language]
  const missing = MISSING[language]
  return {
    name: facts.customerName,
    service: facts.serviceName,
    business: facts.businessName,
    date: formatDay(facts.date, locale),
    time: formatClock(facts.time, locale),
    teamMember: facts.teamMemberName?.trim() || missing.teamMember,
    duration: formatDuration(facts.durationMinutes),
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
