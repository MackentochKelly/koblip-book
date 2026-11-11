// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, onlinePaymentEvents, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))
vi.mock("@/lib/stripe", () => ({ stripeClient: null, stripeKeys: {} }))

const { getAdminOnlinePayments } = await import("./online-payments")
const { requireAdmin } = await import("@/lib/dal")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-online-payments-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  const shop = { timezone: "America/New_York", currency: "USD", ownerId: "u1" }
  await db.insert(businesses).values([
    {
      id: "salon",
      slug: "salon",
      name: "Salon",
      ...shop,
      stripeAccountId: "acct_salon",
      stripeChargesOn: true,
      onlinePay: "deposit",
      depositType: "percent",
      depositValue: 25,
    },
    {
      id: "barber",
      slug: "barber",
      name: "Barber",
      ...shop,
      stripeAccountId: "acct_barber",
    },
    { id: "plain", slug: "plain", name: "Plain", ...shop },
    {
      id: "demo",
      slug: "demo",
      name: "Demo",
      isDemo: true,
      ...shop,
      stripeAccountId: "acct_demo",
    },
  ])
  await db.insert(onlinePaymentEvents).values([
    {
      key: "e1",
      kind: "paid",
      businessId: "salon",
      stripeAccountId: "acct_salon",
      amountMinor: 500,
      currency: "USD",
      createdAt: "2026-11-10T10:00:00.000Z",
    },
    {
      key: "e2",
      kind: "refunded",
      businessId: "salon",
      stripeAccountId: "acct_salon",
      amountMinor: 500,
      currency: "USD",
      createdAt: "2026-11-10T11:00:00.000Z",
    },
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("the admin sees each business's Stripe state and setting, and every event", async () => {
  const payments = await getAdminOnlinePayments()
  expect(requireAdmin).toHaveBeenCalled()
  // By name; no business that never started, no demo copy.
  expect(
    payments.businesses.map(({ name, state, pay }) => [name, state, pay])
  ).toEqual([
    ["Barber", "details", null],
    ["Salon", "ready", { mode: "deposit", type: "percent", value: 25 }],
  ])
  // Newest first.
  expect(
    payments.events.map(({ kind, businessName, amountMinor }) => [
      kind,
      businessName,
      amountMinor,
    ])
  ).toEqual([
    ["refunded", "Salon", 500],
    ["paid", "Salon", 500],
  ])
})
