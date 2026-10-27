// ISO country code → the currency used for new businesses there.
export const CURRENCY_BY_COUNTRY: Record<string, string> = {
  DO: "DOP",
  US: "USD",
  CA: "CAD",
  MX: "MXN",
  ES: "EUR",
  FR: "EUR",
  GB: "GBP",
  CO: "COP",
  PR: "USD",
}

export function currencyByCountry(
  countryCode: string | null | undefined
): string {
  if (!countryCode) {
    return "USD"
  }
  return CURRENCY_BY_COUNTRY[countryCode.toUpperCase()] ?? "USD"
}
