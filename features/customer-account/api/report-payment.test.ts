// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { existsSync, readdirSync } from "node:fs"
import sharp from "sharp"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
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

const { replacePaymentProof, reportPayment } = await import("./report-payment")

let dir: string
let proofs: string
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

// A real small picture, as a phone would send.
async function picture(): Promise<File> {
  const bytes = await sharp({
    create: { width: 40, height: 60, channels: 3, background: "#2a6" },
  })
    .png()
    .toBuffer()
  return new File([new Uint8Array(bytes)], "paid.png", { type: "image/png" })
}

// "I've paid" as the form sends it; the shop asks for a picture, so one
// goes along unless the test leaves it out.
async function report(reference: unknown, withPicture = true) {
  const formData = new FormData()
  formData.set("bookingId", "bk")
  if (typeof reference === "string" || reference instanceof File)
    formData.set("reference", reference)
  if (withPicture) formData.set("file", await picture())
  return reportPayment(formData)
}

const stored = () => (existsSync(proofs) ? readdirSync(proofs) : [])

const payment = async () => {
  const [row] = await db
    .select({
      status: bookings.paymentStatus,
      reference: bookings.paymentReference,
      reportedAt: bookings.paymentReportedAt,
      paidAt: bookings.paymentPaidAt,
      proof: bookings.paymentProof,
    })
    .from(bookings)
  return row
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-report-payment-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  proofs = join(dir, "proofs")
  process.env.PAYMENT_PROOFS_DIR = proofs
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
  await db.update(businesses).set({ paymentProof: true })
  rmSync(proofs, { recursive: true, force: true })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("saying I've paid asks the business to check, and never marks it paid", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(report(" TX-77 ")).resolves.toEqual({ ok: true })
  const row = await payment()
  expect(row.status).toBe("reported")
  expect(row.reference).toBe("TX-77")
  expect(row.reportedAt).not.toBeNull()
  expect(row.paidAt).toBeNull()
})

test("the reference is optional", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(report("")).resolves.toEqual({ ok: true })
  expect(await payment()).toMatchObject({ status: "reported", reference: null })
})

test("signed out, nothing changes", async () => {
  await booked()
  await expect(report(null)).resolves.toEqual({ ok: false, error: "signedOut" })
  expect((await payment()).status).toBe("unpaid")
})

test("someone else's booking cannot be reported", async () => {
  await booked({ customerPhone: "+18095551111", customerKey: "p:18095551111" })
  signedIn.customer = ANA
  await expect(report(null)).resolves.toEqual({ ok: false, error: "notFound" })
  expect((await payment()).status).toBe("unpaid")
})

test("a paid booking is not sent back to be checked", async () => {
  await booked({ paymentStatus: "paid", paymentPaidAt: "2026-06-01T12:00:00.000Z" })
  signedIn.customer = ANA
  await expect(report("again")).resolves.toEqual({ ok: false, error: "notFound" })
  expect(await payment()).toMatchObject({ status: "paid", reference: null })
  // The picture sent with a refused report is not kept.
  expect(stored()).toEqual([])
})

test("a pay-later booking and one with no payment cannot be reported", async () => {
  await booked({ paymentChoice: "later", paymentMethod: null })
  signedIn.customer = ANA
  await expect(report(null)).resolves.toEqual({ ok: false, error: "notFound" })
  await db.delete(bookings)
  await booked({ paymentChoice: null, paymentMethod: null, paymentStatus: null })
  await expect(report(null)).resolves.toEqual({ ok: false, error: "notFound" })
  expect((await payment()).status).toBeNull()
})

test("a reference that is too long or not text is refused", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(report("r".repeat(81))).resolves.toEqual({ ok: false, error: "invalid" })
  await expect(report(await picture())).resolves.toEqual({ ok: false, error: "invalid" })
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
  await report("TX-77")
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
  await report(null)
  expect(await bell()).toEqual([])
})

test("a second report after a not-paid renews the one notice", async () => {
  await booked()
  signedIn.customer = ANA
  await report(null)
  await db.update(inAppNotifications).set({ readAt: new Date().toISOString() })
  await db.update(bookings).set({ paymentStatus: "unpaid" })
  await report(null)
  const rows = await bell()
  expect(rows).toHaveLength(1)
  expect(rows[0].readAt).toBeNull()
})

test("the picture is required while the business asks for one", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(report("TX-77", false)).resolves.toEqual({ ok: false, error: "proofMissing" })
  expect(await payment()).toMatchObject({ status: "unpaid", proof: null })
  expect(await bell()).toEqual([])
})

test("the picture is saved privately, as a clean JPEG, with the report", async () => {
  await booked()
  signedIn.customer = ANA
  await expect(report(null)).resolves.toEqual({ ok: true })
  const row = await payment()
  expect(row.status).toBe("reported")
  expect(row.proof).toMatch(/^[0-9a-f-]{36}\.jpg$/)
  expect(stored()).toEqual([row.proof])
  // Drawn again: a JPEG whatever was sent, with nothing written into it.
  const saved = await sharp(join(proofs, row.proof!)).metadata()
  expect(saved.format).toBe("jpeg")
  expect(saved.exif).toBeUndefined()
})

test("a file that is not a picture is refused", async () => {
  await booked()
  signedIn.customer = ANA
  const formData = new FormData()
  formData.set("bookingId", "bk")
  formData.set("file", new File(["not a picture"], "paid.png", { type: "image/png" }))
  await expect(reportPayment(formData)).resolves.toEqual({ ok: false, error: "wrong_type" })
  expect((await payment()).status).toBe("unpaid")
  expect(stored()).toEqual([])
})

test("a business that asks for no picture needs none, and keeps none", async () => {
  await db.update(businesses).set({ paymentProof: false }).where(eq(businesses.id, "biz"))
  await booked()
  signedIn.customer = ANA
  await expect(report(null, false)).resolves.toEqual({ ok: true })
  await db.update(bookings).set({ paymentStatus: "unpaid" })
  await expect(report(null)).resolves.toEqual({ ok: true })
  expect(await payment()).toMatchObject({ status: "reported", proof: null })
  expect(stored()).toEqual([])
})

test("the picture can be replaced until the business answers", async () => {
  await booked()
  signedIn.customer = ANA
  await report(null)
  const first = (await payment()).proof
  const formData = new FormData()
  formData.set("bookingId", "bk")
  formData.set("file", await picture())
  await expect(replacePaymentProof(formData)).resolves.toEqual({ ok: true })
  const second = (await payment()).proof
  expect(second).not.toBe(first)
  expect(stored()).toEqual([second])

  // Paid: locked.
  await db.update(bookings).set({ paymentStatus: "paid" })
  const again = new FormData()
  again.set("bookingId", "bk")
  again.set("file", await picture())
  await expect(replacePaymentProof(again)).resolves.toEqual({ ok: false, error: "notFound" })
  expect(stored()).toEqual([second])
})

test("someone else cannot replace the picture", async () => {
  await booked()
  signedIn.customer = ANA
  await report(null)
  const first = (await payment()).proof
  signedIn.customer = { userId: "c2", name: "Eva", phone: "+18095552222" }
  const formData = new FormData()
  formData.set("bookingId", "bk")
  formData.set("file", await picture())
  await expect(replacePaymentProof(formData)).resolves.toEqual({ ok: false, error: "notFound" })
  expect((await payment()).proof).toBe(first)
})
