import { expect, test } from "vitest"
import { formatPrice, moneyShortParts } from "./format-price"

test("formats minor units in the business currency", () => {
  expect(formatPrice(4500, "USD")).toBe("$45.00")
  // Intl separates the code from the amount with a non-breaking space.
  expect(formatPrice(123450, "DOP")).toBe("DOP\u00A01,234.50")
})

test("returns Price varies when the price is null", () => {
  expect(formatPrice(null, "USD")).toBe("Price varies")
})

const currencyOf = (parts: ReturnType<typeof moneyShortParts>) =>
  parts.filter((part) => part.isCurrency).map((part) => part.text).join("")
const textOf = (parts: ReturnType<typeof moneyShortParts>) =>
  parts.map((part) => part.text).join("")

test("splits the currency sign from the amount, in the locale's order", () => {
  const dop = moneyShortParts(400000, "DOP", "es-US")
  expect(currencyOf(dop)).toBe("DOP")
  expect(textOf(dop).replace(/\s/g, " ")).toBe("DOP 4,000")
  const eur = moneyShortParts(18500, "EUR", "es-ES")
  expect(currencyOf(eur)).toBe("€")
  expect(textOf(eur).replace(/\s/g, " ")).toBe("185 €")
  expect(textOf(moneyShortParts(150000, "USD", "en-US"))).toBe("$1,500")
})
