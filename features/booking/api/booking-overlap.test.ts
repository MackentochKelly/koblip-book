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
  services,
  teamMembers,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { createBooking } = await import("./create-booking")
const { createOwnerBooking } = await import("./create-owner-booking")
const { saveAll } = await import("@/lib/db/save-all")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

// One person, one seat: each time can be booked once.
async function seedShop(id: string) {
  const { db } = await import("@/lib/db")
  await db.insert(businesses).values({
    id,
    slug: id,
    name: "Busy Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    status: "operational",
    seats: 1,
    ownerId: "u1",
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
  return { serviceId: `${id}-svc` }
}

function customer(slug: string, serviceId: string, time: string) {
  return createBooking({
    slug,
    serviceId,
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time,
    name: "Luis",
    phone: "+18095550134",
  })
}

async function bookingCount(businessId: string) {
  const { db } = await import("@/lib/db")
  const rows = await db
    .select({ id: bookings.id })
    .from(bookings)
    .where(eq(bookings.businessId, businessId))
  return rows.length
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-overlap-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: true,
  })
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

test("two customers asking for the last free time at once: one gets it", async () => {
  const { serviceId } = await seedShop("last-slot")

  const results = await Promise.all([
    customer("last-slot", serviceId, "10:00"),
    customer("last-slot", serviceId, "10:00"),
  ])

  expect(results.map((result) => result.status).sort()).toEqual([
    "booked",
    "taken",
  ])
  expect(await bookingCount("last-slot")).toBe(1)
})

test("customers booking different times at once all get them", async () => {
  const { serviceId } = await seedShop("many-slots")

  const results = await Promise.all(
    ["10:00", "11:00", "12:00"].map((time) =>
      customer("many-slots", serviceId, time)
    )
  )

  expect(results.map((result) => result.status)).toEqual([
    "booked",
    "booked",
    "booked",
  ])
  expect(await bookingCount("many-slots")).toBe(3)
})

test("a customer and the owner asking for the same time at once: one gets it", async () => {
  const { serviceId } = await seedShop("shared-slot")

  const [online, owner] = await Promise.all([
    customer("shared-slot", serviceId, "10:00"),
    createOwnerBooking({
      businessId: "shared-slot",
      serviceId,
      teamMemberId: null,
      addonIds: [],
      date: "2026-06-01",
      time: "10:00",
      name: "Walk-in",
      phone: null,
      note: null,
      allowConflict: false,
    }),
  ])

  // Whoever came second gets its usual answer: taken online, busy for
  // the owner.
  const outcomes = [online, owner].map((result) =>
    result.status === "conflict" ? `conflict:${result.reason}` : result.status
  )
  expect(
    [
      ["booked", "conflict:busy"],
      ["taken", "booked"],
    ].map((pair) => pair.join())
  ).toContain(outcomes.join())
  expect(await bookingCount("shared-slot")).toBe(1)
})

test("other saves keep working while bookings are being made", async () => {
  const { serviceId } = await seedShop("busy-owner")
  const { db } = await import("@/lib/db")

  const results = await Promise.all([
    customer("busy-owner", serviceId, "10:00"),
    saveAll([
      db
        .update(services)
        .set({ description: "Fresh" })
        .where(eq(services.id, serviceId)),
    ]),
    customer("busy-owner", serviceId, "11:00"),
    saveAll([
      db
        .update(businesses)
        .set({ description: "Open late" })
        .where(eq(businesses.id, "busy-owner")),
    ]),
  ])

  expect(results[0]).toMatchObject({ status: "booked" })
  expect(results[2]).toMatchObject({ status: "booked" })
  const [shop] = await db
    .select({ description: businesses.description })
    .from(businesses)
    .where(eq(businesses.id, "busy-owner"))
  expect(shop.description).toBe("Open late")
})
