import currencyData from "cldr-core/supplemental/currencyData.json"

// Unicode CLDR's currencies per region (cldr-json, supplemental
// currencyData): each region's list runs newest first, and a currency still
// in use has no `_to` date; `_tender: "false"` marks fund codes that are not
// money people pay with (unicode.org/reports/tr35/tr35-numbers.html#Supplemental_Currency_Data).
type CurrencyDates = { _from?: string; _to?: string; _tender?: string }
// Each entry has one key; the JSON types list the others as undefined.
const REGIONS: Record<string, Array<Record<string, CurrencyDates | undefined>>> =
  currencyData.supplemental.currencyData.region

const FALLBACK = "USD"

// ISO country code → the currency in use there now (DO → DOP), for new
// businesses. USD when the country is unknown.
export function currencyByCountry(
  countryCode: string | null | undefined
): string {
  const entries = countryCode ? REGIONS[countryCode.toUpperCase()] : undefined
  for (const entry of entries ?? []) {
    const [code, dates] = Object.entries(entry)[0] ?? []
    if (code && dates && !dates._to && dates._tender !== "false") {
      return code
    }
  }
  return FALLBACK
}
