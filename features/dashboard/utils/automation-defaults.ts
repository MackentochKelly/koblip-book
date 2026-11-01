import type { AutomationButton, AutomationWording } from "../types/automations"

// New businesses store these words once; later reads keep their saved choices.
export function welcomeDefaults(): {
  wording: AutomationWording
  buttons: AutomationButton[]
} {
  return {
    wording: {
      en: {
        body: "Thanks for writing to {business}! Choose an option to get help faster.",
        handoffReply: "Got it, someone will answer you soon.",
        servicesIntro: "Choose a service to book.",
      },
      es: {
        body: "¡Gracias por escribir a {business}! Elige una opción para ayudarte más rápido.",
        handoffReply: "Entendido, alguien te responderá pronto.",
        servicesIntro: "Elige un servicio para reservar.",
      },
    },
    buttons: [
      { id: "welcome-booking", label: { en: "Book now", es: "Reservar" }, action: { type: "bookingLink" } },
      { id: "welcome-services", label: { en: "Our services", es: "Nuestros servicios" }, action: { type: "servicesList" } },
      { id: "welcome-handoff", label: { en: "Talk to us", es: "Hablar con nosotros" }, action: { type: "handoff" } },
    ],
  }
}
