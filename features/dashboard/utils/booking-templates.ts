// Book's WhatsApp booking messages, as Meta templates (Utility) in English and
// Spanish (docs/koblip-chat-integration.md, step 2). Book creates them in each
// business's Koblip Chat; inside the 24-hour window the same words go as
// plain text. Variables are Meta's positional {{1}}…{{5}}.

export type BookingMessage =
  | "confirmed"
  | "reminder"
  | "changed"
  | "cancelled"
  | "ownerNewBooking"

export type TemplateLanguage = "en" | "es"

export const BOOKING_MESSAGES: readonly BookingMessage[] = [
  "confirmed",
  "reminder",
  "changed",
  "cancelled",
  "ownerNewBooking",
]

export const TEMPLATE_LANGUAGES: readonly TemplateLanguage[] = ["en", "es"]

type Words = { header: string; body: string; footer: string }

// The customer messages: {{1}} name, {{2}} service, {{3}} business, {{4}}
// date, {{5}} time. The owner's: {{1}} name, {{2}} service, {{3}} date,
// {{4}} time, {{5}} phone.
const WORDS: Record<TemplateLanguage, Record<BookingMessage, Words>> = {
  en: {
    confirmed: {
      header: "Booking confirmed",
      body: "Hi {{1}}, your {{2}} at {{3}} is booked for {{4}} at {{5}}. See you then!",
      footer: "Reply here to talk to us",
    },
    reminder: {
      header: "Appointment reminder",
      body: "Hi {{1}}, a reminder of your {{2}} at {{3}} on {{4}} at {{5}}. See you soon!",
      footer: "Reply here to talk to us",
    },
    changed: {
      header: "Booking changed",
      body: "Hi {{1}}, your {{2}} at {{3}} is now on {{4}} at {{5}}. See you then!",
      footer: "Reply here to talk to us",
    },
    cancelled: {
      header: "Booking cancelled",
      body: "Hi {{1}}, your {{2}} at {{3}} on {{4}} at {{5}} has been cancelled. We hope to see you soon.",
      footer: "Reply here to talk to us",
    },
    ownerNewBooking: {
      header: "New booking",
      body: "New booking from {{1}}: {{2}} on {{3}} at {{4}}. Phone: {{5}}. Open Koblip Book for details.",
      footer: "Reply here to talk to us",
    },
  },
  es: {
    confirmed: {
      header: "Reserva confirmada",
      body: "Hola {{1}}, tu {{2}} en {{3}} está reservado para el {{4}} a las {{5}}. ¡Te esperamos!",
      footer: "Responde aquí para hablar con nosotros",
    },
    reminder: {
      header: "Recordatorio de cita",
      body: "Hola {{1}}, te recordamos tu {{2}} en {{3}} el {{4}} a las {{5}}. ¡Hasta pronto!",
      footer: "Responde aquí para hablar con nosotros",
    },
    changed: {
      header: "Reserva cambiada",
      body: "Hola {{1}}, tu {{2}} en {{3}} ahora es el {{4}} a las {{5}}. ¡Te esperamos!",
      footer: "Responde aquí para hablar con nosotros",
    },
    cancelled: {
      header: "Reserva cancelada",
      body: "Hola {{1}}, tu {{2}} en {{3}} el {{4}} a las {{5}} fue cancelado. Esperamos verte pronto.",
      footer: "Responde aquí para hablar con nosotros",
    },
    ownerNewBooking: {
      header: "Nueva reserva",
      body: "Nueva reserva de {{1}}: {{2}} el {{3}} a las {{4}}. Teléfono: {{5}}. Abre Koblip Book para ver más.",
      footer: "Responde aquí para hablar con nosotros",
    },
  },
}

// Meta reviews each template with sample values for its variables.
const EXAMPLES: Record<TemplateLanguage, Record<"customer" | "owner", string[]>> = {
  en: {
    customer: ["Alex", "Haircut", "Lumen Studio", "Friday, May 8", "3:30 PM"],
    owner: ["Alex", "Haircut", "Friday, May 8", "3:30 PM", "+1 555 123 4567"],
  },
  es: {
    customer: ["Ana", "Corte de pelo", "Lumen Studio", "viernes 8 de mayo", "15:30"],
    owner: ["Ana", "Corte de pelo", "viernes 8 de mayo", "15:30", "+34 600 123 456"],
  },
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

export type BookingTemplate = Words & {
  message: BookingMessage
  language: TemplateLanguage
  name: string
  examples: string[]
}

export function bookingTemplate(
  message: BookingMessage,
  language: TemplateLanguage
): BookingTemplate {
  return {
    message,
    language,
    name: NAMES[message],
    ...WORDS[language][message],
    examples: EXAMPLES[language][message === "ownerNewBooking" ? "owner" : "customer"],
  }
}

// Every template a business needs: each message in each language.
export function bookingTemplates(): BookingTemplate[] {
  return TEMPLATE_LANGUAGES.flatMap((language) =>
    BOOKING_MESSAGES.map((message) => bookingTemplate(message, language))
  )
}
