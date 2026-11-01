export function formatPrice(
  priceMinor: number | null,
  currency: string,
  locale = "en-US"
): string {
  if (priceMinor === null) {
    return "Price varies"
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(priceMinor / 100)
}

// A total in whole units, where room is tight, like the dashboard's
// numbers. The standard symbol, never the narrow one: narrow drops what
// tells currencies apart, so DOP would read as a bare "$" (en-US:
// "DOP 4,000", es-DO: "RD$4,000", "$4,000" only for USD).
export function formatMoneyShort(
  priceMinor: number,
  currency: string,
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(priceMinor / 100)
}
