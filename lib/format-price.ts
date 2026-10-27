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
