import { expect, test } from "vitest"
import { POLICY_PAYMENT_STATES } from "@/lib/payment-rules"
import { payingFact } from "./paying-fact"

test("every way of paying says the page takes no payment", () => {
  for (const state of POLICY_PAYMENT_STATES) {
    expect(payingFact(state)).toMatch(/never takes a payment/)
  }
})

test("only a business with ways to pay is told about paying ahead", () => {
  expect(payingFact("visit")).not.toMatch(/ahead|ways the business shows/)
  expect(payingFact("direct_or_visit")).toMatch(/or at their visit/)
  expect(payingFact("direct")).toMatch(/at the visit is not offered/)
})
