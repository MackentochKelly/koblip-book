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

// A total in whole units with the short symbol ("$4,000"), where room is
// tight, like the dashboard's numbers.
export function formatMoneyShort(
  priceMinor: number,
  currency: string,
  locale = "en-US"
): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: 0,
  }).format(priceMinor / 100)
}
