import type {
  AutomationButton,
  AutomationLanguage,
  AutomationWording,
} from "../types/automations"
import type { WelcomeWords } from "../utils/automation-defaults"
import type { BookWords } from "../utils/booking-templates"

// Book's English and Spanish WhatsApp words exactly as they were written in
// code before they moved to the app's words (docs/plans/translations.md,
// Decisions, 2026-11-06), captured from that code. Meta approved these
// templates, so they must never change by a byte. Tests only.

export const CAPTURED_BOOK_WORDS: Record<"en" | "es", BookWords> = {
  en: {
    language: "en",
    locale: "en-US",
    wording: {
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
      ownerCantCome: {
        header: "Customer can't come",
        body: "Your customer {name} can't make it to {service} on {date} at {time}. The booking is still on. Phone: {phone}. Open Koblip Book for details.",
        footer: "Reply here to talk to us",
      },
      ownerCancelled: {
        header: "Customer cancelled",
        body: "Your customer {name} cancelled {service} on {date} at {time}, and the time is free again. Phone: {phone}. Open Koblip Book for details.",
        footer: "Reply here to talk to us",
      },
      ownerFailed: {
        header: "Message not sent",
        body: "A WhatsApp message to {name} about {service} on {date} at {time} was not sent. Phone: {phone}. Open Koblip Book to see why.",
        footer: "Reply here to talk to us",
      },
    },
    buttons: {
      confirm: "I'll be there",
      cantCome: "Can't make it",
      ok: "OK",
    },
    examples: {
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
    missing: {
      teamMember: "our team",
      free: "free",
      price: "to be confirmed",
    },
    thankYou: "Thanks, {name}! {business} got your answer.",
  },
  es: {
    language: "es",
    locale: "es-US",
    wording: {
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
      ownerCantCome: {
        header: "El cliente no puede venir",
        body: "Tu cliente {name} no podrá ir a {service} el {date} a las {time}. La reserva sigue en pie. Teléfono: {phone}. Abre Koblip Book para ver más.",
        footer: "Responde aquí para hablar con nosotros",
      },
      ownerCancelled: {
        header: "El cliente canceló",
        body: "Tu cliente {name} canceló {service} el {date} a las {time}, y la hora queda libre. Teléfono: {phone}. Abre Koblip Book para ver más.",
        footer: "Responde aquí para hablar con nosotros",
      },
      ownerFailed: {
        header: "Mensaje no enviado",
        body: "Un mensaje de WhatsApp para {name} sobre {service} el {date} a las {time} no se envió. Teléfono: {phone}. Abre Koblip Book para ver por qué.",
        footer: "Responde aquí para hablar con nosotros",
      },
    },
    buttons: {
      confirm: "Ahí estaré",
      cantCome: "No podré ir",
      ok: "De acuerdo",
    },
    examples: {
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
    missing: {
      teamMember: "nuestro equipo",
      free: "gratis",
      price: "por confirmar",
    },
    thankYou: "¡Gracias, {name}! {business} recibió tu respuesta.",
  },
}

type WelcomeIn = {
  wording: AutomationWording["en"]
  buttons: (Omit<AutomationButton, "label"> & { label: string })[]
}

// The Welcome flow Book stored, in each language.
export const CAPTURED_WELCOME: Record<"en" | "es", WelcomeIn> = {
  en: {
    wording: {
      body: "Thanks for writing to {business}! Choose an option to get help faster.",
      handoffReply: "Got it, someone will answer you soon.",
      servicesIntro: "Choose a service to book.",
    },
    buttons: [
      {
        id: "welcome-booking",
        label: "Book now",
        action: {
          type: "bookingLink",
        },
      },
      {
        id: "welcome-services",
        label: "Our services",
        action: {
          type: "servicesList",
        },
      },
      {
        id: "welcome-handoff",
        label: "Talk to us",
        action: {
          type: "handoff",
        },
      },
    ],
  },
  es: {
    wording: {
      body: "¡Gracias por escribir a {business}! Elige una opción para ayudarte más rápido.",
      handoffReply: "Entendido, alguien te responderá pronto.",
      servicesIntro: "Elige un servicio para reservar.",
    },
    buttons: [
      {
        id: "welcome-booking",
        label: "Reservar",
        action: {
          type: "bookingLink",
        },
      },
      {
        id: "welcome-services",
        label: "Nuestros servicios",
        action: {
          type: "servicesList",
        },
      },
      {
        id: "welcome-handoff",
        label: "Hablar con nosotros",
        action: {
          type: "handoff",
        },
      },
    ],
  },
}

// The same Welcome words, by button action.
export const CAPTURED_WELCOME_WORDS: Record<"en" | "es", WelcomeWords> = {
  en: {
    body: "Thanks for writing to {business}! Choose an option to get help faster.",
    handoffReply: "Got it, someone will answer you soon.",
    servicesIntro: "Choose a service to book.",
    buttons: {
      bookingLink: "Book now",
      servicesList: "Our services",
      handoff: "Talk to us",
    },
  },
  es: {
    body: "¡Gracias por escribir a {business}! Elige una opción para ayudarte más rápido.",
    handoffReply: "Entendido, alguien te responderá pronto.",
    servicesIntro: "Elige un servicio para reservar.",
    buttons: {
      bookingLink: "Reservar",
      servicesList: "Nuestros servicios",
      handoff: "Hablar con nosotros",
    },
  },
}

// Every language's Welcome words before Google's Portuguese and French
// arrive: they read the English, as the app's words do.
export const WELCOME_WORDS: Record<AutomationLanguage, WelcomeWords> = {
  ...CAPTURED_WELCOME_WORDS,
  pt: CAPTURED_WELCOME_WORDS.en,
  fr: CAPTURED_WELCOME_WORDS.en,
}
