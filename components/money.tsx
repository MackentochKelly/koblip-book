import { moneyShortParts } from "@/lib/format-price"

// A big money number with its currency sign drawn smaller, so the amount
// reads first ("DOP 4,000", "4000 €"). Inherits the number's own size.
export function Money({
  priceMinor,
  currency,
  locale,
}: {
  priceMinor: number
  currency: string
  locale: string
}) {
  return (
    <span>
      {moneyShortParts(priceMinor, currency, locale).map((part, index) =>
        part.isCurrency ? (
          <span key={index} className="text-xl font-medium">
            {part.text}
          </span>
        ) : (
          part.text
        )
      )}
    </span>
  )
}
