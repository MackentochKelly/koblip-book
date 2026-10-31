// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import {
  bookings,
  businessHours,
  businesses,
  services,
  teamMemberServices,
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

const { createOwnerBooking } = await import("./create-owner-booking")

// Monday 2026-06-01 08:00 in Santo Domingo.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function seedShop() {
  const { db } = await import("@/lib/db")
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-owner",
      slug: "owner-shop",
      name: "Owner Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      status: "operational",
      seats: 1,
      ownerId: "u1",
    },
    {
      id: "biz-theirs",
      slug: "their-shop",
      name: "Their Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      status: "operational",
      seats: 1,
      ownerId: "other",
    },
  ])
  await db.insert(businessHours).values({
    id: "biz-owner-h",
    businessId: "biz-owner",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
  await db.insert(services).values([
    {
      id: "svc-all",
      businessId: "biz-owner",
      name: "Cut",
      durationMinutes: 30,
      priceMinor: 1000,
      position: 0,
    },
    {
      id: "svc-one",
      businessId: "biz-owner",
      name: "Color",
      durationMinutes: 30,
      priceMinor: 2000,
      position: 1,
    },
  ])
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz-owner", name: "Ana", position: 0 },
    { id: "m2", businessId: "biz-owner", name: "Bea", position: 1 },
  ])
  await db.insert(teamMemberServices).values({
    businessId: "biz-owner",
    teamMemberId: "m1",
    serviceId: "svc-one",
  })
}

async function busyAt10(memberId: string) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id: `owner-busy-${memberId}`,
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: memberId,
    serviceName: "Cut",
    teamMemberName: memberId === "m1" ? "Ana" : "Bea",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T14:30:00.000Z",
    customerName: "First",
    customerPhone: "+18095550000",
    status: "confirmed",
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-owner-booking-test-"))
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

test("books a walk-in with anyone free, phone and note optional", async () => {
  const result = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "11:00",
    name: "  Walk In  ",
    phone: null,
    note: "  first visit  ",
    allowConflict: false,
  })
  expect(result.status).toBe("booked")
  if (result.status !== "booked") {
    return
  }
  const { db } = await import("@/lib/db")
  const [row] = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, result.bookingId))
  expect(row).toMatchObject({
    serviceName: "Cut",
    teamMemberName: "Ana",
    customerName: "Walk In",
    customerPhone: null,
    source: "owner",
    status: "confirmed",
    note: "first visit",
  })
})

test("busy slot conflicts, allowConflict books anyway", async () => {
  await busyAt10("m1")
  const conflict = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-one",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: false,
  })
  expect(conflict).toEqual({ status: "conflict", reason: "busy" })
  const forced = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-one",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: true,
  })
  expect(forced.status).toBe("booked")
})

test("closed day never auto-assigns off-duty staff even with allowConflict", async () => {
  const closed = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-07",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: false,
  })
  expect(closed).toEqual({ status: "conflict", reason: "closed" })
  const forced = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-07",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: true,
  })
  expect(forced).toEqual({ status: "conflict", reason: "closed" })
})

test("past dates within the owner window can be booked", async () => {
  const result = await createOwnerBooking({
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: "m2",
    addonIds: [],
    date: "2026-05-15",
    time: "10:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: true,
  })
  expect(result.status).toBe("booked")
})

test("validation paths", async () => {
  const valid = {
    businessId: "biz-owner",
    serviceId: "svc-all",
    teamMemberId: null as string | null,
    addonIds: [],
    date: "2026-06-01",
    time: "12:00",
    name: "Luis",
    phone: "+18095550134" as string | null,
    note: null as string | null,
    allowConflict: false,
  }
  await expect(
    createOwnerBooking({ ...valid, serviceId: "nope" })
  ).resolves.toEqual({ status: "invalid", field: "service" })
  await expect(
    createOwnerBooking({ ...valid, teamMemberId: "m2", serviceId: "svc-one" })
  ).resolves.toEqual({ status: "invalid", field: "teamMember" })
  await expect(
    createOwnerBooking({ ...valid, teamMemberId: "nope" })
  ).resolves.toEqual({ status: "invalid", field: "teamMember" })
  await expect(
    createOwnerBooking({ ...valid, date: "2026-05-01" })
  ).resolves.toEqual({ status: "invalid", field: "date" })
  await expect(
    createOwnerBooking({ ...valid, date: "2027-06-02" })
  ).resolves.toEqual({ status: "invalid", field: "date" })
  await expect(
    createOwnerBooking({ ...valid, date: "2026-13-01" })
  ).resolves.toEqual({ status: "invalid", field: "date" })
  await expect(createOwnerBooking({ ...valid, time: "10am" })).resolves.toEqual(
    { status: "invalid", field: "time" }
  )
  await expect(createOwnerBooking({ ...valid, name: "   " })).resolves.toEqual({
    status: "invalid",
    field: "name",
  })
  await expect(createOwnerBooking({ ...valid, phone: "abc" })).resolves.toEqual(
    { status: "invalid", field: "phone" }
  )
  await expect(
    createOwnerBooking({ ...valid, note: "x".repeat(501) })
  ).resolves.toEqual({ status: "invalid", field: "note" })
})

test("someone else's business fails", async () => {
  const result = await createOwnerBooking({
    businessId: "biz-theirs",
    serviceId: "svc-all",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "12:00",
    name: "Luis",
    phone: "+18095550134",
    note: null,
    allowConflict: false,
  })
  expect(result).toEqual({ status: "failed" })
})
