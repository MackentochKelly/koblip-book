export function formatPrice(
  priceMinor: number | null,
  currency: string
): string {
  if (priceMinor === null) {
    return "Price varies"
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(priceMinor / 100)
}
