// Paying outside the app (docs/plans/outside-payments.md): a business may
// list ways it is paid (a bank transfer, Zelle, Cash App, its own) and let customers
// pay at the visit. The customer picks one when booking; Koblip never
// moves the money and never knows it arrived, so only the business can
// say a booking is paid.
export const PAYMENT_RULES = {
  // Ways a business can list.
  maxMethods: 6,
  maxName: 60,
  // Where to send the money: an account number, a Zelle phone or email.
  maxDetails: 300,
  // What the customer may add when they say they paid (a transfer number).
  maxReference: 80,
  // The picture of the payment a customer adds when they say they paid
  // (docs/plans/payment-proof.md): days it is kept after the booking's
  // date, then deleted, and its longest side once saved.
  proofKeepDays: 90,
  proofMaxSide: 2000,
  // How often the server looks for pictures to delete, and how old a
  // picture no booking holds must be first (one being sent right now is
  // saved a moment before its booking knows it).
  proofSweepMinutes: 60,
  proofOrphanMinutes: 60,
} as const

export const PAYMENT_TYPES = [
  "bank_transfer",
  "zelle",
  "cash_app",
  "other",
] as const
export type PaymentType = (typeof PAYMENT_TYPES)[number]

// The ways every business has from the start, in this order, in
// Settings → Payments.
export const STANDARD_PAYMENT_TYPES = [
  "bank_transfer",
  "zelle",
  "cash_app",
] as const satisfies readonly PaymentType[]

// What each standard way holds on a new business, so booking has its
// payment step from the first day and the owner can try it (the owner's
// decision, Nov 10: customers see these too until the owner puts in their
// own, or removes the way). Made up and not usable on purpose: an all-zero
// account, a reserved example.com address (RFC 2606) and a $Cashtag with
// a hyphen, which Cash App does not allow. No money can reach anyone.
// Migration 0074 gave the same rows to every business that existed.
export const SAMPLE_PAYMENT_METHODS = [
  {
    type: "bank_transfer",
    name: "Sample Bank",
    details: "Account holder: Sample Name\nAccount number: 0000 0000 0000",
  },
  { type: "zelle", name: "Zelle", details: "sample@example.com" },
  { type: "cash_app", name: "Cash App", details: "$sample-cashtag" },
] as const satisfies readonly {
  type: (typeof STANDARD_PAYMENT_TYPES)[number]
  name: string
  details: string
}[]

// The name a new way starts with: a brand is its own name, in every
// language; a bank or another way is named by the owner.
export const PAYMENT_START_NAMES: Record<PaymentType, string> = {
  bank_transfer: "",
  zelle: "Zelle",
  cash_app: "Cash App",
  other: "",
}

// The owner's list: each standard way first, with the business's own way
// of that kind when it has one (null: still to set up), then every other
// way it added, in its order. A standard way the owner removed is left
// out, unless they added one of that kind again.
export function paymentSlots<Method extends { type: PaymentType }>(
  methods: readonly Method[],
  removed: readonly PaymentType[] = []
): {
  standard: { type: PaymentType; method: Method | null }[]
  more: Method[]
} {
  const standard = STANDARD_PAYMENT_TYPES.map((type) => ({
    type,
    method: methods.find((method) => method.type === type) ?? null,
  })).filter((slot) => slot.method !== null || !removed.includes(slot.type))
  const shown = new Set(standard.map((slot) => slot.method))
  return { standard, more: methods.filter((method) => !shown.has(method)) }
}

// The removed list with one more standard way in it; the same list when
// the kind is not a standard way or is in it already.
export function withRemovedType(
  removed: readonly PaymentType[],
  type: PaymentType
): PaymentType[] {
  const standard: readonly PaymentType[] = STANDARD_PAYMENT_TYPES
  return standard.includes(type) && !removed.includes(type)
    ? [...removed, type]
    : [...removed]
}

// now: by one of the business's ways; later: at the visit.
export const PAYMENT_CHOICES = ["now", "later"] as const
export type PaymentChoice = (typeof PAYMENT_CHOICES)[number]

// unpaid: nothing heard. reported: the customer says they paid, for the
// business to check. paid: the business says so.
export const PAYMENT_STATUSES = ["unpaid", "reported", "paid"] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export function isPaymentType(value: unknown): value is PaymentType {
  return (PAYMENT_TYPES as readonly unknown[]).includes(value)
}

// One way to pay, as the owner set it up.
export interface PaymentMethod {
  id: string
  type: PaymentType
  name: string
  // Private: only the owner and a customer who booked with it see this.
  details: string
}

// The way as it was when a customer booked with it, kept on the booking.
// A card payment through Stripe is kept the same way, as CARD_METHOD.
export type PaymentMethodSnapshot = Omit<PaymentMethod, "id" | "type"> & {
  type: PaymentType | typeof CARD_TYPE
}

// What the booking page may show before anyone has booked: the ways' names,
// never their details.
export interface PaymentOptions {
  methods: Pick<PaymentMethod, "id" | "type" | "name">[]
  // Paying by card on Stripe's page, when the business takes it; the
  // booking flow works out the amount from it (cardAmount).
  card: OnlinePay | null
  payLater: boolean
  // The business asks for payment proof: a way picked to pay now is then
  // paid, and its proof added, before the booking is confirmed.
  asksProof: boolean
}

// What a customer sends when they book.
export type PaymentRequest =
  { choice: "now"; methodId: string } | { choice: "later" } | { choice: "card" }

// What a booking carries about its payment (the bookings.payment* columns).
export interface BookingPayment {
  choice: PaymentChoice
  // Null when they pay at the visit.
  method: PaymentMethodSnapshot | null
  status: PaymentStatus
  reference: string | null
  // Whether the customer added a picture of the payment. The picture
  // itself is private: see lib/payment-proof-access.ts for who may open it.
  hasProof: boolean
  // What Stripe took by card and what was given back; null on a booking
  // not paid online. Only Stripe's answer sets these.
  online: { paidMinor: number; refundedMinor: number } | null
}

// A business's choices, for its booking page. Null while it lists no way to
// pay and takes no card: its booking flow then has no payment step, as
// before.
export function paymentOptions(
  methods: readonly PaymentMethod[],
  payLater: boolean,
  asksProof: boolean,
  card: OnlinePay | null = null
): PaymentOptions | null {
  if (methods.length === 0 && !card) return null
  return {
    methods: methods.map(({ id, type, name }) => ({ id, type, name })),
    card,
    payLater,
    asksProof,
  }
}

// Checks one way sent from the owner's form: trimmed, a known type, a name
// and where to send the money.
export function checkPaymentMethod(
  input:
    { type?: unknown; name?: unknown; details?: unknown } | null | undefined
):
  | { ok: true; values: Omit<PaymentMethod, "id"> }
  | { ok: false; error: "type" | "name" | "details" } {
  if (!isPaymentType(input?.type)) return { ok: false, error: "type" }
  const name = typeof input.name === "string" ? input.name.trim() : ""
  if (!name || name.length > PAYMENT_RULES.maxName)
    return { ok: false, error: "name" }
  const details = typeof input.details === "string" ? input.details.trim() : ""
  if (!details || details.length > PAYMENT_RULES.maxDetails)
    return { ok: false, error: "details" }
  return { ok: true, values: { type: input.type, name, details } }
}

// What a new booking's payment starts as. A business with no way to pay
// tracks nothing (null), whatever was sent. With ways, the customer must
// pick one of them, the card when the business takes it, or paying later
// when the business allows it. It always starts unpaid: choosing a way is
// not paying, and a card is paid only when Stripe says so.
export function startPayment(
  methods: readonly PaymentMethod[],
  payLater: boolean,
  requested: unknown,
  card = false
): { ok: true; payment: BookingPayment | null } | { ok: false } {
  if (methods.length === 0 && !card) return { ok: true, payment: null }
  const request = requested as Partial<{
    choice: unknown
    methodId: unknown
  }> | null
  if (request?.choice === "card") {
    if (!card) return { ok: false }
    return {
      ok: true,
      payment: {
        choice: "now",
        method: CARD_METHOD,
        status: "unpaid",
        reference: null,
        hasProof: false,
        online: null,
      },
    }
  }
  if (request?.choice === "later") {
    if (!payLater) return { ok: false }
    return {
      ok: true,
      payment: {
        choice: "later",
        method: null,
        status: "unpaid",
        reference: null,
        hasProof: false,
        online: null,
      },
    }
  }
  if (request?.choice === "now") {
    const method = methods.find((item) => item.id === request.methodId)
    if (!method) return { ok: false }
    const { type, name, details } = method
    return {
      ok: true,
      payment: {
        choice: "now",
        method: { type, name, details },
        status: "unpaid",
        reference: null,
        hasProof: false,
        online: null,
      },
    }
  }
  return { ok: false }
}

// A booking's payment from its columns; null when it tracks none.
export function paymentOf(row: {
  paymentChoice: PaymentChoice | null
  paymentMethod: PaymentMethodSnapshot | null
  paymentStatus: PaymentStatus | null
  paymentReference: string | null
  paymentProof?: string | null
  paidOnlineMinor?: number | null
  refundedMinor?: number | null
}): BookingPayment | null {
  if (!row.paymentChoice || !row.paymentStatus) return null
  return {
    choice: row.paymentChoice,
    method: row.paymentChoice === "now" ? row.paymentMethod : null,
    status: row.paymentStatus,
    reference: row.paymentReference,
    hasProof: Boolean(row.paymentProof),
    online:
      typeof row.paidOnlineMinor === "number"
        ? {
            paidMinor: row.paidOnlineMinor,
            refundedMinor: row.refundedMinor ?? 0,
          }
        : null,
  }
}

// Where a booking's payment picture is read from. The address answers
// only the people allowed to see it (lib/payment-proof-access.ts).
export function paymentProofPath(bookingId: string): string {
  return `/api/payment-proof/${bookingId}`
}

// The day a booking's payment picture is deleted: proofKeepDays after the
// booking's date.
export function proofDeleteDate(startAt: string): Date {
  return new Date(
    new Date(startAt).getTime() + PAYMENT_RULES.proofKeepDays * 86_400_000
  )
}

// Whether the customer can still say "I've paid": they chose a way to pay
// now and nobody has said anything yet. It only asks the business to check.
export function canReportPayment(payment: BookingPayment | null): boolean {
  return (
    payment?.choice === "now" &&
    payment.status === "unpaid" &&
    payment.method?.type !== CARD_TYPE
  )
}

// The reference a customer adds when they say they paid: trimmed, null when
// empty; undefined when it is not text or too long.
export function checkPaymentReference(
  value: unknown
): string | null | undefined {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return undefined
  const trimmed = value.trim()
  if (trimmed.length > PAYMENT_RULES.maxReference) return undefined
  return trimmed === "" ? null : trimmed
}

// What a business's policies must say about paying, from its ways to pay:
// at the visit only (it lists no way), by one of its ways or at the visit,
// or by one of its ways only. Policies are written for one of these
// (businesses.policiesPayment), so the app can tell when they fell behind.
export const POLICY_PAYMENT_STATES = [
  "visit",
  "direct_or_visit",
  "direct",
] as const
export type PolicyPaymentState = (typeof POLICY_PAYMENT_STATES)[number]

export function policyPaymentState(
  methodCount: number,
  payLater: boolean
): PolicyPaymentState {
  if (methodCount === 0) return "visit"
  return payLater ? "direct_or_visit" : "direct"
}

// Whether the policies were written for another way of paying than the
// business offers now. Policies from before this was recorded (null) all
// said "pay at the business".
export function policiesBehind(
  writtenFor: PolicyPaymentState | null,
  now: PolicyPaymentState
): boolean {
  return (writtenFor ?? "visit") !== now
}

// Paying online (docs/plans/online-payments.md): the customer pays the
// business by card on Stripe's own page when they book. The money goes to
// the business's Stripe account; Koblip never holds it and never sees a
// card. A booking is paid online only when Stripe says so.
export const ONLINE_PAY_RULES = {
  // How long a time is held while the customer pays: Stripe's shortest
  // payment page (docs.stripe.com/api/checkout/sessions/create, expires_at).
  holdMinutes: 30,
  // How often the server deletes holds nobody paid for.
  holdSweepMinutes: 5,
  // A deposit in percent; 100 is the full price, which is its own choice.
  minPercent: 1,
  maxPercent: 99,
} as const

// off: no card. deposit: a part now, the rest at the visit. full: all now.
export const ONLINE_PAY_MODES = ["off", "deposit", "full"] as const
export type OnlinePayMode = (typeof ONLINE_PAY_MODES)[number]

export const DEPOSIT_TYPES = ["percent", "amount"] as const
export type DepositType = (typeof DEPOSIT_TYPES)[number]

// What a business that takes cards asks for (never "off": that is null).
export type OnlinePay =
  | { mode: "full" }
  | { mode: "deposit"; type: DepositType; value: number }

// The kind a card payment is kept as on its booking, and the way itself.
// Its name is shown in the reader's language by the screens, from the kind.
export const CARD_TYPE = "card"
export const CARD_METHOD = {
  type: CARD_TYPE,
  name: "Card",
  details: "",
} as const satisfies PaymentMethodSnapshot

// Stripe's rules per currency (docs.stripe.com/currencies, read Nov 10).
// The app keeps every price in hundredths, whatever the currency.
// No cents: Stripe takes the whole number ("500" is 500 JPY).
const NO_CENT_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "MGA",
  "PYG",
  "RWF",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])
// No cents either, but Stripe still wants two decimals, always "00".
const WHOLE_ONLY_CURRENCIES = new Set(["ISK", "UGX"])

// Stripe's smallest charge, in the app's hundredths. A currency not listed
// has no check here; Stripe answers for it when the payment page is made.
const SMALLEST_CHARGE: Record<string, number> = {
  USD: 50,
  AED: 200,
  ARS: 50,
  AUD: 50,
  BRL: 50,
  CAD: 50,
  CHF: 50,
  COP: 50,
  CZK: 1500,
  DKK: 250,
  EUR: 50,
  GBP: 30,
  HKD: 400,
  HUF: 17500,
  IDR: 50,
  ILS: 50,
  INR: 50,
  JPY: 5000,
  KRW: 5000,
  MXN: 1000,
  MYR: 200,
  NOK: 300,
  NZD: 50,
  PHP: 50,
  PLN: 200,
  RON: 200,
  SEK: 300,
  SGD: 50,
  THB: 1000,
  ZAR: 50,
}

// Whether a currency has no cents to charge.
function wholeOnly(currency: string): boolean {
  const code = currency.toUpperCase()
  return NO_CENT_CURRENCIES.has(code) || WHOLE_ONLY_CURRENCIES.has(code)
}

// The smallest amount Stripe charges in a currency, in the app's hundredths.
export function smallestCharge(currency: string): number {
  return SMALLEST_CHARGE[currency.toUpperCase()] ?? (wholeOnly(currency) ? 100 : 1)
}

// An amount in the app's hundredths as Stripe wants it for that currency.
export function stripeAmount(amountMinor: number, currency: string): number {
  const code = currency.toUpperCase()
  if (NO_CENT_CURRENCIES.has(code)) return Math.round(amountMinor / 100)
  if (WHOLE_ONLY_CURRENCIES.has(code)) return Math.round(amountMinor / 100) * 100
  return amountMinor
}

// Stripe's amount back in the app's hundredths.
export function fromStripeAmount(amount: number, currency: string): number {
  return NO_CENT_CURRENCIES.has(currency.toUpperCase()) ? amount * 100 : amount
}

// A business's card setting from its columns; null when it is off or was
// never finished.
export function onlinePayOf(row: {
  onlinePay: OnlinePayMode
  depositType: DepositType | null
  depositValue: number | null
}): OnlinePay | null {
  if (row.onlinePay === "full") return { mode: "full" }
  if (row.onlinePay !== "deposit") return null
  if (!row.depositType || !row.depositValue || row.depositValue <= 0) return null
  return { mode: "deposit", type: row.depositType, value: row.depositValue }
}

// What the card is charged for a booking that costs totalMinor (after any
// reward): the full price, or the deposit, never more than the price and
// never under Stripe's smallest charge. Null when nothing can be charged:
// the booking is free, or costs less than Stripe's smallest charge.
export function cardAmount(
  pay: OnlinePay,
  totalMinor: number,
  currency: string
): number | null {
  const least = smallestCharge(currency)
  const step = wholeOnly(currency) ? 100 : 1
  const total = Math.floor(totalMinor / step) * step
  if (total <= 0 || total < least) return null
  if (pay.mode === "full") return total
  const asked =
    pay.type === "percent"
      ? Math.round((totalMinor * pay.value) / 100 / step) * step
      : pay.value
  return Math.min(total, Math.max(least, asked))
}

// Checks the card setting sent from the owner's form. A percent is a whole
// number from 1 to 99; an amount is at least Stripe's smallest charge (ON16).
export function checkOnlinePay(
  input:
    { mode?: unknown; type?: unknown; value?: unknown } | null | undefined,
  currency: string
):
  | { ok: true; pay: OnlinePay | null }
  | { ok: false; error: "mode" | "type" | "percent" | "amount" } {
  if (input?.mode === "off") return { ok: true, pay: null }
  if (input?.mode === "full") return { ok: true, pay: { mode: "full" } }
  if (input?.mode !== "deposit") return { ok: false, error: "mode" }
  const value = input.value
  if (input.type === "percent") {
    if (
      typeof value !== "number" ||
      !Number.isInteger(value) ||
      value < ONLINE_PAY_RULES.minPercent ||
      value > ONLINE_PAY_RULES.maxPercent
    )
      return { ok: false, error: "percent" }
    return { ok: true, pay: { mode: "deposit", type: "percent", value } }
  }
  if (input.type === "amount") {
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < smallestCharge(currency) ||
      (wholeOnly(currency) && value % 100 !== 0)
    )
      return { ok: false, error: "amount" }
    return { ok: true, pay: { mode: "deposit", type: "amount", value } }
  }
  return { ok: false, error: "type" }
}

// What is still to pay at the visit on a booking: its price less what the
// card paid and was not given back. Never under zero.
export function leftToPay(
  priceMinor: number | null,
  online: BookingPayment["online"]
): number | null {
  if (priceMinor === null) return null
  if (!online) return priceMinor
  return Math.max(0, priceMinor - (online.paidMinor - online.refundedMinor))
}

// Whether the card paid the whole price: such a booking cannot be set back
// to "not paid" by hand (ON12).
export function paidInFullOnline(
  priceMinor: number | null,
  online: BookingPayment["online"]
): boolean {
  return (
    online !== null &&
    priceMinor !== null &&
    online.paidMinor - online.refundedMinor >= priceMinor &&
    online.paidMinor > 0
  )
}
