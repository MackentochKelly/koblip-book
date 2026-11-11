// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  bookingHolds,
  bookings,
  businessHours,
  businesses,
  inAppNotifications,
  onlinePaymentEvents,
  planFeatures,
  services,
  teamMembers,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ getSession: async () => ({ userId: "u-customer", isGuest: false, phone: null }) }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/headers", () => ({
  headers: async () => new Map([["origin", "https://book.example.com"]]),
}))

// Stripe, as its API answers: payment pages by id, and refunds asked for.
type Page = {
  id: string
  url: string
  payment_status: "paid" | "unpaid"
  amount_total: number
  currency: string
  payment_intent: string
  metadata: Record<string, string>
  status: string
}
const stripe = {
  pages: new Map<string, Page>(),
  asked: [] as { params: Record<string, unknown>; account: string }[],
  fail: false,
  checkout: {
    sessions: {
      create: vi.fn(
        async (
          params: {
            line_items: { price_data: { unit_amount: number; currency: string } }[]
            metadata: Record<string, string>
          },
          options: { stripeAccount: string }
        ) => {
          if (stripe.fail) throw new Error("Stripe is down")
          const id = `cs_test_${stripe.pages.size + 1}`
          const page: Page = {
            id,
            url: `https://checkout.stripe.test/${id}`,
            payment_status: "unpaid",
            amount_total: params.line_items[0].price_data.unit_amount,
            currency: params.line_items[0].price_data.currency,
            payment_intent: `pi_${id}`,
            metadata: params.metadata,
            status: "open",
          }
          stripe.pages.set(id, page)
          stripe.asked.push({ params, account: options.stripeAccount })
          return page
        }
      ),
      retrieve: vi.fn(async (id: string) => {
        const page = stripe.pages.get(id)
        if (!page) throw new Error("No such session")
        return page
      }),
      expire: vi.fn(async (id: string) => {
        const page = stripe.pages.get(id)
        if (page) page.status = "expired"
        return page
      }),
    },
  },
  refunds: {
    create: vi.fn(async () => ({ id: "re_1", amount: 0, currency: "usd" })),
  },
}
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_test"
vi.mock("@/lib/stripe", () => ({ stripeClient: stripe, stripeKeys: {} }))

const { createBooking } = await import("./create-booking")
const { startCardPayment, finishCardPayment, cancelCardPayment } = await import(
  "./card-payment"
)
const { settleCardPayment } = await import("./settle-card-payment")
const { getAvailability } = await import("./get-availability")
const { deleteExpiredHolds } = await import("./holds")

// Monday 2026-06-01 08:00 in New York.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function seedShop(
  id: string,
  card: Partial<typeof businesses.$inferInsert> = {}
) {
  const { db } = await import("@/lib/db")
  await db.insert(businesses).values({
    id,
    slug: id,
    name: "Card Shop",
    timezone: "America/New_York",
    currency: "USD",
    status: "operational",
    seats: 1,
    stripeAccountId: `acct_${id}`,
    stripeChargesOn: true,
    onlinePay: "full",
    ...card,
  })
  await db.insert(businessHours).values({
    id: `${id}-h`,
    businessId: id,
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
  await db.insert(services).values({
    id: `${id}-svc`,
    businessId: id,
    name: "Cut",
    durationMinutes: 30,
    priceMinor: 4000,
    position: 0,
  })
  await db.insert(teamMembers).values({
    id: `${id}-tm`,
    businessId: id,
    name: "Ana",
    position: 0,
  })
}

const input = (slug: string, more: object = {}) => ({
  slug,
  serviceId: `${slug}-svc`,
  teamMemberId: null,
  addonIds: [],
  date: "2026-06-01",
  time: "10:00",
  name: "Luis",
  phone: "+12125550134",
  email: "ana@example.com",
  payment: { choice: "card" as const },
  ...more,
})

const rows = async (businessId: string) => {
  const { db } = await import("@/lib/db")
  return {
    holds: await db
      .select()
      .from(bookingHolds)
      .where(eq(bookingHolds.businessId, businessId)),
    bookings: await db
      .select()
      .from(bookings)
      .where(eq(bookings.businessId, businessId)),
  }
}

const pay = (url: string) => {
  const page = stripe.pages.get(url.split("/").at(-1) ?? "")
  if (!page) throw new Error("No page")
  page.payment_status = "paid"
  return page
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-card-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  // Online payments on every plan, for the tests' businesses.
  await db
    .insert(planFeatures)
    .values({ featureKey: "onlinePayments", plan: "free" })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

// Bookings come from a signed-in account (EM-D7).
beforeAll(async () => {
  const { addCustomer } = await import("./test-customer")
  await addCustomer()
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  stripe.fail = false
})

afterEach(() => {
  vi.restoreAllMocks()
})

test("paying by card holds the time, and the booking is made when Stripe says paid", async () => {
  await seedShop("pay")
  const started = await startCardPayment(input("pay"))
  expect(started).toMatchObject({ status: "pay" })
  if (started.status !== "pay") return
  // Stripe's page: on the business's own account, for the full price, back
  // to the booking page.
  expect(stripe.asked.at(-1)).toMatchObject({
    account: "acct_pay",
    params: {
      mode: "payment",
      allowed_payment_method_types: ["card"],
      success_url:
        "https://book.example.com/b/pay/book?service=pay-svc&paid={CHECKOUT_SESSION_ID}",
      line_items: [
        { price_data: { unit_amount: 4000, currency: "usd" } },
      ],
    },
  })
  // Held, not booked: nobody else gets the time, and the owner hears
  // nothing yet.
  let now = await rows("pay")
  expect(now.bookings).toHaveLength(0)
  expect(now.holds).toHaveLength(1)
  expect(now.holds[0]).toMatchObject({
    bookingId: started.bookingId,
    teamMemberId: "pay-tm",
    amountMinor: 4000,
  })
  // Signed in: the booking is the account's, so it needs no claim.
  expect(started.claimToken).toBeNull()
  const free = await getAvailability("pay", "pay-svc", null)
  expect(free?.days.find((day) => day.date === "2026-06-01")?.times).not.toContain(
    "10:00"
  )
  expect(
    await createBooking(input("pay", { payment: { choice: "later" } }))
  ).toEqual({ status: "taken" })
  expect(await startCardPayment(input("pay", { name: "Eva" }))).toEqual({
    status: "taken",
  })

  // Back from Stripe without paying: nothing is booked.
  const page = stripe.pages.get(started.url.split("/").at(-1) ?? "")
  expect(await finishCardPayment("pay", page?.id ?? "")).toEqual({
    status: "unpaid",
  })
  expect((await rows("pay")).bookings).toHaveLength(0)

  // Paid: the booking is made, with the id their device kept.
  pay(started.url)
  const finished = await finishCardPayment("pay", page?.id ?? "")
  expect(finished).toMatchObject({
    status: "booked",
    booking: {
      id: started.bookingId,
      serviceName: "Cut",
      teamMemberName: "Ana",
      date: "2026-06-01",
      time: "10:00",
      priceMinor: 4000,
      payment: {
        choice: "now",
        method: { type: "card" },
        status: "paid",
        online: { paidMinor: 4000, refundedMinor: 0 },
      },
    },
  })
  now = await rows("pay")
  expect(now.holds).toHaveLength(0)
  expect(now.bookings).toHaveLength(1)
  expect(now.bookings[0]).toMatchObject({
    id: started.bookingId,
    status: "confirmed",
    paymentStatus: "paid",
    paidOnlineMinor: 4000,
    stripeSessionId: page?.id,
    stripePaymentId: `pi_${page?.id}`,
    customerName: "Luis",
  })
  expect(now.bookings[0]).toMatchObject({
    customerUserId: "u-customer",
    claimTokenHash: null,
  })

  // Stripe's webhook says the same again: still one booking, one record.
  expect(await settleCardPayment("acct_pay", page as never)).toEqual({
    status: "booked",
    bookingId: started.bookingId,
  })
  expect((await rows("pay")).bookings).toHaveLength(1)
  const { db } = await import("@/lib/db")
  const events = await db
    .select()
    .from(onlinePaymentEvents)
    .where(eq(onlinePaymentEvents.businessId, "pay"))
  expect(events.map(({ kind, amountMinor }) => ({ kind, amountMinor }))).toEqual([
    { kind: "paid", amountMinor: 4000 },
  ])
  // The owner's bell hears of the booking once it exists.
  const notices = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.businessId, "pay"))
  expect(notices.map((notice) => notice.kind)).toContain("newBooking")
})

test("a deposit charges its part and leaves the booking not paid in full", async () => {
  await seedShop("dep", {
    onlinePay: "deposit",
    depositType: "percent",
    depositValue: 25,
  })
  const started = await startCardPayment(input("dep"))
  if (started.status !== "pay") throw new Error("Not held")
  expect(stripe.asked.at(-1)?.params).toMatchObject({
    line_items: [{ price_data: { unit_amount: 1000 } }],
  })
  const page = pay(started.url)
  expect(await finishCardPayment("dep", page.id)).toMatchObject({
    status: "booked",
    booking: {
      priceMinor: 4000,
      payment: { status: "unpaid", online: { paidMinor: 1000 } },
    },
  })
})

test("the card is never a way to book without paying, or where the business takes none", async () => {
  await seedShop("guard")
  // Straight to booking with "card": refused.
  expect(await createBooking(input("guard"))).toEqual({
    status: "invalid",
    field: "payment",
  })
  // Holding for anything but the card: refused.
  expect(
    await startCardPayment(input("guard", { payment: { choice: "later" } }))
  ).toEqual({ status: "invalid", field: "payment" })
  // Stripe has not said the account can take payments.
  await seedShop("notready", { stripeChargesOn: false })
  expect(await startCardPayment(input("notready"))).toEqual({
    status: "invalid",
    field: "payment",
  })
  // Card payments off: booking is as before, with no pay step.
  await seedShop("off", { onlinePay: "off" })
  expect(await startCardPayment(input("off"))).toEqual({
    status: "invalid",
    field: "payment",
  })
  expect(
    await createBooking(input("off", { payment: undefined }))
  ).toMatchObject({ status: "booked", booking: { payment: null } })
})

test("no payment page, no hold", async () => {
  await seedShop("down")
  stripe.fail = true
  expect(await startCardPayment(input("down"))).toEqual({ status: "failed" })
  expect((await rows("down")).holds).toHaveLength(0)
})

test("leaving Stripe's page frees the time and closes the page", async () => {
  await seedShop("leave")
  const started = await startCardPayment(input("leave"))
  if (started.status !== "pay") throw new Error("Not held")
  const [hold] = (await rows("leave")).holds
  // Another business's address frees nothing.
  await cancelCardPayment("pay", hold.id)
  expect((await rows("leave")).holds).toHaveLength(1)
  await cancelCardPayment("leave", hold.id)
  expect((await rows("leave")).holds).toHaveLength(0)
  expect(stripe.pages.get(hold.stripeSessionId ?? "")?.status).toBe("expired")
  // The time is free again: paying at the visit books it.
  expect(
    await createBooking(input("leave", { payment: { choice: "later" } }))
  ).toMatchObject({ status: "booked" })
})

test("a hold nobody paid for ends by itself", async () => {
  await seedShop("late")
  const started = await startCardPayment(input("late", { time: "15:00" }))
  expect(started.status).toBe("pay")
  // 36 minutes later the time is free again, even before the sweep.
  vi.spyOn(Date, "now").mockReturnValue(NOW + 36 * 60_000)
  expect(
    (await getAvailability("late", "late-svc", null))?.days.find(
      (day) => day.date === "2026-06-01"
    )?.times
  ).toContain("15:00")
  expect(await deleteExpiredHolds()).toBeGreaterThanOrEqual(1)
  expect((await rows("late")).holds).toHaveLength(0)
})

test("paid, but the booking can no longer be made: the money goes back", async () => {
  await seedShop("gone")
  const started = await startCardPayment(input("gone"))
  if (started.status !== "pay") throw new Error("Not held")
  const page = pay(started.url)
  // The service is deleted while the customer pays.
  const { db } = await import("@/lib/db")
  await db.delete(services).where(eq(services.id, "gone-svc"))
  stripe.refunds.create.mockClear()
  expect(await finishCardPayment("gone", page.id)).toEqual({
    status: "refunded",
  })
  expect(stripe.refunds.create).toHaveBeenCalledWith(
    { payment_intent: page.payment_intent },
    { stripeAccount: "acct_gone", idempotencyKey: `unbookable-${page.id}` }
  )
  const now = await rows("gone")
  expect(now.bookings).toHaveLength(0)
  expect(now.holds).toHaveLength(0)
})

test("a made-up or foreign payment page proves nothing", async () => {
  await seedShop("fake")
  expect(await finishCardPayment("fake", "cs_test_nope")).toEqual({
    status: "failed",
  })
  expect(await finishCardPayment("fake", "'; drop table")).toEqual({
    status: "failed",
  })
  // A paid page of another business.
  await seedShop("other")
  const started = await startCardPayment(input("other"))
  if (started.status !== "pay") throw new Error("Not held")
  const page = pay(started.url)
  expect(await finishCardPayment("fake", page.id)).toEqual({ status: "failed" })
  expect((await rows("fake")).bookings).toHaveLength(0)
})
