// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { bookings, businesses, paymentMethods, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { deletePaymentMethod, savePaymentMethod, setBookingPaid, setPayLater } =
  await import("./payment-actions")

let closeDb: () => void
let dir: string

async function seedBooking(
  id: string,
  businessId: string,
  payment: Partial<typeof bookings.$inferInsert> = {}
) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    startAt: "2099-01-05T14:00:00.000Z",
    endAt: "2099-01-05T14:30:00.000Z",
    customerName: "Luis",
    customerPhone: "+18095550134",
    ...payment,
  })
}

const bookingRow = async (id: string) => {
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  return row
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-payment-actions-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  const shop = { timezone: "America/Santo_Domingo", currency: "DOP" }
  await db.insert(businesses).values([
    { id: "biz-mine", slug: "mine", name: "Mine", ownerId: "u1", ...shop },
    { id: "biz-other", slug: "theirs", name: "Theirs", ownerId: "other", ...shop },
  ])
  await db.insert(paymentMethods).values({
    id: "pm-theirs",
    businessId: "biz-other",
    type: "zelle",
    name: "Zelle",
    details: "theirs@example.com",
  })
  const zelle = { type: "zelle" as const, name: "Zelle", details: "pay@example.com" }
  await seedBooking("b-reported", "biz-mine", {
    paymentChoice: "now",
    paymentMethod: zelle,
    paymentStatus: "reported",
    paymentReference: "TX-1",
    paymentReportedAt: "2026-06-01T12:00:00.000Z",
  })
  await seedBooking("b-later", "biz-mine", {
    paymentChoice: "later",
    paymentStatus: "unpaid",
  })
  await seedBooking("b-untracked", "biz-mine")
  await seedBooking("b-theirs", "biz-other", {
    paymentChoice: "now",
    paymentMethod: zelle,
    paymentStatus: "reported",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a new business offers no way to pay and lets customers pay later", async () => {
  const { db } = await import("@/lib/db")
  const [business] = await db.select().from(businesses).where(eq(businesses.id, "biz-mine"))
  expect(business.payLater).toBe(true)
  const methods = await db.select().from(paymentMethods).where(eq(paymentMethods.businessId, "biz-mine"))
  expect(methods).toEqual([])
})

test("the owner adds, edits and removes a way to pay", async () => {
  const { db } = await import("@/lib/db")
  const added = await savePaymentMethod("biz-mine", null, {
    type: "bank_transfer",
    name: " Banco Popular ",
    details: " Account 123 ",
  })
  expect(added.ok).toBe(true)
  const id = added.ok ? added.id : ""
  let [row] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id))
  expect(row).toMatchObject({
    businessId: "biz-mine",
    type: "bank_transfer",
    name: "Banco Popular",
    details: "Account 123",
    position: 0,
  })
  await expect(
    savePaymentMethod("biz-mine", id, { type: "bank_transfer", name: "BHD", details: "Account 456" })
  ).resolves.toEqual({ ok: true, id })
  ;[row] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, id))
  expect(row).toMatchObject({ name: "BHD", details: "Account 456" })
  await expect(deletePaymentMethod("biz-mine", id)).resolves.toEqual({ ok: true })
  expect(await db.select().from(paymentMethods).where(eq(paymentMethods.id, id))).toEqual([])
})

test("a way with something missing is refused, naming the field", async () => {
  await expect(
    savePaymentMethod("biz-mine", null, { type: "card", name: "x", details: "y" })
  ).resolves.toEqual({ ok: false, error: "type" })
  await expect(
    savePaymentMethod("biz-mine", null, { type: "zelle", name: "", details: "y" })
  ).resolves.toEqual({ ok: false, error: "name" })
  await expect(
    savePaymentMethod("biz-mine", null, { type: "zelle", name: "Zelle", details: " " })
  ).resolves.toEqual({ ok: false, error: "details" })
})

test("another business's ways and settings cannot be touched", async () => {
  const { db } = await import("@/lib/db")
  const input = { type: "zelle", name: "Mine now", details: "hijack@example.com" }
  await expect(savePaymentMethod("biz-other", null, input)).resolves.toEqual({ ok: false, error: "not_found" })
  // Even through the owner's own business, another's way stays out of reach.
  await expect(savePaymentMethod("biz-mine", "pm-theirs", input)).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(deletePaymentMethod("biz-mine", "pm-theirs")).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(deletePaymentMethod("biz-other", "pm-theirs")).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(setPayLater("biz-other", false)).resolves.toEqual({ ok: false, error: "not_found" })
  const [theirs] = await db.select().from(paymentMethods).where(eq(paymentMethods.id, "pm-theirs"))
  expect(theirs).toMatchObject({ name: "Zelle", details: "theirs@example.com" })
  const [business] = await db.select().from(businesses).where(eq(businesses.id, "biz-other"))
  expect(business.payLater).toBe(true)
})

test("the owner turns paying later off and on", async () => {
  const { db } = await import("@/lib/db")
  await expect(setPayLater("biz-mine", false)).resolves.toEqual({ ok: true })
  let [business] = await db.select().from(businesses).where(eq(businesses.id, "biz-mine"))
  expect(business.payLater).toBe(false)
  await expect(setPayLater("biz-mine", true)).resolves.toEqual({ ok: true })
  ;[business] = await db.select().from(businesses).where(eq(businesses.id, "biz-mine"))
  expect(business.payLater).toBe(true)
})

test("the owner marks a reported booking paid, and not paid after all", async () => {
  await expect(setBookingPaid("biz-mine", "b-reported", true)).resolves.toEqual({ ok: true })
  let row = await bookingRow("b-reported")
  expect(row.paymentStatus).toBe("paid")
  expect(row.paymentPaidAt).not.toBeNull()
  // The reference the customer gave stays with a paid booking.
  expect(row.paymentReference).toBe("TX-1")
  await expect(setBookingPaid("biz-mine", "b-reported", false)).resolves.toEqual({ ok: true })
  row = await bookingRow("b-reported")
  expect(row).toMatchObject({
    paymentStatus: "unpaid",
    paymentPaidAt: null,
    paymentReference: null,
    paymentReportedAt: null,
  })
})

test("a pay-later booking can be marked paid at the visit", async () => {
  await expect(setBookingPaid("biz-mine", "b-later", true)).resolves.toEqual({ ok: true })
  expect((await bookingRow("b-later")).paymentStatus).toBe("paid")
})

test("a booking that tracks no payment stays that way", async () => {
  await expect(setBookingPaid("biz-mine", "b-untracked", true)).resolves.toEqual({ ok: false, error: "no_payment" })
  expect((await bookingRow("b-untracked")).paymentStatus).toBeNull()
})

test("another business's booking cannot be marked paid", async () => {
  await expect(setBookingPaid("biz-mine", "b-theirs", true)).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(setBookingPaid("biz-other", "b-theirs", true)).resolves.toEqual({ ok: false, error: "not_found" })
  expect((await bookingRow("b-theirs")).paymentStatus).toBe("reported")
})

test("the customer's bell hears once that the business confirmed the payment", async () => {
  const { db } = await import("@/lib/db")
  const { inAppNotifications } = await import("@/lib/db/schema")
  await seedBooking("b-account", "biz-mine", {
    customerUserId: "other",
    paymentChoice: "now",
    paymentStatus: "reported",
  })
  const bell = () =>
    db
      .select({
        kind: inAppNotifications.kind,
        audience: inAppNotifications.audience,
        bookingId: inAppNotifications.bookingId,
      })
      .from(inAppNotifications)
  await setBookingPaid("biz-mine", "b-account", true)
  expect(await bell()).toEqual([
    { kind: "clientPaid", audience: "client", bookingId: "b-account" },
  ])
  // Paid again, and back to not paid: nothing new.
  await setBookingPaid("biz-mine", "b-account", true)
  await setBookingPaid("biz-mine", "b-account", false)
  expect(await bell()).toHaveLength(1)
})
