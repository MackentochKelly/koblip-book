import { expect, test } from "vitest"
import { currencyByCountry } from "./currency-by-country"

test("the currency in use now, from Unicode CLDR", () => {
  expect(currencyByCountry("DO")).toBe("DOP")
  expect(currencyByCountry("es")).toBe("EUR")
  expect(currencyByCountry("PR")).toBe("USD")
  // Countries the old short list never had.
  expect(currencyByCountry("PE")).toBe("PEN")
  expect(currencyByCountry("JP")).toBe("JPY")
  expect(currencyByCountry("HT")).toBe("HTG")
})

test("skips fund codes that are not money people pay with", () => {
  expect(currencyByCountry("US")).toBe("USD")
  expect(currencyByCountry("MX")).toBe("MXN")
})

test("USD when the country is unknown", () => {
  expect(currencyByCountry(null)).toBe("USD")
  expect(currencyByCountry("ZZ")).toBe("USD")
})
