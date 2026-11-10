import { expect, test } from "vitest"

import {
  canReportPayment,
  checkPaymentMethod,
  checkPaymentReference,
  paymentOf,
  paymentOptions,
  paymentSlots,
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
  expect(paymentOptions([], true)).toBeNull()
  expect(startPayment([], true, { choice: "now", methodId: "m1" })).toEqual({
    ok: true,
    payment: null,
  })
  expect(startPayment([], true, undefined)).toEqual({ ok: true, payment: null })
})

test("the booking page gets the ways' names, never their details", () => {
  const options = paymentOptions([zelle, bank], false)
  expect(options).toEqual({
    methods: [
      { id: "m1", type: "zelle", name: "Zelle" },
      { id: "m2", type: "bank_transfer", name: "Banco Popular" },
    ],
    payLater: false,
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
    payment: { choice: "later", method: null, status: "unpaid", reference: null },
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
  const now = { choice: "now" as const, method: { type: "zelle" as const, name: "Zelle", details: "x" }, reference: null }
  expect(canReportPayment({ ...now, status: "unpaid" })).toBe(true)
  expect(canReportPayment({ ...now, status: "reported" })).toBe(false)
  expect(canReportPayment({ ...now, status: "paid" })).toBe(false)
  expect(canReportPayment({ choice: "later", method: null, status: "unpaid", reference: null })).toBe(false)
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
  expect(paymentOptions([], true)).toBeNull()
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
