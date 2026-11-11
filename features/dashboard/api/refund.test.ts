// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import {
  bookings,
  businesses,
  inAppNotifications,
  onlinePaymentEvents,
  user,
} from "@/lib/db/schema"
import { CARD_METHOD } from "@/lib/payment-rules"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/translations/business-texts", () => ({
  translateBusinessSoon: vi.fn(),
}))
const session = { userId: "u1", name: "Owner", email: "owner@example.com" }
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => session),
  getSession: vi.fn(async () => session),
}))

// Stripe, as its API answers a refund (docs/online-payments.md).
const stripe = {
  fails: false,
  asked: [] as { payment: string; account: string; key: string }[],
  refunds: {
    create: vi.fn(
      async (
        params: { payment_intent: string },
        options: { stripeAccount: string; idempotencyKey: string }
      ) => {
        if (stripe.fails) throw new Error("Stripe is down")
        stripe.asked.push({
          payment: params.payment_intent,
          account: options.stripeAccount,
          key: options.idempotencyKey,
        })
        return { id: "re_1", amount: 1000, currency: "usd" }
      }
    ),
  },
}
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = "whsec_test"
vi.mock("@/lib/stripe", () => ({ stripeClient: stripe, stripeKeys: {} }))

const { refundBooking } = await import("./online-pay-actions")
const { cancelBooking } = await import("./actions")

let closeDb: () => void
let dir: string

// A booking paid in full by card, by a customer with an account.
const paidBooking = async (id: string, businessId = "us") => {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "USD",
    startAt: "2099-01-05T14:00:00.000Z",
    endAt: "2099-01-05T14:30:00.000Z",
    customerName: "Luis",
    customerPhone: "+18095550134",
    customerUserId: "client",
    paymentChoice: "now",
    paymentMethod: CARD_METHOD,
    paymentStatus: "paid",
    paidOnlineMinor: 1000,
    stripePaymentId: `pi_${id}`,
  })
}

const bookingRow = async (id: string) => {
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  return row
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-refund-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    {
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    },
    {
      id: "other",
      name: "Other",
      email: "other@example.com",
      emailVerified: false,
    },
    {
      id: "client",
      name: "Luis",
      email: "luis@example.com",
      emailVerified: false,
    },
  ])
  const us = { timezone: "America/New_York", currency: "USD" }
  await db.insert(businesses).values([
    {
      id: "us",
      slug: "us",
      name: "Salon",
      ...us,
      ownerId: "u1",
      stripeAccountId: "acct_us",
    },
    {
      id: "theirs",
      slug: "theirs",
      name: "Theirs",
      ...us,
      ownerId: "other",
      stripeAccountId: "acct_theirs",
    },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  stripe.fails = false
  stripe.asked = []
})

test("Refund gives everything back once, on the business's account", async () => {
  await paidBooking("b1")
  expect(await refundBooking("us", "b1")).toEqual({ ok: true })
  expect(stripe.asked).toEqual([
    { payment: "pi_b1", account: "acct_us", key: "refund-b1" },
  ])
  expect(await bookingRow("b1")).toMatchObject({
    refundedMinor: 1000,
    paymentStatus: "unpaid",
  })
  const { db } = await import("@/lib/db")
  // The admin's history has it, and the customer's bell.
  const events = await db
    .select()
    .from(onlinePaymentEvents)
    .where(eq(onlinePaymentEvents.bookingId, "b1"))
  expect(events.map(({ kind, amountMinor }) => [kind, amountMinor])).toEqual([
    ["refunded", 1000],
  ])
  const bells = await db
    .select()
    .from(inAppNotifications)
    .where(eq(inAppNotifications.bookingId, "b1"))
  expect(bells.map(({ kind, audience }) => [kind, audience])).toEqual([
    ["clientRefunded", "client"],
  ])
  // Nothing is left to give back.
  expect(await refundBooking("us", "b1")).toEqual({
    ok: false,
    error: "nothing",
  })
  expect(stripe.asked).toHaveLength(1)
})

test("a refund Stripe refuses changes nothing", async () => {
  await paidBooking("b2")
  stripe.fails = true
  expect(await refundBooking("us", "b2")).toEqual({
    ok: false,
    error: "failed",
  })
  expect(await bookingRow("b2")).toMatchObject({
    refundedMinor: null,
    paymentStatus: "paid",
  })
})

test("only the business's owner refunds", async () => {
  await paidBooking("b3", "theirs")
  expect(await refundBooking("theirs", "b3")).toEqual({
    ok: false,
    error: "not_found",
  })
  // Nor another business's booking through one's own.
  expect(await refundBooking("us", "b3")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(stripe.asked).toEqual([])
})

test("cancelling can refund too; a refund that fails cancels nothing", async () => {
  await paidBooking("b4")
  stripe.fails = true
  expect(await cancelBooking("us", "b4", null, true)).toEqual({
    ok: false,
    error: "refund_failed",
  })
  expect((await bookingRow("b4")).status).toBe("confirmed")
  stripe.fails = false
  expect(await cancelBooking("us", "b4", null, true)).toEqual({ ok: true })
  expect(await bookingRow("b4")).toMatchObject({
    status: "cancelled",
    refundedMinor: 1000,
  })
})

test("cancelling without the refund keeps the money", async () => {
  await paidBooking("b5")
  expect(await cancelBooking("us", "b5")).toEqual({ ok: true })
  expect(await bookingRow("b5")).toMatchObject({
    status: "cancelled",
    refundedMinor: null,
  })
  expect(stripe.asked).toEqual([])
})
