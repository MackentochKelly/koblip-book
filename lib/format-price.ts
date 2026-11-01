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

// A total in whole units, where room is tight (the dashboard's numbers),
// split into the amount and the currency sign, in the
// locale's own order ("DOP 4,000", "4000 €"), so a big number can draw the
// currency smaller (developer.mozilla.org: Intl.NumberFormat formatToParts). The
// standard symbol, never the narrow one: narrow drops what tells
// currencies apart, so DOP would read as a bare "$".
export function moneyShortParts(
  priceMinor: number,
  currency: string,
  locale = "en-US"
): Array<{ text: string; isCurrency: boolean }> {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })
    .formatToParts(priceMinor / 100)
    .map((part) => ({ text: part.value, isCurrency: part.type === "currency" }))
}
