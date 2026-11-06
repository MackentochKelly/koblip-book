import { getCountriesForTimezone } from "countries-and-timezones"
import { getCountries, type CountryCode } from "libphonenumber-js"

// Used only when the browser gives no clue at all.
export const FALLBACK_COUNTRY: CountryCode = "US"

const known = (code: string | undefined): CountryCode | undefined =>
  getCountries().find((country) => country === code)

// Where the person seems to be, with no location popup: the browser's time
// zone, then the region in its language.
export function detectCountry(): CountryCode {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const fromZone = known(getCountriesForTimezone(zone)[0]?.id)
  if (fromZone) return fromZone
  try {
    return known(new Intl.Locale(navigator.language).region) ?? FALLBACK_COUNTRY
  } catch {
    return FALLBACK_COUNTRY
  }
}
