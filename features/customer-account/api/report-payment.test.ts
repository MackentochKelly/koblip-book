// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { bookings, businesses, inAppNotifications, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const signedIn = vi.hoisted(() => ({
  customer: null as { userId: string; name: string; phone: string } | null,
}))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: async () => signedIn.customer,
}))

const { reportPayment } = await import("./report-payment")

let dir: string
const ANA = { userId: "c1", name: "Ana", phone: "+18095550000" }
const ZELLE = { type: "zelle" as const, name: "Zelle", details: "pay@shop.example" }

async function booked(values: Partial<typeof bookings.$inferInsert> = {}) {
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: new Date(Date.now() + 86_400_000).toISOString(),
    endAt: new Date(Date.now() + 88_200_000).toISOString(),
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: "p:18095550000",
    status: "confirmed",
    paymentChoice: "now",
    paymentMethod: ZELLE,
    paymentStatus: "unpaid",
    ...values,
  })
}

const payment = async () => {
  const [row] = await db
    .select({
      status: bookings.paymentStatus,
      reference: bookings.paymentReference,
      reportedAt: bookings.paymentReportedAt,
      paidAt: bookings.paymentPaidAt,
    })
    .from(bookings)
  return row
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-report-payment-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

afterEach(async () => {
  signedIn.customer = null
  await db.delete(inAppNotifications)
  await db.delete(bookings)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("saying I've paid asks the business to check, and never marks it paid", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(reportPayment("bk", " TX-77 ")).resolves.toEqual({ ok: true })
  const row = await payment()
  expect(row.status).toBe("reported")
  expect(row.reference).toBe("TX-77")
  expect(row.reportedAt).not.toBeNull()
  expect(row.paidAt).toBeNull()
})

test("the reference is optional", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(reportPayment("bk", "")).resolves.toEqual({ ok: true })
  expect(await payment()).toMatchObject({ status: "reported", reference: null })
})

test("signed out, nothing changes", async () => {
  await booked()
  await expect(reportPayment("bk", null)).resolves.toEqual({ ok: false, error: "signedOut" })
  expect((await payment()).status).toBe("unpaid")
})

test("someone else's booking cannot be reported", async () => {
  await booked({ customerPhone: "+18095551111", customerKey: "p:18095551111" })
  signedIn.customer = ANA
  await expect(reportPayment("bk", null)).resolves.toEqual({ ok: false, error: "notFound" })
  expect((await payment()).status).toBe("unpaid")
})

test("a paid booking is not sent back to be checked", async () => {
  await booked({ paymentStatus: "paid", paymentPaidAt: "2026-06-01T12:00:00.000Z" })
  signedIn.customer = ANA
  await expect(reportPayment("bk", "again")).resolves.toEqual({ ok: false, error: "notFound" })
  expect(await payment()).toMatchObject({ status: "paid", reference: null })
})

test("a pay-later booking and one with no payment cannot be reported", async () => {
  await booked({ paymentChoice: "later", paymentMethod: null })
  signedIn.customer = ANA
  await expect(reportPayment("bk", null)).resolves.toEqual({ ok: false, error: "notFound" })
  await db.delete(bookings)
  await booked({ paymentChoice: null, paymentMethod: null, paymentStatus: null })
  await expect(reportPayment("bk", null)).resolves.toEqual({ ok: false, error: "notFound" })
  expect((await payment()).status).toBeNull()
})

test("a reference that is too long or not text is refused", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(reportPayment("bk", "r".repeat(81))).resolves.toEqual({ ok: false, error: "invalid" })
  await expect(reportPayment("bk", 5)).resolves.toEqual({ ok: false, error: "invalid" })
  expect((await payment()).status).toBe("unpaid")
})

const bell = () =>
  db
    .select({
      kind: inAppNotifications.kind,
      audience: inAppNotifications.audience,
      data: inAppNotifications.data,
      link: inAppNotifications.link,
      readAt: inAppNotifications.readAt,
    })
    .from(inAppNotifications)

test("the owner's bell hears that the customer says they paid", async () => {
  await booked()
  signedIn.customer = ANA
  await reportPayment("bk", "TX-77")
  const rows = await bell()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({
    kind: "customerPaid",
    audience: "owner",
    link: "/dashboard/biz/bookings",
    data: { customerName: "Ana", serviceName: "Cut" },
  })
})

test("a report that is refused rings no bell", async () => {
  await booked({ paymentStatus: "paid" })
  signedIn.customer = ANA
  await reportPayment("bk", null)
  expect(await bell()).toEqual([])
})

test("a second report after a not-paid renews the one notice", async () => {
  await booked()
  signedIn.customer = ANA
  await reportPayment("bk", null)
  await db.update(inAppNotifications).set({ readAt: new Date().toISOString() })
  await db.update(bookings).set({ paymentStatus: "unpaid" })
  await reportPayment("bk", null)
  const rows = await bell()
  expect(rows).toHaveLength(1)
  expect(rows[0].readAt).toBeNull()
})
