import { expect, test } from "vitest"

import {
  canReportPayment,
  cardAmount,
  CARD_METHOD,
  checkOnlinePay,
  checkPaymentMethod,
  fromStripeAmount,
  leftToPay,
  onlinePayOf,
  paidInFullOnline,
  smallestCharge,
  stripeAmount,
  checkPaymentReference,
  paymentOf,
  paymentOptions,
  paymentSlots,
  policiesBehind,
  policyPaymentState,
  withRemovedType,
  PAYMENT_RULES,
  PAYMENT_START_NAMES,
  startPayment,
  type PaymentMethod,
  type PaymentType,
} from "./payment-rules"

const zelle: PaymentMethod = {
  id: "m1",
  type: "zelle",
  name: "Zelle",
  details: "pay@lumen.example",
}
const bank: PaymentMethod = {
  id: "m2",
  type: "bank_transfer",
  name: "Banco Popular",
  details: "Account 123-456",
}

test("a business with no way to pay has no payment step and tracks nothing", () => {
  expect(paymentOptions([], true, true)).toBeNull()
  expect(startPayment([], true, { choice: "now", methodId: "m1" })).toEqual({
    ok: true,
    payment: null,
  })
  expect(startPayment([], true, undefined)).toEqual({ ok: true, payment: null })
})

test("the booking page gets the ways' names, never their details", () => {
  const options = paymentOptions([zelle, bank], false, true)
  expect(options).toEqual({
    methods: [
      { id: "m1", type: "zelle", name: "Zelle" },
      { id: "m2", type: "bank_transfer", name: "Banco Popular" },
    ],
    card: null,
    payLater: false,
    asksProof: true,
  })
  expect(JSON.stringify(options)).not.toContain("pay@lumen.example")
  expect(JSON.stringify(options)).not.toContain("123-456")
})

test("choosing a way starts unpaid and keeps the way as it was", () => {
  const result = startPayment([zelle, bank], true, { choice: "now", methodId: "m2" })
  expect(result).toEqual({
    ok: true,
    payment: {
      choice: "now",
      method: { type: "bank_transfer", name: "Banco Popular", details: "Account 123-456" },
      status: "unpaid",
      reference: null,
      hasProof: false,
      online: null,
    },
  })
})

test("a customer cannot start a booking as paid or reported", () => {
  const result = startPayment([zelle], true, {
    choice: "now",
    methodId: "m1",
    status: "paid",
    reference: "abc",
  })
  expect(result.ok && result.payment?.status).toBe("unpaid")
  expect(result.ok && result.payment?.reference).toBeNull()
})

test("paying later only where the business allows it", () => {
  expect(startPayment([zelle], true, { choice: "later" })).toEqual({
    ok: true,
    payment: { choice: "later", method: null, status: "unpaid", reference: null, hasProof: false, online: null },
  })
  expect(startPayment([zelle], false, { choice: "later" })).toEqual({ ok: false })
})

test("with ways to pay, a booking must pick one of this business's", () => {
  expect(startPayment([zelle], true, undefined)).toEqual({ ok: false })
  expect(startPayment([zelle], true, { choice: "now" })).toEqual({ ok: false })
  expect(startPayment([zelle], true, { choice: "now", methodId: "m2" })).toEqual({ ok: false })
  expect(startPayment([zelle], true, { choice: "free" })).toEqual({ ok: false })
})

test("a way needs a known type, a name and where to send the money", () => {
  expect(checkPaymentMethod({ type: "zelle", name: " Zelle ", details: " a@b.co " })).toEqual({
    ok: true,
    values: { type: "zelle", name: "Zelle", details: "a@b.co" },
  })
  expect(checkPaymentMethod({ type: "card", name: "x", details: "y" })).toEqual({ ok: false, error: "type" })
  expect(checkPaymentMethod({ type: "other", name: " ", details: "y" })).toEqual({ ok: false, error: "name" })
  expect(checkPaymentMethod({ type: "other", name: "x", details: "" })).toEqual({ ok: false, error: "details" })
  expect(
    checkPaymentMethod({ type: "other", name: "x", details: "d".repeat(PAYMENT_RULES.maxDetails + 1) })
  ).toEqual({ ok: false, error: "details" })
  expect(checkPaymentMethod(null)).toEqual({ ok: false, error: "type" })
})

test("a booking with no payment columns tracks none", () => {
  expect(
    paymentOf({ paymentChoice: null, paymentMethod: null, paymentStatus: null, paymentReference: null })
  ).toBeNull()
})

test("only an unpaid pay-now booking can be reported as paid", () => {
  const now = { choice: "now" as const, method: { type: "zelle" as const, name: "Zelle", details: "x" }, reference: null, hasProof: false, online: null }
  expect(canReportPayment({ ...now, status: "unpaid" })).toBe(true)
  expect(canReportPayment({ ...now, status: "reported" })).toBe(false)
  expect(canReportPayment({ ...now, status: "paid" })).toBe(false)
  expect(canReportPayment({ choice: "later", method: null, status: "unpaid", reference: null, hasProof: false, online: null })).toBe(false)
  expect(canReportPayment(null)).toBe(false)
})

test("a reference is trimmed, optional and short", () => {
  expect(checkPaymentReference(" TX-9 ")).toBe("TX-9")
  expect(checkPaymentReference("")).toBeNull()
  expect(checkPaymentReference(undefined)).toBeNull()
  expect(checkPaymentReference(12)).toBeUndefined()
  expect(checkPaymentReference("r".repeat(PAYMENT_RULES.maxReference + 1))).toBeUndefined()
})

test("every business is offered a bank transfer, Zelle and Cash App, none of them on", () => {
  // Nothing set up: the three standard ways, each waiting.
  expect(paymentSlots([])).toEqual({
    standard: [
      { type: "bank_transfer", method: null },
      { type: "zelle", method: null },
      { type: "cash_app", method: null },
    ],
    more: [],
  })
  // Offering them changes nothing for customers: still no payment step.
  expect(paymentOptions([], true, true)).toBeNull()
})

test("a way the owner set up takes its standard place; the rest follow in order", () => {
  const paypal: PaymentMethod = { id: "m3", type: "other", name: "PayPal", details: "me@x" }
  const secondBank: PaymentMethod = { ...bank, id: "m4", name: "BHD" }
  expect(paymentSlots([paypal, zelle, bank, secondBank])).toEqual({
    standard: [
      { type: "bank_transfer", method: bank },
      { type: "zelle", method: zelle },
      { type: "cash_app", method: null },
    ],
    more: [paypal, secondBank],
  })
})

test("Cash App is a way of its own, named by its brand", () => {
  expect(
    checkPaymentMethod({
      type: "cash_app",
      name: PAYMENT_START_NAMES.cash_app,
      details: " $lumen ",
    })
  ).toEqual({
    ok: true,
    values: { type: "cash_app", name: "Cash App", details: "$lumen" },
  })
  expect(PAYMENT_START_NAMES).toMatchObject({ zelle: "Zelle", bank_transfer: "" })
})

test("a removed standard way leaves the list, until one of its kind is added", () => {
  const types = (methods: { type: PaymentType }[], removed: PaymentType[]) =>
    paymentSlots(methods, removed).standard.map((slot) => slot.type)
  expect(types([], ["zelle"])).toEqual(["bank_transfer", "cash_app"])
  expect(types([], ["bank_transfer", "zelle", "cash_app"])).toEqual([])
  expect(types([{ type: "zelle" }], ["zelle"])).toEqual([
    "bank_transfer",
    "zelle",
    "cash_app",
  ])
})

test("only a standard way joins the removed list, once", () => {
  expect(withRemovedType([], "zelle")).toEqual(["zelle"])
  expect(withRemovedType(["zelle"], "zelle")).toEqual(["zelle"])
  expect(withRemovedType(["zelle"], "other")).toEqual(["zelle"])
})

test("what the policies must say follows the ways to pay", () => {
  expect(policyPaymentState(0, true)).toBe("visit")
  expect(policyPaymentState(0, false)).toBe("visit")
  expect(policyPaymentState(2, true)).toBe("direct_or_visit")
  expect(policyPaymentState(1, false)).toBe("direct")
})

test("policies fall behind when the ways to pay move on", () => {
  // Policies from before this was recorded said "pay at the business".
  expect(policiesBehind(null, "visit")).toBe(false)
  expect(policiesBehind(null, "direct_or_visit")).toBe(true)
  expect(policiesBehind("direct_or_visit", "direct_or_visit")).toBe(false)
  expect(policiesBehind("direct_or_visit", "direct")).toBe(true)
})

// Paying online (docs/plans/online-payments.md).

test("a business that takes cards has a pay step with no other way", () => {
  expect(paymentOptions([], true, true)).toBeNull()
  expect(paymentOptions([], false, true, { mode: "full" })).toEqual({
    methods: [],
    card: { mode: "full" },
    payLater: false,
    asksProof: true,
  })
})

test("card is a choice only where the business takes it, and starts unpaid", () => {
  expect(startPayment([zelle], true, { choice: "card" })).toEqual({ ok: false })
  expect(startPayment([], true, { choice: "card" }, true)).toEqual({
    ok: true,
    payment: {
      choice: "now",
      method: CARD_METHOD,
      status: "unpaid",
      reference: null,
      hasProof: false,
      online: null,
    },
  })
  // Card as the only way and no paying at the visit: nothing else passes.
  expect(startPayment([], false, { choice: "later" }, true)).toEqual({
    ok: false,
  })
})

test("a card payment is never reported by hand", () => {
  const started = startPayment([], true, { choice: "card" }, true)
  expect(started.ok && canReportPayment(started.payment)).toBe(false)
})

test("the card setting reads from its columns", () => {
  expect(
    onlinePayOf({ onlinePay: "off", depositType: "percent", depositValue: 20 })
  ).toBeNull()
  expect(
    onlinePayOf({ onlinePay: "full", depositType: null, depositValue: null })
  ).toEqual({ mode: "full" })
  expect(
    onlinePayOf({ onlinePay: "deposit", depositType: "percent", depositValue: 20 })
  ).toEqual({ mode: "deposit", type: "percent", value: 20 })
  // A deposit never finished is off.
  expect(
    onlinePayOf({ onlinePay: "deposit", depositType: null, depositValue: null })
  ).toBeNull()
})

test("the card is charged the full price or the deposit", () => {
  expect(cardAmount({ mode: "full" }, 4000, "USD")).toBe(4000)
  expect(
    cardAmount({ mode: "deposit", type: "percent", value: 25 }, 4000, "USD")
  ).toBe(1000)
  expect(
    cardAmount({ mode: "deposit", type: "amount", value: 1500 }, 4000, "USD")
  ).toBe(1500)
  // Never more than the price.
  expect(
    cardAmount({ mode: "deposit", type: "amount", value: 5000 }, 4000, "USD")
  ).toBe(4000)
  // Never under Stripe's smallest charge.
  expect(
    cardAmount({ mode: "deposit", type: "percent", value: 1 }, 4000, "USD")
  ).toBe(50)
  // Free, or cheaper than the smallest charge: no card.
  expect(cardAmount({ mode: "full" }, 0, "USD")).toBeNull()
  expect(cardAmount({ mode: "full" }, 40, "USD")).toBeNull()
})

test("a currency with no cents is charged in whole units", () => {
  // 3,333 yen at 10% is 333.3: 333 yen.
  expect(
    cardAmount({ mode: "deposit", type: "percent", value: 10 }, 333300, "JPY")
  ).toBe(33300)
  expect(stripeAmount(33300, "JPY")).toBe(333)
  expect(fromStripeAmount(333, "jpy")).toBe(33300)
  expect(stripeAmount(1099, "USD")).toBe(1099)
  expect(fromStripeAmount(1099, "usd")).toBe(1099)
  // Iceland: whole krónur, still sent with two zeros.
  expect(stripeAmount(50049, "ISK")).toBe(50000)
  expect(smallestCharge("JPY")).toBe(5000)
  expect(smallestCharge("MXN")).toBe(1000)
})

test("the owner's card setting is checked", () => {
  expect(checkOnlinePay({ mode: "off" }, "USD")).toEqual({ ok: true, pay: null })
  expect(checkOnlinePay({ mode: "full" }, "USD")).toEqual({
    ok: true,
    pay: { mode: "full" },
  })
  expect(
    checkOnlinePay({ mode: "deposit", type: "percent", value: 20 }, "USD")
  ).toEqual({ ok: true, pay: { mode: "deposit", type: "percent", value: 20 } })
  for (const value of [0, 100, 12.5, "20"])
    expect(
      checkOnlinePay({ mode: "deposit", type: "percent", value }, "USD")
    ).toEqual({ ok: false, error: "percent" })
  // A deposit under Stripe's smallest charge is refused.
  expect(
    checkOnlinePay({ mode: "deposit", type: "amount", value: 49 }, "USD")
  ).toEqual({ ok: false, error: "amount" })
  expect(
    checkOnlinePay({ mode: "deposit", type: "amount", value: 500 }, "MXN")
  ).toEqual({ ok: false, error: "amount" })
  expect(
    checkOnlinePay({ mode: "deposit", type: "amount", value: 150050 }, "JPY")
  ).toEqual({ ok: false, error: "amount" })
  expect(
    checkOnlinePay({ mode: "deposit", type: "amount", value: 1000 }, "USD")
  ).toEqual({ ok: true, pay: { mode: "deposit", type: "amount", value: 1000 } })
  expect(checkOnlinePay({ mode: "weekly" }, "USD")).toEqual({
    ok: false,
    error: "mode",
  })
  expect(checkOnlinePay({ mode: "deposit", value: 10 }, "USD")).toEqual({
    ok: false,
    error: "type",
  })
})

test("what is left to pay at the visit", () => {
  expect(leftToPay(4000, null)).toBe(4000)
  expect(leftToPay(4000, { paidMinor: 1000, refundedMinor: 0 })).toBe(3000)
  expect(leftToPay(4000, { paidMinor: 4000, refundedMinor: 0 })).toBe(0)
  expect(leftToPay(4000, { paidMinor: 1000, refundedMinor: 1000 })).toBe(4000)
  expect(leftToPay(null, null)).toBeNull()
  expect(paidInFullOnline(4000, { paidMinor: 4000, refundedMinor: 0 })).toBe(true)
  expect(paidInFullOnline(4000, { paidMinor: 1000, refundedMinor: 0 })).toBe(false)
  expect(paidInFullOnline(4000, { paidMinor: 4000, refundedMinor: 4000 })).toBe(
    false
  )
  expect(paidInFullOnline(4000, null)).toBe(false)
})

test("a booking's payment carries what the card paid", () => {
  expect(
    paymentOf({
      paymentChoice: "now",
      paymentMethod: CARD_METHOD,
      paymentStatus: "unpaid",
      paymentReference: null,
      paidOnlineMinor: 1000,
      refundedMinor: null,
    })?.online
  ).toEqual({ paidMinor: 1000, refundedMinor: 0 })
})
