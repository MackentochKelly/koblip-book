import { moneyShortParts } from "@/lib/format-price"

// A big money number: the amount first, then the currency sign small at its
// top right, in every language ("4,000 DOP", "185 €"). Inherits the
// number's own size.
export function Money({
  priceMinor,
  currency,
  locale,
}: {
  priceMinor: number
  currency: string
  locale: string
}) {
  const parts = moneyShortParts(priceMinor, currency, locale)
  const amount = parts
    .filter((part) => !part.isCurrency)
    .map((part) => part.text)
    .join("")
    .trim()
  const sign = parts.find((part) => part.isCurrency)?.text
  return (
    <span>
      {amount}
      {sign && (
        <span className="ml-1 align-top text-sm font-medium">{sign}</span>
      )}
    </span>
  )
}
