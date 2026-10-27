import { expect, test } from "vitest"
import { formatPrice } from "./format-price"

test("formats minor units in the business currency", () => {
  expect(formatPrice(4500, "USD")).toBe("$45.00")
  // Intl separates the code from the amount with a non-breaking space.
  expect(formatPrice(123450, "DOP")).toBe("DOP\u00A01,234.50")
})

test("returns Price varies when the price is null", () => {
  expect(formatPrice(null, "USD")).toBe("Price varies")
})
