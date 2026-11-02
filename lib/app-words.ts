import type { PageLanguage } from "@/lib/page-language"

// The apps Koblip Book works with: each one's name and what Koblip does
// with it. One copy for the dashboard's Integrations page and the home
// page's apps.
const en = {
  muse: {
    name: "Muse by Meta",
    description:
      "Meta's AI builds your page from your listing and runs your assistant, by text or voice.",
  },
  googleMaps: {
    name: "Google Maps",
    description:
      "Your page starts from your Google Maps listing: name, address, hours, photos and rating.",
  },
  whatsapp: {
    name: "WhatsApp",
    description:
      "Official WhatsApp Business, straight from Meta. Send booking reminders and broadcasts from your own business number.",
  },
  sms: {
    name: "Twilio SMS",
    description:
      "Booking confirmations and reminders by text message through Twilio, for customers without WhatsApp.",
  },
  email: {
    name: "Email",
    description:
      "Booking confirmations, reminders and changes sent to your customers by email.",
  },
  instagram: {
    name: "Instagram",
    description:
      "A Book button on your Instagram profile, so followers book in a few taps.",
  },
  facebook: {
    name: "Facebook",
    description:
      "A Book button on your Facebook Page, so visitors book without leaving.",
  },
  googleBusiness: {
    name: "Google Business Profile",
    description:
      "A Book button on Google Search and Maps, where customers find you.",
  },
  googleReviews: {
    name: "Google reviews",
    description:
      "After each visit, ask customers for a Google review to win more bookings.",
  },
  googleCalendar: {
    name: "Google Calendar",
    description:
      "Your bookings in your Google Calendar, kept up to date as they change.",
  },
  appleCalendar: {
    name: "Apple Calendar",
    description:
      "Your bookings in Apple Calendar on iPhone, iPad and Mac, kept up to date.",
  },
  outlook: {
    name: "Outlook Calendar",
    description:
      "Your bookings in your Outlook calendar, kept up to date as they change.",
  },
  stripe: {
    name: "Stripe",
    description:
      "Take deposits or full payment when customers book, so fewer skip their visit.",
  },
  metaPixel: {
    name: "Meta Pixel",
    description: "See which Facebook and Instagram ads bring you bookings.",
  },
  googleAnalytics: {
    name: "Google Analytics",
    description: "See who visits your booking page and how many of them book.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "WhatsApp reminders and broadcasts through Koblip Chat, which holds your official Meta connection. Replies arrive in your Koblip Chat inbox.",
  },
}

export type AppWords = typeof en
export type AppKey = keyof AppWords

const es: AppWords = {
  muse: {
    name: "Muse by Meta",
    description:
      "La IA de Meta crea tu página a partir de tu ficha y lleva tu asistente, por texto o voz.",
  },
  googleMaps: {
    name: "Google Maps",
    description:
      "Tu página parte de tu ficha de Google Maps: nombre, dirección, horario, fotos y valoración.",
  },
  whatsapp: {
    name: "WhatsApp",
    description:
      "WhatsApp Business oficial, directo de Meta. Envía recordatorios de reservas y difusiones desde el número de tu negocio.",
  },
  sms: {
    name: "SMS de Twilio",
    description:
      "Confirmaciones y recordatorios de reservas por mensaje de texto con Twilio, para clientes sin WhatsApp.",
  },
  email: {
    name: "Email",
    description:
      "Confirmaciones, recordatorios y cambios de reservas enviados a tus clientes por email.",
  },
  instagram: {
    name: "Instagram",
    description:
      "Un botón Reservar en tu perfil de Instagram, para que tus seguidores reserven en pocos toques.",
  },
  facebook: {
    name: "Facebook",
    description:
      "Un botón Reservar en tu página de Facebook, para que reserven sin salir.",
  },
  googleBusiness: {
    name: "Perfil de Empresa de Google",
    description:
      "Un botón Reservar en la Búsqueda y Maps de Google, donde te encuentran tus clientes.",
  },
  googleReviews: {
    name: "Reseñas de Google",
    description:
      "Después de cada visita, pide a tus clientes una reseña en Google para conseguir más reservas.",
  },
  googleCalendar: {
    name: "Google Calendar",
    description: "Tus reservas en tu Google Calendar, al día con cada cambio.",
  },
  appleCalendar: {
    name: "Apple Calendar",
    description:
      "Tus reservas en Apple Calendar en iPhone, iPad y Mac, siempre al día.",
  },
  outlook: {
    name: "Outlook Calendar",
    description:
      "Tus reservas en tu calendario de Outlook, al día con cada cambio.",
  },
  stripe: {
    name: "Stripe",
    description:
      "Cobra un depósito o el pago completo al reservar, para que menos clientes falten.",
  },
  metaPixel: {
    name: "Meta Pixel",
    description: "Mira qué anuncios de Facebook e Instagram te traen reservas.",
  },
  googleAnalytics: {
    name: "Google Analytics",
    description: "Mira quién visita tu página de reservas y cuántos reservan.",
  },
  koblipChat: {
    name: "Koblip Chat",
    description:
      "Recordatorios y difusiones por WhatsApp con Koblip Chat, que tiene tu conexión oficial con Meta. Las respuestas llegan a tu bandeja de Koblip Chat.",
  },
}

export function appWordsFor(language: PageLanguage): AppWords {
  return language === "es" ? es : en
}
