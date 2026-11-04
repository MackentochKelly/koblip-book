import type { PageLanguage } from "@/lib/page-language"

export const OWNER_LANGUAGE_MAX_AGE = 60 * 60 * 24 * 365

// Each language named in itself, as Airbnb and Booking.com do.
export const LANGUAGE_NAMES: Record<PageLanguage, string> = {
  en: "English",
  es: "Español",
}
