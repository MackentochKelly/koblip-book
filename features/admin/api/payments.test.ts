// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { bookings, businesses, paymentMethods, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("@/lib/account-voices", () => ({ getAccountVoices: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))

const { getBusinessPayments } = await import("./payments")
const { getBookings } = await import("./queries")
const { requireAdmin } = await import("@/lib/dal")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-payments-"))
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
  const shop = {
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  }
  await db.insert(businesses).values([
    { id: "salon", slug: "salon", name: "Salon", payLater: false, ...shop },
    { id: "barber", slug: "barber", name: "Barber", ...shop },
    { id: "plain", slug: "plain", name: "Plain", ...shop },
    { id: "demo", slug: "demo", name: "Demo", isDemo: true, ...shop },
  ])
  await db.insert(paymentMethods).values([
    {
      id: "s2",
      businessId: "salon",
      type: "bank_transfer",
      name: "Bank",
      details: "ES00",
      position: 1,
    },
    {
      id: "s1",
      businessId: "salon",
      type: "zelle",
      name: "Zelle",
      details: "pay@salon.example",
      position: 0,
    },
    {
      id: "b1",
      businessId: "barber",
      type: "other",
      name: "Cash App",
      details: "$barber",
      position: 0,
    },
    {
      id: "d1",
      businessId: "demo",
      type: "zelle",
      name: "Zelle",
      details: "demo@example.com",
      position: 0,
    },
  ])
  const zelle = {
    type: "zelle" as const,
    name: "Zelle",
    details: "pay@salon.example",
  }
  const booking = (id: string, businessId: string, values: object) => ({
    id,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: "2099-01-05T14:00:00.000Z",
    endAt: "2099-01-05T14:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550000",
    createdAt: `2026-01-0${id.at(-1)}T00:00:00.000Z`,
    ...values,
  })
  await db
    .insert(bookings)
    .values([
      booking("k1", "salon", {
        paymentChoice: "now",
        paymentMethod: zelle,
        paymentStatus: "reported",
        paymentReference: "TX-1",
        paymentProof: "proof-k1.webp",
      }),
      booking("k2", "salon", {
        paymentChoice: "later",
        paymentStatus: "unpaid",
      }),
      booking("k3", "plain", {}),
      booking("k4", "demo", {
        paymentChoice: "now",
        paymentMethod: zelle,
        paymentStatus: "reported",
      }),
    ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("every real business with a way to pay, its ways in order, and what waits", async () => {
  const list = await getBusinessPayments()
  expect(requireAdmin).toHaveBeenCalled()
  expect(list).toEqual([
    {
      businessId: "barber",
      businessName: "Barber",
      slug: "barber",
      payLater: true,
      asksProof: true,
      teamSeesProof: true,
      methods: [
        { id: "b1", type: "other", name: "Cash App", details: "$barber" },
      ],
      toCheck: 0,
    },
    {
      businessId: "salon",
      businessName: "Salon",
      slug: "salon",
      payLater: false,
      asksProof: true,
      teamSeesProof: true,
      methods: [
        {
          id: "s1",
          type: "zelle",
          name: "Zelle",
          details: "pay@salon.example",
        },
        { id: "s2", type: "bank_transfer", name: "Bank", details: "ES00" },
      ],
      toCheck: 1,
    },
  ])
})

test("the bookings list carries each booking's way to pay and status", async () => {
  const list = await getBookings()
  expect(list.map(({ id, payment }) => [id, payment])).toEqual([
    ["k3", null],
    ["k2", { way: null, status: "unpaid", proof: false, card: false, online: null }],
    ["k1", { way: "Zelle", status: "reported", proof: true, card: false, online: null }],
  ])
})
