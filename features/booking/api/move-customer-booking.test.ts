// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  expect,
  test,
  vi,
} from "vitest"
import { eq } from "drizzle-orm"
import {
  bookings,
  businessHours,
  businesses,
  inAppNotifications,
  notificationSends,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/google-calendar-sync", () => ({ requestGoogleSync: vi.fn() }))
const signedIn = vi.hoisted(() => ({
  customer: null as { userId: string; name: string; phone: string } | null,
}))
vi.mock("@/lib/customer-dal", () => ({
  getCustomer: async () => signedIn.customer,
}))

const { moveCustomerBooking } = await import("./move-customer-booking")

// Monday 2026-06-01 08:00 in Santo Domingo (UTC-4); open Mondays 09:00-18:00.
const NOW = Date.UTC(2026, 5, 1, 12, 0)
const ANA = { userId: "c1", name: "Ana", phone: "+18095550000" }

let dir: string

async function booking(
  id: string,
  startAt: string,
  values: Partial<typeof bookings.$inferInsert> = {}
) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id,
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt,
    endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(),
    customerName: "Ana",
    customerPhone: ANA.phone,
    customerKey: "p:18095550000",
    status: "confirmed",
    ...values,
  })
}

async function row(id: string) {
  const { db } = await import("@/lib/db")
  const [found] = await db.select().from(bookings).where(eq(bookings.id, id))
  return found
}

const move = (bookingId: unknown, date: unknown, time: unknown) =>
  moveCustomerBooking({ bookingId, date, time })

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-customer-move-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({
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
    seats: 1,
    ownerId: "u1",
  })
  await db.insert(businessHours).values({
    id: "biz-h",
    businessId: "biz",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
})

afterAll(async () => {
  const { db } = await import("@/lib/db")
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  signedIn.customer = ANA
})

afterEach(async () => {
  vi.restoreAllMocks()
  const { db } = await import("@/lib/db")
  await db.delete(inAppNotifications)
  await db.delete(notificationSends)
  await db.delete(bookings)
})

test("moves the customer's booking to a free time and tells the owner", async () => {
  const { db } = await import("@/lib/db")
  await booking("bk", "2026-06-01T14:00:00.000Z")
  await db.insert(notificationSends).values({
    businessId: "biz",
    bookingId: "bk",
    message: "reminder",
    reminderMinutes: 30,
    dueAt: "2026-06-01T13:30:00.000Z",
    state: "pending",
  })
  expect(await move("bk", "2026-06-01", "11:00")).toEqual({ status: "moved" })
  const moved = await row("bk")
  expect(moved.startAt).toBe("2026-06-01T15:00:00.000Z")
  expect(moved.endAt).toBe("2026-06-01T15:30:00.000Z")
  expect(moved.moves).toBe(1)
  const [reminder] = await db.select().from(notificationSends)
  expect(reminder).toMatchObject({ state: "skipped", reason: "moved" })
  const bell = await db
    .select({ kind: inAppNotifications.kind })
    .from(inAppNotifications)
  expect(bell).toEqual([{ kind: "customerMoved" }])
})

test("refuses a time that is closed or taken", async () => {
  await booking("bk", "2026-06-01T14:00:00.000Z")
  await booking("other", "2026-06-01T16:00:00.000Z", {
    customerKey: "p:18095551111",
    customerPhone: "+18095551111",
  })
  expect(await move("bk", "2026-06-01", "19:00")).toEqual({ status: "taken" })
  expect(await move("bk", "2026-06-01", "12:00")).toEqual({ status: "taken" })
  expect((await row("bk")).moves).toBe(0)
})

test("moves only the signed-in customer's own booking still ahead", async () => {
  await booking("bk", "2026-06-01T14:00:00.000Z")
  signedIn.customer = null
  expect(await move("bk", "2026-06-01", "11:00")).toEqual({
    status: "signedOut",
  })
  signedIn.customer = { ...ANA, phone: "+18095551111" }
  expect(await move("bk", "2026-06-01", "11:00")).toEqual({
    status: "notFound",
  })
  signedIn.customer = ANA
  expect(await move("bk", "June 1", "11:00")).toEqual({ status: "invalid" })
  expect(await move(7, "2026-06-01", "11:00")).toEqual({ status: "invalid" })
  await booking("past", "2026-06-01T11:00:00.000Z")
  expect(await move("past", "2026-06-01", "11:00")).toEqual({
    status: "notFound",
  })
  expect((await row("bk")).moves).toBe(0)
})
