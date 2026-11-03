import { getCountriesForTimezone, type CountryCode as TimezoneCountry } from "countries-and-timezones"
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js"

type Business = { phone: string | null; timezone: string }

// The business's country: from its own phone when that's international,
// else from its time zone.
function countryOf({ phone, timezone }: Business): CountryCode | undefined {
  const own = phone ? parsePhoneNumberFromString(phone)?.country : undefined
  const zone: TimezoneCountry | undefined = getCountriesForTimezone(timezone)[0]?.id
  return own ?? (zone as CountryCode | undefined)
}

// People type their number the way they say it at home, but WhatsApp knows
// it with its country code: 809 555 0101 is 18095550101 for a business in
// the Dominican Republic. A number that can't be read stays as typed.
export function whatsappDigits(raw: string, business: Business): string {
  const digits = raw.replace(/\D/g, "")
  const parsed = [
    parsePhoneNumberFromString(raw, { defaultCountry: countryOf(business) }),
    parsePhoneNumberFromString(`+${digits}`),
  ].find((number) => number?.isValid())
  return parsed ? parsed.number.slice(1) : digits
}

// The customer keys a WhatsApp number may be saved under: with its country
// code, and as typed at home.
export function whatsappCustomerKeys(digits: string): string[] {
  const national = parsePhoneNumberFromString(`+${digits}`)?.nationalNumber
  return [`p:${digits}`, ...(national && national !== digits ? [`p:${national}`] : [])]
}

// The whole number to save, for a number that came in without its country
// (an old form, the assistant): +18095550101.
export function internationalPhone(raw: string, business: Business): string {
  return `+${whatsappDigits(raw, business)}`
}
