import type { PageLanguage } from "@/lib/page-language"

// The owner's pick, remembered on this device for a year. Without one, the
// phone's language (Accept-Language), else English.
export const OWNER_LANGUAGE_COOKIE = "owner-lang"
export const OWNER_LANGUAGE_MAX_AGE = 60 * 60 * 24 * 365

// Each language named in itself, as Airbnb and Booking.com do.
export const LANGUAGE_NAMES: Record<PageLanguage, string> = {
  en: "English",
  es: "Español",
}
