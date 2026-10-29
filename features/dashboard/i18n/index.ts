import type { PageLanguage } from "@/lib/page-language"
import enBookings from "./en/bookings"
import enCatalog from "./en/catalog"
import enIntegrations from "./en/integrations"
import enSettings from "./en/settings"
import enShell from "./en/shell"
import esBookings from "./es/bookings"
import esCatalog from "./es/catalog"
import esIntegrations from "./es/integrations"
import esSettings from "./es/settings"
import esShell from "./es/shell"

// The owner area's words, one file per area in each language. Spanish is
// typed against English, so a missing word fails the typecheck.
const en = {
  locale: "en-US",
  shell: enShell,
  bookings: enBookings,
  catalog: enCatalog,
  integrations: enIntegrations,
  settings: enSettings,
}

export type OwnerMessages = typeof en

const es: OwnerMessages = {
  locale: "es-US",
  shell: esShell,
  bookings: esBookings,
  catalog: esCatalog,
  integrations: esIntegrations,
  settings: esSettings,
}

const MESSAGES: Record<PageLanguage, OwnerMessages> = { en, es }

export function ownerMessagesFor(language: PageLanguage): OwnerMessages {
  return MESSAGES[language]
}
