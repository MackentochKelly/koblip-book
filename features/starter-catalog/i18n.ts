import type { PageLanguage } from "@/lib/page-language"

// The "getting your page ready" screen's words. The page passes the owner
// area's language.
const en = {
  title: "Getting your page ready",
  helper: "Muse is adding what your customers can book",
  steps: {
    services: "Services",
    extras: "Extras",
    prices: "Prices",
    team: "Team",
    photos: "Team photos",
    spanish: "Spanish version",
  },
  // "Haircut, Beard trim +3"
  more: (count: number) => `+${count}`,
  from: (price: string) => `From ${price}`,
  photosDone: (done: number, total: number) => `${done} of ${total}`,
  spanishDone: "Ready for Spanish speakers",
  working: "Working on it",
  done: "Done",
  waiting: "Next",
}

export type StarterMessages = typeof en

const es: StarterMessages = {
  title: "Preparando tu página",
  helper: "Muse está añadiendo lo que tus clientes pueden reservar",
  steps: {
    services: "Servicios",
    extras: "Extras",
    prices: "Precios",
    team: "Equipo",
    photos: "Fotos del equipo",
    spanish: "Versión en español",
  },
  more: (count) => `+${count}`,
  from: (price) => `Desde ${price}`,
  photosDone: (done, total) => `${done} de ${total}`,
  spanishDone: "Lista para clientes en español",
  working: "Trabajando",
  done: "Listo",
  waiting: "Siguiente",
}

export function starterMessagesFor(language: PageLanguage): StarterMessages {
  return language === "es" ? es : en
}
