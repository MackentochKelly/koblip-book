import type { PageLanguage } from "@/lib/page-language"

// A team member's Google Calendar link page (G5 in
// docs/plans/google-calendar.md), in the visitor's language.
const en = {
  title: "Connect your Google Calendar",
  intro: (business: string) =>
    `Your ${business} bookings go into your calendar, and your busy times can't be booked.`,
  connect: "Connect Google Calendar",
  expired: {
    title: "This link doesn't work anymore",
    text: "Ask for a new link.",
  },
  connected: {
    title: "Google Calendar connected",
    text: "Your bookings will show in your calendar.",
  },
  denied: {
    title: "Not connected",
    text: "Allow the Koblip Book calendar, then open your link again.",
  },
  failed: {
    title: "Couldn't connect",
    text: "Open your link again.",
  },
}

export type TeamCalendarWords = typeof en

const es: TeamCalendarWords = {
  title: "Conecta tu Google Calendar",
  intro: (business: string) =>
    `Tus reservas de ${business} van a tu calendario, y tus horas ocupadas no se pueden reservar.`,
  connect: "Conectar Google Calendar",
  expired: {
    title: "Este enlace ya no funciona",
    text: "Pide un enlace nuevo.",
  },
  connected: {
    title: "Google Calendar conectado",
    text: "Tus reservas aparecerán en tu calendario.",
  },
  denied: {
    title: "No conectado",
    text: "Permite el calendario de Koblip Book y vuelve a abrir tu enlace.",
  },
  failed: {
    title: "No se pudo conectar",
    text: "Vuelve a abrir tu enlace.",
  },
}

export function teamCalendarWordsFor(language: PageLanguage): TeamCalendarWords {
  return language === "es" ? es : en
}
