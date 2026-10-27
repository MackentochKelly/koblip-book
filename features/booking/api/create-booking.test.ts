// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  bookings,
  businessHours,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
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
  })
  expect(result).toEqual({ status: "taken" })
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
  }
  await expect(createBooking({ ...valid, name: "   " })).resolves.toEqual({
    status: "invalid",
    field: "name",
  })
  await expect(createBooking({ ...valid, phone: "abc" })).resolves.toEqual({
    status: "invalid",
    field: "phone",
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
