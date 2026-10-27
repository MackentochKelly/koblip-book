// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import {
  addonGroups,
  addonOptions,
  bookingAddons,
  bookings,
  businessHours,
  businesses,
  serviceAddonGroups,
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
const { getAvailability } = await import("./get-availability")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function seedShop() {
  const { db } = await import("@/lib/db")
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz-addon",
    slug: "addon-shop",
    name: "Addon Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    status: "operational",
    seats: 1,
    ownerId: "u1",
  })
  await db.insert(businessHours).values({
    id: "biz-addon-h",
    businessId: "biz-addon",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "12:00",
  })
  await db.insert(services).values([
    { id: "svc", businessId: "biz-addon", name: "Cut", durationMinutes: 30, priceMinor: 1000, position: 0 },
    { id: "svc2", businessId: "biz-addon", name: "Color", durationMinutes: 30, priceMinor: null, position: 1 },
    { id: "svc3", businessId: "biz-addon", name: "Consult", durationMinutes: 30, priceMinor: null, position: 2 },
  ])
  await db.insert(teamMembers).values({
    id: "tm",
    businessId: "biz-addon",
    name: "Ana",
    position: 0,
  })
  await db.insert(addonGroups).values([
    { id: "g1", businessId: "biz-addon", name: "Extras", prompt: "Choose extras", minSelect: 0, maxSelect: null, position: 0 },
    { id: "g2", businessId: "biz-addon", name: "Finish", prompt: "Pick one", minSelect: 1, maxSelect: 1, position: 1 },
  ])
  await db.insert(addonOptions).values([
    { id: "o1", businessId: "biz-addon", groupId: "g1", name: "Conditioner", description: "Nice", priceMinor: 500, durationMinutes: 15, position: 0 },
    { id: "o2", businessId: "biz-addon", groupId: "g1", name: "Head massage", description: null, priceMinor: null, durationMinutes: 0, position: 1 },
    { id: "o3", businessId: "biz-addon", groupId: "g2", name: "Gel", description: null, priceMinor: 100, durationMinutes: 0, position: 0 },
  ])
  await db.insert(serviceAddonGroups).values([
    { businessId: "biz-addon", serviceId: "svc", groupId: "g1", position: 0 },
    { businessId: "biz-addon", serviceId: "svc2", groupId: "g2", position: 0 },
  ])
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-booking-addons-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await seedShop()
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

test("availability shrinks with extra minutes and rejects bad add-ons", async () => {
  const plain = await getAvailability("addon-shop", "svc", null, [])
  expect(plain?.days[0].times).toContain("11:30")
  const withAddon = await getAvailability("addon-shop", "svc", null, ["o1"])
  expect(withAddon?.days[0].times).toContain("10:00")
  expect(withAddon?.days[0].times).not.toContain("11:30")
  expect(withAddon!.days[0].times.length).toBeLessThan(
    plain!.days[0].times.length
  )
  // A free add-on that adds no time changes nothing.
  const free = await getAvailability("addon-shop", "svc", null, ["o2"])
  expect(free).toEqual(plain)
  // Unknown ids and options from another service's group are invalid.
  expect(await getAvailability("addon-shop", "svc", null, ["nope"])).toBeNull()
  expect(await getAvailability("addon-shop", "svc", null, ["o3"])).toBeNull()
  expect(await getAvailability("addon-shop", "svc", null, ["o1", "o1"])).toBeNull()
})

test("createBooking stores copies and totals", async () => {
  const result = await createBooking({
    slug: "addon-shop",
    serviceId: "svc",
    teamMemberId: null,
    addonIds: ["o1", "o2"],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
  })
  expect(result.status).toBe("booked")
  if (result.status !== "booked") {
    return
  }
  expect(result.booking.durationMinutes).toBe(45)
  expect(result.booking.priceMinor).toBe(1500)
  expect(result.booking.addons).toEqual([
    { name: "Conditioner", priceMinor: 500, durationMinutes: 15 },
    { name: "Head massage", priceMinor: null, durationMinutes: 0 },
  ])
  const { db } = await import("@/lib/db")
  const copies = await db
    .select()
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, result.booking.id))
  expect(
    copies.map((row) => [
      row.optionId,
      row.name,
      row.priceMinor,
      row.durationMinutes,
      row.position,
    ])
  ).toEqual([
    ["o1", "Conditioner", 500, 15, 0],
    ["o2", "Head massage", null, 0, 1],
  ])
  const [booking] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, result.booking.id))
  expect(booking).toMatchObject({ durationMinutes: 45, priceMinor: 1500 })
})

test("createBooking rejects bad add-ons and enforces minSelect", async () => {
  const base = {
    slug: "addon-shop",
    serviceId: "svc",
    teamMemberId: null as string | null,
    date: "2026-06-01",
    time: "09:00",
    name: "Luis",
    phone: "+18095550134",
  }
  await expect(
    createBooking({ ...base, addonIds: ["nope"] })
  ).resolves.toEqual({ status: "invalid", field: "addons" })
  await expect(
    createBooking({ ...base, addonIds: ["o1", "o1"] })
  ).resolves.toEqual({ status: "invalid", field: "addons" })
  // o3 belongs to svc2's group, not svc's.
  await expect(
    createBooking({ ...base, addonIds: ["o3"] })
  ).resolves.toEqual({ status: "invalid", field: "addons" })
  // svc2's group needs at least one pick.
  await expect(
    createBooking({ ...base, serviceId: "svc2", addonIds: [] })
  ).resolves.toEqual({ status: "invalid", field: "addons" })
})

test("totals stay null only when nothing has a price", async () => {
  const priced = await createBooking({
    slug: "addon-shop",
    serviceId: "svc2",
    teamMemberId: null,
    addonIds: ["o3"],
    date: "2026-06-01",
    time: "09:00",
    name: "Luis",
    phone: "+18095550134",
  })
  expect(priced).toMatchObject({
    status: "booked",
    booking: { durationMinutes: 30, priceMinor: 100 },
  })
  const free = await createBooking({
    slug: "addon-shop",
    serviceId: "svc3",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "09:30",
    name: "Marta",
    phone: "+18095550135",
  })
  expect(free).toMatchObject({
    status: "booked",
    booking: { durationMinutes: 30, priceMinor: null, addons: [] },
  })
})

test("createOwnerBooking stores add-ons and checks conflicts on the total length", async () => {
  const booked = await createOwnerBooking({
    businessId: "biz-addon",
    serviceId: "svc",
    teamMemberId: null,
    addonIds: ["o1"],
    date: "2026-06-01",
    time: "10:45",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: false,
  })
  expect(booked.status).toBe("booked")
  if (booked.status !== "booked") {
    return
  }
  const { db } = await import("@/lib/db")
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, booked.bookingId))
  expect(row).toMatchObject({ durationMinutes: 45, priceMinor: 1500 })
  const copies = await db
    .select()
    .from(bookingAddons)
    .where(eq(bookingAddons.bookingId, booked.bookingId))
  expect(copies.map((copy) => copy.name)).toEqual(["Conditioner"])

  await expect(
    createOwnerBooking({
      businessId: "biz-addon",
      serviceId: "svc",
      teamMemberId: null,
      addonIds: ["nope"],
      date: "2026-06-01",
      time: "10:00",
      name: "Luis",
      phone: "+18095550134",
      note: null,
      allowConflict: false,
    })
  ).resolves.toEqual({ status: "invalid", field: "addons" })

  // 11:30 + 45 minutes runs past closing, but the plain 30 fits.
  await expect(
    createOwnerBooking({
      businessId: "biz-addon",
      serviceId: "svc",
      teamMemberId: null,
      addonIds: ["o1"],
      date: "2026-06-01",
      time: "11:30",
      name: "Luis",
      phone: "+18095550134",
      note: null,
      allowConflict: false,
    })
  ).resolves.toEqual({ status: "conflict", reason: "closed" })
  const fits = await createOwnerBooking({
    businessId: "biz-addon",
    serviceId: "svc",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "11:30",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: false,
  })
  expect(fits.status).toBe("booked")
})
