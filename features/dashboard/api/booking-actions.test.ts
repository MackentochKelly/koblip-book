// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { bookings, businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { setBookingStatus } = await import("./booking-actions")

let closeDb: () => void
let dir: string

async function seedBooking(
  id: string,
  businessId: string,
  startAt: string,
  status: string
) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id,
    businessId,
    serviceId: null,
    teamMemberId: null,
    serviceName: "Cut",
    teamMemberName: null,
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    startAt,
    endAt: "2020-01-06T14:30:00.000Z",
    customerName: "Luis",
    customerPhone: "+18095550134",
    status,
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-booking-status-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-status",
      slug: "status-shop",
      name: "Status Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    },
    {
      id: "biz-other",
      slug: "other-shop",
      name: "Other Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "other",
    },
  ])
  await seedBooking("b-past", "biz-status", "2020-01-06T14:00:00.000Z", "confirmed")
  await seedBooking("b-future", "biz-status", "2099-01-05T14:00:00.000Z", "confirmed")
  await seedBooking("b-cancelled", "biz-status", "2020-01-06T14:00:00.000Z", "cancelled")
  await seedBooking("b-theirs", "biz-other", "2020-01-06T14:00:00.000Z", "confirmed")
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function statusOf(id: string) {
  const { db } = await import("@/lib/db")
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  return row.status
}

test("completes a past booking and confirmed undoes it", async () => {
  await expect(
    setBookingStatus("biz-status", "b-past", "completed")
  ).resolves.toEqual({ ok: true })
  await expect(statusOf("b-past")).resolves.toBe("completed")
  await expect(
    setBookingStatus("biz-status", "b-past", "confirmed")
  ).resolves.toEqual({ ok: true })
  await expect(statusOf("b-past")).resolves.toBe("confirmed")
})

test("future bookings cannot be completed or marked no-show", async () => {
  await expect(
    setBookingStatus("biz-status", "b-future", "completed")
  ).resolves.toEqual({ ok: false, error: "not_started" })
  await expect(
    setBookingStatus("biz-status", "b-future", "no_show")
  ).resolves.toEqual({ ok: false, error: "not_started" })
  await expect(statusOf("b-future")).resolves.toBe("confirmed")
})

test("cancelled bookings cannot change", async () => {
  await expect(
    setBookingStatus("biz-status", "b-cancelled", "completed")
  ).resolves.toEqual({ ok: false, error: "cancelled" })
  await expect(
    setBookingStatus("biz-status", "b-cancelled", "confirmed")
  ).resolves.toEqual({ ok: false, error: "cancelled" })
})

test("unknown bookings and other businesses are not found", async () => {
  await expect(
    setBookingStatus("biz-status", "nope", "completed")
  ).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(
    setBookingStatus("biz-status", "b-theirs", "completed")
  ).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(
    setBookingStatus("biz-other", "b-theirs", "completed")
  ).resolves.toEqual({ ok: false, error: "not_found" })
})
