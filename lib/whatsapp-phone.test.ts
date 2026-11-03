import { expect, test } from "vitest"

import { whatsappCustomerKeys, whatsappDigits } from "./whatsapp-phone"

const dominican = { phone: null, timezone: "America/Santo_Domingo" }
const madrid = { phone: "+34 912 34 56 78", timezone: "Europe/Madrid" }

test("adds the business's country code to a number typed at home", () => {
  expect(whatsappDigits("(809) 555-0101", dominican)).toBe("18095550101")
  expect(whatsappDigits("612 34 56 78", madrid)).toBe("34612345678")
})

test("keeps a number that already has its country code", () => {
  expect(whatsappDigits("+1 809 555 0101", madrid)).toBe("18095550101")
  expect(whatsappDigits("18095550101", dominican)).toBe("18095550101")
  expect(whatsappDigits("34612345678", madrid)).toBe("34612345678")
})

test("a number that can't be read stays as typed", () => {
  expect(whatsappDigits("12-34", dominican)).toBe("1234")
})

test("finds a customer saved with or without the country code", () => {
  expect(whatsappCustomerKeys("18095550101")).toEqual(["p:18095550101", "p:8095550101"])
})
