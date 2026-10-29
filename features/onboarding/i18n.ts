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
    "Search your business name",
    "Lumen Studio",
    "Your salon, clinic or shop",
  ],
  clear: "Clear",
  noneFound: "No business found",
  mapsLink: "Google Maps link",
  continue: "Continue",
  area: {
    title: "Search near",
    useLocation: "Use my location",
    city: "City",
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
    "Busca el nombre de tu negocio",
    "Lumen Studio",
    "Tu salón, clínica o tienda",
  ],
  clear: "Borrar",
  noneFound: "No se encontró ningún negocio",
  mapsLink: "Enlace de Google Maps",
  continue: "Continuar",
  area: {
    title: "Buscar cerca de",
    useLocation: "Usar mi ubicación",
    city: "Ciudad",
  },
}

const WORDS: Record<PageLanguage, OnboardingWords> = { en, es }

export function onboardingWordsFor(language: PageLanguage): OnboardingWords {
  return WORDS[language]
}
