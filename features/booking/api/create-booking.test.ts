// @vitest-environment node
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import sharp from "sharp"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  bookings,
  businessHours,
  businessPolicyPoints,
  businesses,
  googleCalendarBusy,
  googleCalendarConnections,
  inAppNotifications,
  services,
  teamMembers,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
// Customers book signed out, unless a test signs one in.
const signedIn = {
  session: null as { userId: string; isGuest: boolean } | null,
}
vi.mock("@/lib/dal", () => ({ getSession: async () => signedIn.session }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const { createBooking } = await import("./create-booking")

// Monday 2026-06-01 08:00 in Santo Domingo; cutoff 09:00 local.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function seedShop(slug: string, id: string) {
  const { db } = await import("@/lib/db")
  await db.insert(businesses).values({
    id,
    slug,
    name: "Book Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    status: "operational",
    seats: 1,
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
    priceMinor: 1000,
    position: 0,
  })
  await db.insert(teamMembers).values({
    id: `${id}-tm`,
    businessId: id,
    name: "Ana",
    position: 0,
  })
  return { serviceId: `${id}-svc`, teamId: `${id}-tm` }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-booking-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.PAYMENT_PROOFS_DIR = join(dir, "proofs")
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
})

afterEach(() => {
  vi.restoreAllMocks()
  signedIn.session = null
})

test("books a valid slot and picks the free team member", async () => {
  const { serviceId } = await seedShop("book-shop", "biz-book")
  const result = await createBooking({
    slug: "book-shop",
    serviceId,
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "  Luis  ",
    phone: "+18095550134",
    email: "ana@example.com",
  })
  expect(result).toMatchObject({
    status: "booked",
    booking: {
      businessName: "Book Shop",
      address: null,
      timeZone: "America/Santo_Domingo",
      serviceName: "Cut",
      teamMemberName: "Ana",
      durationMinutes: 30,
      priceMinor: 1000,
      currency: "DOP",
      date: "2026-06-01",
      time: "10:00",
    },
  })
  // The owner's bell hears it, saved with the booking (N2).
  const { db } = await import("@/lib/db")
  const notices = await db.select().from(inAppNotifications)
  expect(notices.map(({ businessId, kind, data, link }) => ({ businessId, kind, data, link }))).toEqual([
    {
      businessId: "biz-book",
      kind: "newBooking",
      data: { customerName: "Luis", serviceName: "Cut", startAt: "2026-06-01T14:00:00.000Z" },
      link: "/dashboard/biz-book",
    },
  ])
})

test("returns taken when the slot filled up", async () => {
  const { serviceId, teamId } = await seedShop("taken-shop", "biz-taken")
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id: "existing",
    businessId: "biz-taken",
    serviceId,
    teamMemberId: teamId,
    serviceName: "Cut",
    teamMemberName: "Ana",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T14:30:00.000Z",
    customerName: "First",
    customerPhone: "+18095550000",
    status: "confirmed",
  })
  const result = await createBooking({
    slug: "taken-shop",
    serviceId,
    teamMemberId: teamId,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    email: "ana@example.com",
  })
  expect(result).toEqual({ status: "taken" })
})

test("returns taken when the team member is busy in their Google Calendar", async () => {
  const { serviceId, teamId } = await seedShop("google-shop", "biz-google")
  const { db } = await import("@/lib/db")
  const [connection] = await db
    .insert(googleCalendarConnections)
    .values({
      businessId: "biz-google",
      teamMemberId: teamId,
      googleEmail: "ana@gmail.com",
      scopes: "",
    })
    .returning()
  await db.insert(googleCalendarBusy).values({
    connectionId: connection!.id,
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T15:00:00.000Z",
  })
  const book = (time: string) =>
    createBooking({
      slug: "google-shop",
      serviceId,
      teamMemberId: null,
      addonIds: [],
      date: "2026-06-01",
      time,
      name: "Luis",
      phone: "+18095550134",
      email: "ana@example.com",
    })
  await expect(book("10:30")).resolves.toEqual({ status: "taken" })
  await expect(book("11:00")).resolves.toMatchObject({ status: "booked" })
})

test("cancelled bookings do not block the slot", async () => {
  const { serviceId, teamId } = await seedShop("cancel-shop", "biz-cancel")
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id: "cancelled",
    businessId: "biz-cancel",
    serviceId,
    teamMemberId: teamId,
    serviceName: "Cut",
    teamMemberName: "Ana",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T14:30:00.000Z",
    customerName: "Ghost",
    customerPhone: "+18095550000",
    status: "cancelled",
  })
  const result = await createBooking({
    slug: "cancel-shop",
    serviceId,
    teamMemberId: teamId,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    email: "ana@example.com",
  })
  expect(result.status).toBe("booked")
})

test("validation paths", async () => {
  const { serviceId, teamId } = await seedShop("valid-shop", "biz-valid")
  const valid = {
    slug: "valid-shop",
    serviceId,
    teamMemberId: teamId,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    email: "ana@example.com",
  }
  await expect(createBooking({ ...valid, name: "   " })).resolves.toEqual({
    status: "invalid",
    field: "name",
  })
  await expect(createBooking({ ...valid, phone: "abc" })).resolves.toEqual({
    status: "invalid",
    field: "phone",
  })
  await expect(createBooking({ ...valid, email: "ana@" })).resolves.toEqual({
    status: "invalid",
    field: "email",
  })
  await expect(
    createBooking({ ...valid, date: "06-01-2026" })
  ).resolves.toEqual({ status: "invalid", field: "time" })
  await expect(
    createBooking({ ...valid, time: "10am" })
  ).resolves.toEqual({ status: "invalid", field: "time" })
  await expect(
    createBooking({ ...valid, serviceId: "nope" })
  ).resolves.toEqual({ status: "invalid", field: "service" })
  await expect(
    createBooking({ ...valid, teamMemberId: "nope" })
  ).resolves.toEqual({ status: "invalid", field: "teamMember" })
})

test("a business with policies books only once they are agreed to", async () => {
  const { serviceId } = await seedShop("rules-shop", "biz-rules")
  const { db } = await import("@/lib/db")
  await db.insert(businessPolicyPoints).values({
    businessId: "biz-rules",
    icon: "clock",
    title: "Arriving",
    body: "Come five minutes early.",
    position: 0,
  })
  const input = {
    slug: "rules-shop",
    serviceId,
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "11:00",
    name: "Luis",
    phone: "+18095550134",
    email: "ana@example.com",
  }
  expect(await createBooking(input)).toEqual({
    status: "invalid",
    field: "policies",
  })
  expect(await createBooking({ ...input, acceptedPolicies: false })).toEqual({
    status: "invalid",
    field: "policies",
  })
  const result = await createBooking({ ...input, acceptedPolicies: true })
  expect(result.status).toBe("booked")
  const [row] = await db
    .select({ policiesAcceptedAt: bookings.policiesAcceptedAt })
    .from(bookings)
    .where(eq(bookings.businessId, "biz-rules"))
  expect(row.policiesAcceptedAt).toBe(new Date(NOW).toISOString())
})

test("a business without policies books without the box, and saves no agreement", async () => {
  const { serviceId } = await seedShop("plain-shop", "biz-plain")
  const result = await createBooking({
    slug: "plain-shop",
    serviceId,
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "12:00",
    name: "Luis",
    phone: "+18095550134",
    email: "ana@example.com",
  })
  expect(result.status).toBe("booked")
  const { db } = await import("@/lib/db")
  const [row] = await db
    .select({ policiesAcceptedAt: bookings.policiesAcceptedAt })
    .from(bookings)
    .where(eq(bookings.businessId, "biz-plain"))
  expect(row.policiesAcceptedAt).toBeNull()
})

test("signed in, the booking is the account's; signed out, it gets a one-time claim", async () => {
  const { serviceId } = await seedShop("claim-shop", "biz-claim")
  const { db } = await import("@/lib/db")
  const { user } = await import("@/lib/db/schema")
  await db.insert(user).values({
    id: "u-ana",
    name: "Ana",
    email: "ana@example.test",
    emailVerified: true,
  })
  const book = (time: string) =>
    createBooking({
      slug: "claim-shop",
      serviceId,
      teamMemberId: null,
      addonIds: [],
      date: "2026-06-01",
      time,
      name: "Ana",
      phone: "+18095550134",
      email: "ana@example.com",
    })

  signedIn.session = { userId: "u-ana", isGuest: false }
  const mine = await book("10:00")
  expect(mine).toMatchObject({ status: "booked", claimToken: null })

  signedIn.session = null
  const theirs = await book("11:00")
  expect(theirs).toMatchObject({ status: "booked", claimToken: expect.any(String) })

  if (mine.status !== "booked" || theirs.status !== "booked") return
  const { bookingClaimHash } = await import("@/lib/booking-claim")
  const rows = await db
    .select({ id: bookings.id, customerUserId: bookings.customerUserId, claimTokenHash: bookings.claimTokenHash })
    .from(bookings)
    .where(eq(bookings.businessId, "biz-claim"))
  expect(rows).toEqual(
    expect.arrayContaining([
      { id: mine.booking.id, customerUserId: "u-ana", claimTokenHash: null },
      {
        id: theirs.booking.id,
        customerUserId: null,
        // Only the secret's hash is stored, never the secret.
        claimTokenHash: bookingClaimHash(theirs.claimToken!),
      },
    ])
  )
})

// Paying outside the app (lib/payment-rules.ts).
// asksProof: the business asks for payment proof (off unless a test is
// about it).
async function seedPayShop(
  slug: string,
  id: string,
  payLater: boolean,
  asksProof = false
) {
  const { db } = await import("@/lib/db")
  const { paymentMethods } = await import("@/lib/db/schema")
  const shop = await seedShop(slug, id)
  await db
    .update(businesses)
    .set({ payLater, paymentProof: asksProof })
    .where(eq(businesses.id, id))
  await db.insert(paymentMethods).values({
    id: `${id}-zelle`,
    businessId: id,
    type: "zelle",
    name: "Zelle",
    details: "pay@shop.example",
  })
  return shop
}

const payInput = (slug: string, serviceId: string, time: string) => ({
  slug,
  serviceId,
  teamMemberId: null,
  addonIds: [],
  date: "2026-06-01",
  time,
  name: "Luis",
  phone: "+18095550134",
  email: "ana@example.com",
})

test("a business with no way to pay books as before and tracks no payment", async () => {
  const { serviceId } = await seedShop("nopay-shop", "biz-nopay")
  const result = await createBooking({
    ...payInput("nopay-shop", serviceId, "10:00"),
    // Sent anyway: ignored where the business offers nothing.
    payment: { choice: "now", methodId: "anything" },
  })
  expect(result).toMatchObject({ status: "booked", booking: { payment: null } })
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.businessId, "biz-nopay"))
  expect(row).toMatchObject({ paymentChoice: null, paymentMethod: null, paymentStatus: null })
})

test("with ways to pay, a booking needs a choice", async () => {
  const { serviceId } = await seedPayShop("pay-need", "biz-pay-need", true)
  await expect(createBooking(payInput("pay-need", serviceId, "10:00"))).resolves.toEqual({
    status: "invalid",
    field: "payment",
  })
  const { db } = await import("@/lib/db")
  expect(await db.select().from(bookings).where(eq(bookings.businessId, "biz-pay-need"))).toEqual([])
})

test("choosing a way books unpaid and gives the booker its instructions", async () => {
  const { serviceId } = await seedPayShop("pay-now", "biz-pay-now", true)
  const result = await createBooking({
    ...payInput("pay-now", serviceId, "10:00"),
    payment: { choice: "now", methodId: "biz-pay-now-zelle" },
  })
  expect(result).toMatchObject({
    status: "booked",
    booking: {
      payment: {
        choice: "now",
        method: { type: "zelle", name: "Zelle", details: "pay@shop.example" },
        status: "unpaid",
        reference: null,
        hasProof: false,
      },
    },
  })
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.businessId, "biz-pay-now"))
  expect(row).toMatchObject({
    paymentChoice: "now",
    paymentMethod: { type: "zelle", name: "Zelle", details: "pay@shop.example" },
    paymentStatus: "unpaid",
    paymentReference: null,
    paymentReportedAt: null,
    paymentPaidAt: null,
  })
})

test("a customer cannot book as already paid", async () => {
  const { serviceId } = await seedPayShop("pay-claim", "biz-pay-claim", true)
  const result = await createBooking({
    ...payInput("pay-claim", serviceId, "10:00"),
    payment: { choice: "now", methodId: "biz-pay-claim-zelle", status: "paid" } as never,
  })
  expect(result.status).toBe("booked")
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.businessId, "biz-pay-claim"))
  expect(row.paymentStatus).toBe("unpaid")
  expect(row.paymentPaidAt).toBeNull()
})

test("another business's way to pay is refused", async () => {
  await seedPayShop("pay-a", "biz-pay-a", true)
  const { serviceId } = await seedPayShop("pay-b", "biz-pay-b", true)
  await expect(
    createBooking({
      ...payInput("pay-b", serviceId, "10:00"),
      payment: { choice: "now", methodId: "biz-pay-a-zelle" },
    })
  ).resolves.toEqual({ status: "invalid", field: "payment" })
})

test("paying later books only where the business allows it", async () => {
  const allowed = await seedPayShop("pay-later-on", "biz-later-on", true)
  await expect(
    createBooking({ ...payInput("pay-later-on", allowed.serviceId, "10:00"), payment: { choice: "later" } })
  ).resolves.toMatchObject({
    status: "booked",
    booking: { payment: { choice: "later", method: null, status: "unpaid" } },
  })
  const refused = await seedPayShop("pay-later-off", "biz-later-off", false)
  await expect(
    createBooking({ ...payInput("pay-later-off", refused.serviceId, "10:00"), payment: { choice: "later" } })
  ).resolves.toEqual({ status: "invalid", field: "payment" })
})

// Payment proof on the pay step (docs/plans/payment-proof.md, PP10).
const storedProofs = () => {
  const folder = process.env.PAYMENT_PROOFS_DIR as string
  return existsSync(folder) ? readdirSync(folder) : []
}

// A real small picture in a form, as the pay step sends it.
async function proofForm(): Promise<FormData> {
  const bytes = await sharp({
    create: { width: 40, height: 60, channels: 3, background: "#2a6" },
  })
    .png()
    .toBuffer()
  const form = new FormData()
  form.set("file", new File([new Uint8Array(bytes)], "paid.png", { type: "image/png" }))
  return form
}

test("a business that asks for payment proof is not booked to pay now without it", async () => {
  const { serviceId } = await seedPayShop("proof-need", "biz-proof-need", true, true)
  const input = {
    ...payInput("proof-need", serviceId, "10:00"),
    payment: { choice: "now" as const, methodId: "biz-proof-need-zelle" },
  }
  await expect(createBooking(input)).resolves.toEqual({
    status: "invalid",
    field: "proof",
    error: "missing",
  })
  const notPicture = new FormData()
  notPicture.set("file", new File(["hello"], "paid.png", { type: "image/png" }))
  await expect(createBooking(input, notPicture)).resolves.toEqual({
    status: "invalid",
    field: "proof",
    error: "wrong_type",
  })
  const { db } = await import("@/lib/db")
  expect(await db.select().from(bookings).where(eq(bookings.businessId, "biz-proof-need"))).toEqual([])
  expect(storedProofs()).toEqual([])
})

test("with its proof, the booking starts as reported and the owner hears of both", async () => {
  const { serviceId } = await seedPayShop("proof-ok", "biz-proof-ok", true, true)
  const result = await createBooking(
    {
      ...payInput("proof-ok", serviceId, "10:00"),
      payment: { choice: "now", methodId: "biz-proof-ok-zelle" },
    },
    await proofForm()
  )
  expect(result).toMatchObject({
    status: "booked",
    booking: { payment: { choice: "now", status: "reported", hasProof: true } },
  })
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.businessId, "biz-proof-ok"))
  expect(row).toMatchObject({
    paymentStatus: "reported",
    paymentReportedAt: new Date(NOW).toISOString(),
    paymentPaidAt: null,
  })
  expect(storedProofs()).toEqual([row.paymentProof])
  const bell = await db
    .select({ kind: inAppNotifications.kind })
    .from(inAppNotifications)
    .where(eq(inAppNotifications.businessId, "biz-proof-ok"))
  expect(bell.map(({ kind }) => kind).sort()).toEqual(["customerPaid", "newBooking"])
  rmSync(process.env.PAYMENT_PROOFS_DIR as string, { recursive: true, force: true })
})

test("paying later needs no proof, and a proof for a taken time is not kept", async () => {
  const { serviceId } = await seedPayShop("proof-later", "biz-proof-later", true, true)
  await expect(
    createBooking({
      ...payInput("proof-later", serviceId, "10:00"),
      payment: { choice: "later" },
    })
  ).resolves.toMatchObject({
    status: "booked",
    booking: { payment: { choice: "later", status: "unpaid", hasProof: false } },
  })
  await expect(
    createBooking(
      {
        ...payInput("proof-later", serviceId, "10:00"),
        payment: { choice: "now", methodId: "biz-proof-later-zelle" },
      },
      await proofForm()
    )
  ).resolves.toEqual({ status: "taken" })
  expect(storedProofs()).toEqual([])
})
