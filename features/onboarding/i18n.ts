import type { PageLanguage } from "@/lib/page-language"

// The "find your business" box's words. The page passes its language: the
// visitor's on the home page, the owner area's on the dashboard.
const en = {
  modes: {
    label: "How to find your business",
    search: "Search",
    link: "Maps link",
  },
  errors: {
    invalid: "Paste a Google Maps link",
    not_found: "That business was not found on Google Maps",
    failed: "That did not work. Please try again.",
  },
  hint: "Free to try, no card needed",
  building: "Building your page…",
  searchAgain: "Search again",
  notYours: "Not your business?",
  nearMe: "Near me",
  anywhere: "Anywhere",
  closeSearch: "Close search",
  businessName: "Your business name",
  // Typed one after another in the empty search box, then businessName.
  businessNameExamples: [
    "Search your business",
    "Lumen Studio",
    "Your salon, clinic or shop",
  ],
  clear: "Clear",
  noneFound: "No business found",
  mapsLink: "Google Maps link",
  continue: "Continue",
  area: {
    title: "Search near",
    helper: "Find businesses close to you",
    useLocation: "Use my current location",
    notFound: "Couldn't find you. Try again or pick a city.",
    waiting: "Taking longer than expected. You can pick a city.",
    timeout: "Location timed out. Try again or pick a city.",
    turnOnLocation:
      "Turn on location for this browser in your device settings and reload, or pick a city.",
    locationOff:
      "Location is off. Turn it on in your browser and device settings and reload, or pick a city.",
    or: "or pick a city",
    city: "Search a city",
  },
  // Right after sign-up: the page's details from Google Maps, row by row.
  found: {
    title: "Your Google Maps details",
    helper: "What we took from your listing",
    steps: {
      name: "Name",
      category: "Category",
      address: "Address",
      phone: "Phone",
      hours: "Opening hours",
      photos: "Photos",
      rating: "Rating",
      about: "About",
    },
    openDays: (days: number) => (days === 7 ? "Open every day" : `Open ${days} days a week`),
    photoCount: (count: number) => `${count} photos`,
    rating: (rating: number, reviews: number) => `${rating.toFixed(1)} · ${reviews} reviews`,
    aboutByMuse: "Written by Muse",
    working: "Loading",
    done: "Done",
    waiting: "Next",
  },
}

export type OnboardingWords = typeof en

const es: OnboardingWords = {
  modes: {
    label: "Cómo encontrar tu negocio",
    search: "Buscar",
    link: "Enlace de Maps",
  },
  errors: {
    invalid: "Pega un enlace de Google Maps",
    not_found: "No encontramos ese negocio en Google Maps",
    failed: "No funcionó. Inténtalo de nuevo.",
  },
  hint: "Pruébalo gratis, sin tarjeta",
  building: "Creando tu página…",
  searchAgain: "Buscar de nuevo",
  notYours: "¿No es tu negocio?",
  nearMe: "Cerca de mí",
  anywhere: "En cualquier lugar",
  closeSearch: "Cerrar búsqueda",
  businessName: "Nombre de tu negocio",
  businessNameExamples: [
    "Busca tu negocio",
    "Lumen Studio",
    "Tu salón, clínica o tienda",
  ],
  clear: "Borrar",
  noneFound: "No se encontró ningún negocio",
  mapsLink: "Enlace de Google Maps",
  continue: "Continuar",
  area: {
    title: "Buscar cerca de",
    helper: "Encuentra negocios cerca de ti",
    useLocation: "Usar mi ubicación actual",
    notFound: "No te encontramos. Inténtalo de nuevo o elige una ciudad.",
    waiting: "Está tardando más de lo esperado. Puedes elegir una ciudad.",
    timeout: "Se agotó el tiempo. Inténtalo de nuevo o elige una ciudad.",
    turnOnLocation:
      "Activa la ubicación del navegador en los ajustes del dispositivo y recarga, o elige una ciudad.",
    locationOff:
      "Ubicación desactivada. Actívala en los ajustes del navegador y del dispositivo y recarga, o elige una ciudad.",
    or: "o elige una ciudad",
    city: "Busca una ciudad",
  },
  found: {
    title: "Tus datos de Google Maps",
    helper: "Lo que tomamos de tu ficha",
    steps: {
      name: "Nombre",
      category: "Categoría",
      address: "Dirección",
      phone: "Teléfono",
      hours: "Horario",
      photos: "Fotos",
      rating: "Valoración",
      about: "Descripción",
    },
    openDays: (days) => (days === 7 ? "Abierto todos los días" : `Abierto ${days} días a la semana`),
    photoCount: (count) => `${count} fotos`,
    rating: (rating, reviews) => `${rating.toFixed(1)} · ${reviews} reseñas`,
    aboutByMuse: "Escrita por Muse",
    working: "Cargando",
    done: "Listo",
    waiting: "Siguiente",
  },
}

const WORDS: Record<PageLanguage, OnboardingWords> = { en, es }

export function onboardingWordsFor(language: PageLanguage): OnboardingWords {
  return WORDS[language]
}
