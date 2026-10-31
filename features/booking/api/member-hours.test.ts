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
  businesses,
  businessHours,
  services,
  teamMembers,
  teamMemberHours,
  teamMemberServices,
  user,
} from "@/lib/db/schema"
vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: "owner" })),
}))
const { createBooking } = await import("./create-booking")
const { createOwnerBooking } = await import("./create-owner-booking")
const { moveOwnerBooking } = await import("./move-owner-booking")
const { getAvailability } = await import("./get-availability")
let dir: string
let db: (typeof import("@/lib/db"))["db"]
const NOW = Date.UTC(2026, 5, 1, 12)
const publicInput = {
  slug: "shop",
  serviceId: "svc",
  teamMemberId: null,
  addonIds: [],
  date: "2026-06-01",
  time: "10:00",
  name: "Customer",
  phone: "+18095550134",
}
const ownerInput = {
  ...publicInput,
  businessId: "biz",
  note: null,
  allowConflict: false,
}
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "member-hours-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(user)
    .values({ id: "owner", name: "Owner", email: "owner@example.com" })
  await db
    .insert(businesses)
    .values({
      id: "biz",
      slug: "shop",
      name: "Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "owner",
      status: "operational",
    })
  await db
    .insert(businessHours)
    .values(
      [1, 2].map((weekday) => ({
        businessId: "biz",
        weekday,
        opensAt: "09:00",
        closesAt: "18:00",
      }))
    )
  await db
    .insert(services)
    .values({ id: "svc", businessId: "biz", name: "Cut", durationMinutes: 30 })
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Ana", position: 0 },
    { id: "m2", businessId: "biz", name: "Bea", position: 1 },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
beforeEach(async () => {
  vi.spyOn(Date, "now").mockReturnValue(NOW)
  await db.insert(teamMemberHours).values([
    {
      businessId: "biz",
      teamMemberId: "m1",
      weekday: 2,
      opensAt: "09:00",
      closesAt: "18:00",
    },
    {
      businessId: "biz",
      teamMemberId: "m2",
      weekday: 1,
      opensAt: "10:00",
      closesAt: "12:00",
    },
  ])
})
afterEach(async () => {
  vi.restoreAllMocks()
  await db.delete(bookings)
  await db.delete(teamMemberHours)
  await db.delete(teamMemberServices)
})
test("availability uses chosen hours and restricts anyone to service-qualified staff", async () => {
  expect((await getAvailability("shop", "svc", "m1"))?.days[0].times).toEqual(
    []
  )
  const any = await getAvailability("shop", "svc", null)
  expect(any?.days[0].times[0]).toBe("10:00")
  expect(any?.days[0].times.at(-1)).toBe("11:30")
  expect((await getAvailability("shop", "svc", "m1"))?.days[1].times).toContain(
    "09:00"
  )
  await db
    .insert(teamMemberServices)
    .values({ businessId: "biz", teamMemberId: "m1", serviceId: "svc" })
  expect((await getAvailability("shop", "svc", null))?.days[0].times).toEqual(
    []
  )
})
test("public automatic assignment skips first off-duty member", async () => {
  const result = await createBooking(publicInput)
  expect(result.status).toBe("booked")
  expect((await db.select().from(bookings))[0].teamMemberId).toBe("m2")
  expect(
    await createBooking({ ...publicInput, teamMemberId: "m1", time: "11:00" })
  ).toEqual({ status: "taken" })
})
test("owner add rejects off-duty chosen member and auto-assigns working member", async () => {
  expect(
    await createOwnerBooking({ ...ownerInput, teamMemberId: "m1" })
  ).toEqual({ status: "conflict", reason: "closed" })
  expect((await createOwnerBooking(ownerInput)).status).toBe("booked")
  expect((await db.select().from(bookings))[0].teamMemberId).toBe("m2")
})
test("forced automatic assignment still never picks an off-duty member", async () => {
  expect(
    await createOwnerBooking({
      ...ownerInput,
      time: "14:00",
      allowConflict: true,
    })
  ).toEqual({ status: "conflict", reason: "closed" })
  const result = await createOwnerBooking(ownerInput)
  expect(result.status).toBe("booked")
  expect(
    (await createOwnerBooking({ ...ownerInput, allowConflict: true })).status
  ).toBe("booked")
  expect(
    (await db.select().from(bookings)).every((row) => row.teamMemberId === "m2")
  ).toBe(true)
})
test("owner move rejects a time outside assigned member hours", async () => {
  const result = await createOwnerBooking(ownerInput)
  if (result.status !== "booked") throw new Error("seed booking failed")
  expect(
    await moveOwnerBooking({
      businessId: "biz",
      bookingId: result.bookingId,
      date: "2026-06-01",
      time: "14:00",
      allowConflict: false,
    })
  ).toEqual({ status: "conflict", reason: "closed" })
  expect(
    (
      await db.select().from(bookings).where(eq(bookings.id, result.bookingId))
    )[0].startAt
  ).toBe("2026-06-01T14:00:00.000Z")
})
