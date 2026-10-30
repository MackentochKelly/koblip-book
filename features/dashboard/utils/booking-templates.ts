import { NOTIFICATION_RULES } from "@/lib/notification-rules"

// Book's WhatsApp booking messages, as Meta templates (Utility) in English and
// Spanish (docs/koblip-chat-integration.md, step 2). Book creates them in each
// business's Koblip Chat; inside the 24-hour window the same words go as
// plain text. Owners edit them with named fields ({name}, {service}…); Meta
// gets them as positional {{1}}, {{2}}… in the order they appear.

export type BookingMessage =
  | "confirmed"
  | "reminder"
  | "changed"
  | "cancelled"
  | "ownerNewBooking"

export type TemplateLanguage = "en" | "es"

export type BookingField = "name" | "service" | "business" | "date" | "time" | "phone"

export const BOOKING_MESSAGES: readonly BookingMessage[] = [
  "confirmed",
  "reminder",
  "changed",
  "cancelled",
  "ownerNewBooking",
]

export const TEMPLATE_LANGUAGES: readonly TemplateLanguage[] = ["en", "es"]

// The fields each message may use: the customer's messages name the business,
// the owner's alert gives the customer's phone.
export function messageFields(message: BookingMessage): BookingField[] {
  return message === "ownerNewBooking"
    ? ["name", "service", "date", "time", "phone"]
    : ["name", "service", "business", "date", "time"]
}

export type Wording = { header: string; body: string; footer: string }

const DEFAULT_WORDING: Record<TemplateLanguage, Record<BookingMessage, Wording>> = {
  en: {
    confirmed: {
      header: "Booking confirmed",
      body: "Hi {name}, your {service} at {business} is booked for {date} at {time}. See you then!",
      footer: "Reply here to talk to us",
    },
    reminder: {
      header: "Appointment reminder",
      body: "Hi {name}, a reminder of your {service} at {business} on {date} at {time}. See you soon!",
      footer: "Reply here to talk to us",
    },
    changed: {
      header: "Booking changed",
      body: "Hi {name}, your {service} at {business} is now on {date} at {time}. See you then!",
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
      body: "Hola {name}, te recordamos tu {service} en {business} el {date} a las {time}. ¡Hasta pronto!",
      footer: "Responde aquí para hablar con nosotros",
    },
    changed: {
      header: "Reserva cambiada",
      body: "Hola {name}, tu {service} en {business} ahora es el {date} a las {time}. ¡Te esperamos!",
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

// Meta reviews each template with sample values for its fields.
const EXAMPLES: Record<TemplateLanguage, Record<BookingField, string>> = {
  en: {
    name: "Alex",
    service: "Haircut",
    business: "Lumen Studio",
    date: "Friday, May 8",
    time: "3:30 PM",
    phone: "+1 555 123 4567",
  },
  es: {
    name: "Ana",
    service: "Corte de pelo",
    business: "Lumen Studio",
    date: "viernes 8 de mayo",
    time: "15:30",
    phone: "+34 600 123 456",
  },
}

const FIELD = /\{(\w+)\}/g

// What is wrong with an owner's wording, or null. Meta's rules: a body may
// not start or end with a field, nor have two fields side by side; the title
// and footer are one line without fields (developers.facebook.com/docs/
// whatsapp/business-management-api/message-templates).
export type WordingProblem =
  | "empty"
  | "tooLong"
  | "unknownField"
  | "fieldAtEdge"
  | "fieldsTogether"
  | "fieldInLine"
  | "lineBreak"

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
  return null
}

export type BookingTemplate = Wording & {
  message: BookingMessage
  language: TemplateLanguage
  name: string
  // The body in Meta's form ({{1}}…) and which field each number stands for.
  metaBody: string
  fields: BookingField[]
  examples: string[]
}

// Meta's name for a message (lowercase and underscores); the same name in
// each language.
const NAMES: Record<BookingMessage, string> = {
  confirmed: "koblip_book_booking_confirmed",
  reminder: "koblip_book_booking_reminder",
  changed: "koblip_book_booking_changed",
  cancelled: "koblip_book_booking_cancelled",
  ownerNewBooking: "koblip_book_owner_new_booking",
}

// One message as Chat gets it, from the owner's wording or Book's default.
export function bookingTemplate(
  message: BookingMessage,
  language: TemplateLanguage,
  wording: Wording = defaultWording(message, language)
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
    ...wording,
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

// A message's text with sample values, as the customer would read it.
export function withExamples(text: string, language: TemplateLanguage) {
  return text.replace(FIELD, (whole, key: string) =>
    key in EXAMPLES[language] ? EXAMPLES[language][key as BookingField] : whole
  )
}
