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
  teamMemberServices,
  teamMembers,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const { createBooking } = await import("./create-booking")
const { getAvailability } = await import("./get-availability")

// Monday 2026-06-01 08:00 in Santo Domingo; cutoff 09:00 local.
const NOW = Date.UTC(2026, 5, 1, 12, 0)

let closeDb: () => void
let dir: string

async function seedShop() {
  const { db } = await import("@/lib/db")
  await db.insert(businesses).values({
    id: "biz-svc",
    slug: "svc-shop",
    name: "Service Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    status: "operational",
    seats: 1,
  })
  await db.insert(businessHours).values({
    id: "biz-svc-h",
    businessId: "biz-svc",
    weekday: 1,
    opensAt: "09:00",
    closesAt: "18:00",
  })
  await db.insert(services).values([
    {
      id: "svc-open",
      businessId: "biz-svc",
      name: "Cut",
      durationMinutes: 30,
      priceMinor: 1000,
      position: 0,
    },
    {
      id: "svc-restricted",
      businessId: "biz-svc",
      name: "Color",
      durationMinutes: 30,
      priceMinor: 2000,
      position: 1,
    },
  ])
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz-svc", name: "Ana", position: 0 },
    { id: "m2", businessId: "biz-svc", name: "Bea", position: 1 },
  ])
  // Color is done only by Ana.
  await db.insert(teamMemberServices).values({
    businessId: "biz-svc",
    teamMemberId: "m1",
    serviceId: "svc-restricted",
  })
}

async function bookMemberAt10(memberId: string, name: string) {
  const { db } = await import("@/lib/db")
  await db.insert(bookings).values({
    id: `busy-${memberId}`,
    businessId: "biz-svc",
    serviceId: "svc-open",
    teamMemberId: memberId,
    serviceName: "Cut",
    teamMemberName: name,
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
  dir = mkdtempSync(join(tmpdir(), "koblip-team-svc-test-"))
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

test("a service with rows: chosen allowed member sees times", async () => {
  const result = await getAvailability("svc-shop", "svc-restricted", "m1")
  expect(result).not.toBeNull()
  expect(result?.days[0].times).toContain("10:00")
})

test("a service with rows: member not allowed sees nothing", async () => {
  expect(await getAvailability("svc-shop", "svc-restricted", "m2")).toBeNull()
  expect(await getAvailability("svc-shop", "svc-restricted", "nope")).toBeNull()
})

test("a service without rows is done by everyone", async () => {
  const m1 = await getAvailability("svc-shop", "svc-open", "m1")
  const m2 = await getAvailability("svc-shop", "svc-open", "m2")
  expect(m1?.days[0].times).toContain("10:00")
  expect(m2?.days[0].times).toContain("10:00")
})

test("anyone for a restricted service only uses the allowed members", async () => {
  await bookMemberAt10("m1", "Ana")
  // Ana (the only one who does Color) is busy at 10:00.
  const restricted = await getAvailability("svc-shop", "svc-restricted", null)
  expect(restricted?.days[0].times).not.toContain("10:00")
  // The open service still has Bea free at 10:00.
  const open = await getAvailability("svc-shop", "svc-open", null)
  expect(open?.days[0].times).toContain("10:00")
})

test("createBooking rejects a member not allowed for the service", async () => {
  const result = await createBooking({
    slug: "svc-shop",
    serviceId: "svc-restricted",
    teamMemberId: "m2",
    addonIds: [],
    date: "2026-06-01",
    time: "11:00",
    name: "Luis",
    phone: "+18095550134",
  })
  expect(result).toEqual({ status: "invalid", field: "teamMember" })
})

test("createBooking anyone for a restricted service picks the allowed member", async () => {
  const result = await createBooking({
    slug: "svc-shop",
    serviceId: "svc-restricted",
    teamMemberId: null,
    addonIds: [],
    date: "2026-06-01",
    time: "11:00",
    name: "Luis",
    phone: "+18095550134",
  })
  expect(result.status).toBe("booked")
  if (result.status === "booked") {
    expect(result.booking.teamMemberName).toBe("Ana")
  }
})
