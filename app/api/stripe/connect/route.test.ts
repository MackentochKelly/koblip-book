// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import Stripe from "stripe"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  bookingHolds,
  bookings,
  businesses,
  onlinePaymentEvents,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ getSession: async () => null }))

// The real Stripe library, for its signatures; it calls nobody here.
const SECRET = "whsec_test_secret"
process.env.STRIPE_CONNECT_WEBHOOK_SECRET = SECRET
const stripe = new Stripe("sk_test_none")
vi.mock("@/lib/stripe", () => ({ stripeClient: stripe, stripeKeys: {} }))

const { POST } = await import("./route")

let closeDb: () => void
let dir: string

async function send(event: object, secret = SECRET) {
  const body = JSON.stringify({ id: `evt_${crypto.randomUUID()}`, ...event })
  const signature = await stripe.webhooks.generateTestHeaderStringAsync({
    payload: body,
    secret,
  })
  return POST(
    new Request("https://book.example.com/api/stripe/connect", {
      method: "POST",
      body,
      headers: { "stripe-signature": signature },
    })
  )
}

const business = async () => {
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(businesses).where(eq(businesses.id, "shop"))
  return row
}
const booking = async () => {
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.id, "b1"))
  return row
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-connect-hook-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(businesses).values({
    id: "shop",
    slug: "shop",
    name: "Shop",
    timezone: "America/New_York",
    currency: "USD",
    stripeAccountId: "acct_shop",
    onlinePay: "full",
  })
  await db.insert(bookings).values({
    id: "b1",
    businessId: "shop",
    serviceName: "Cut",
    durationMinutes: 30,
    priceMinor: 4000,
    currency: "USD",
    startAt: "2099-01-05T14:00:00.000Z",
    endAt: "2099-01-05T14:30:00.000Z",
    customerName: "Luis",
    paymentChoice: "now",
    paymentMethod: { type: "card", name: "Card", details: "" },
    paymentStatus: "paid",
    paidOnlineMinor: 4000,
    stripeSessionId: "cs_test_1",
    stripePaymentId: "pi_1",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("an event Stripe did not sign is refused", async () => {
  const forged = await send(
    { type: "account.updated", account: "acct_shop", data: { object: { id: "acct_shop", charges_enabled: true } } },
    "whsec_someone_else"
  )
  expect(forged.status).toBe(400)
  expect((await business()).stripeChargesOn).toBe(false)
  const unsigned = await POST(
    new Request("https://book.example.com/api/stripe/connect", {
      method: "POST",
      body: "{}",
    })
  )
  expect(unsigned.status).toBe(400)
})

test("only Stripe's answer turns a business's card payments on and off", async () => {
  const on = await send({
    type: "account.updated",
    account: "acct_shop",
    data: { object: { id: "acct_shop", charges_enabled: true } },
  })
  expect(on.status).toBe(200)
  expect((await business()).stripeChargesOn).toBe(true)
  await send({
    type: "account.updated",
    account: "acct_shop",
    data: { object: { id: "acct_shop", charges_enabled: false } },
  })
  expect((await business()).stripeChargesOn).toBe(false)
  const { db } = await import("@/lib/db")
  const events = await db
    .select()
    .from(onlinePaymentEvents)
    .where(eq(onlinePaymentEvents.kind, "account"))
  expect(events.map((event) => event.note)).toEqual([
    "can take payments",
    "cannot take payments",
  ])
})

test("a payment page that closed unpaid frees its time", async () => {
  const { db } = await import("@/lib/db")
  await db.insert(bookingHolds).values({
    id: "h1",
    businessId: "shop",
    bookingId: "b-held",
    input: {},
    startAt: "2099-01-06T14:00:00.000Z",
    endAt: "2099-01-06T14:30:00.000Z",
    amountMinor: 4000,
    currency: "USD",
    stripeSessionId: "cs_test_open",
    expiresAt: "2099-01-01T00:00:00.000Z",
  })
  const response = await send({
    type: "checkout.session.expired",
    account: "acct_shop",
    data: {
      object: { id: "cs_test_open", amount_total: 4000, currency: "usd" },
    },
  })
  expect(response.status).toBe(200)
  expect(await db.select().from(bookingHolds)).toHaveLength(0)
})

test("a refund made in Stripe shows on the booking, once", async () => {
  const refunded = {
    type: "charge.refunded",
    account: "acct_shop",
    data: {
      object: {
        id: "ch_1",
        payment_intent: "pi_1",
        amount_refunded: 4000,
        currency: "usd",
      },
    },
  }
  expect((await send(refunded)).status).toBe(200)
  expect(await booking()).toMatchObject({
    refundedMinor: 4000,
    paymentStatus: "unpaid",
    paymentPaidAt: null,
  })
  const at = (await booking()).refundedAt
  expect(at).toEqual(expect.any(String))
  // Stripe sends it again: nothing changes.
  expect((await send(refunded)).status).toBe(200)
  const { db } = await import("@/lib/db")
  const events = await db
    .select()
    .from(onlinePaymentEvents)
    .where(eq(onlinePaymentEvents.kind, "refunded"))
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ bookingId: "b1", amountMinor: 4000 })
})

test("a disputed payment is recorded on its booking", async () => {
  const response = await send({
    type: "charge.dispute.created",
    account: "acct_shop",
    data: {
      object: {
        id: "dp_1",
        payment_intent: "pi_1",
        amount: 4000,
        currency: "usd",
        reason: "fraudulent",
      },
    },
  })
  expect(response.status).toBe(200)
  const { db } = await import("@/lib/db")
  const [event] = await db
    .select()
    .from(onlinePaymentEvents)
    .where(eq(onlinePaymentEvents.kind, "disputed"))
  expect(event).toMatchObject({
    bookingId: "b1",
    businessId: "shop",
    amountMinor: 4000,
    note: "fraudulent",
  })
})

test("an event of Koblip's own account is not for here", async () => {
  const response = await send({
    type: "account.updated",
    data: { object: { id: "acct_koblip", charges_enabled: true } },
  })
  expect(response.status).toBe(200)
})
