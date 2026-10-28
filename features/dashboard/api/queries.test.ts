// @vitest-environment node
import { beforeEach, expect, test, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("not-found")
  }),
}))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))
vi.mock("@/lib/db", () => ({ db: { select: vi.fn() } }))

const { db } = await import("@/lib/db")
const { requireOwner } = await import("@/lib/dal")
const { bookingAddons, businesses } = await import("@/lib/db/schema")
const { bookingRangeUtc, daysInRange, getBookingsBetween } =
  await import("./queries")

const TZ = "America/Santo_Domingo" // UTC-4, no daylight saving
const BUSINESS = {
  id: "b1",
  ownerId: "u1",
  name: "Salon",
  timezone: TZ,
  currency: "DOP",
}

const row = (id: string, startAt: string, endAt: string) => ({
  id,
  businessId: "b1",
  startAt,
  endAt,
  serviceId: "s1",
  serviceName: "Cut",
  teamMemberId: null,
  teamMemberName: null,
  durationMinutes: 30,
  priceMinor: 1000,
  currency: "DOP",
  customerName: "Ana",
  customerPhone: null,
  status: "confirmed",
  source: "owner",
  note: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(db.select).mockImplementation(
    () =>
      ({
        from: (table: unknown) => ({
          where: () =>
            table === businesses
              ? { limit: async () => [BUSINESS] }
              : table === bookingAddons
                ? { orderBy: async () => [] }
                : { orderBy: async () => [] },
        }),
      }) as never
  )
})

test("bookingRangeUtc covers both edge days in the business timezone", () => {
  // Midnight in Santo Domingo is 04:00 UTC.
  expect(bookingRangeUtc("2026-10-28", "2026-10-28", TZ)).toEqual({
    start: "2026-10-28T04:00:00.000Z",
    end: "2026-10-29T04:00:00.000Z",
  })
  expect(bookingRangeUtc("2026-10-28", "2026-10-30", TZ)).toEqual({
    start: "2026-10-28T04:00:00.000Z",
    end: "2026-10-31T04:00:00.000Z",
  })
})

test("getBookingsBetween returns every booking in the range as OwnerBooking", async () => {
  const rows = [
    row("k1", "2026-10-28T14:00:00.000Z", "2026-10-28T14:30:00.000Z"),
    row("k2", "2026-10-29T14:00:00.000Z", "2026-10-29T14:30:00.000Z"),
  ]
  vi.mocked(db.select).mockImplementation(
    () =>
      ({
        from: (table: unknown) => ({
          where: () =>
            table === businesses
              ? { limit: async () => [BUSINESS] }
              : table === bookingAddons
                ? { orderBy: async () => [] }
                : { orderBy: async () => rows },
        }),
      }) as never
  )
  const result = await getBookingsBetween("b1", "2026-10-28", "2026-10-29")
  expect(result.map((b) => b.id)).toEqual(["k1", "k2"])
  // 14:00 UTC is 10:00 in Santo Domingo.
  expect(result[0]).toMatchObject({ date: "2026-10-28", time: "10:00" })
})

test("daysInRange counts both edge days", () => {
  expect(daysInRange("2026-01-01", "2026-01-01")).toBe(1)
  expect(daysInRange("2028-01-01", "2028-12-31")).toBe(366)
  expect(daysInRange("2026-01-01", "2027-01-01")).toBe(366)
  expect(daysInRange("2026-01-01", "2027-01-02")).toBe(367)
})

test("getBookingsBetween refuses a range over 366 days", async () => {
  await expect(
    getBookingsBetween("b1", "2026-01-01", "2027-01-02")
  ).rejects.toThrow()
  // Exactly 366 days (2026-01-01 through 2027-01-01) is allowed.
  vi.mocked(db.select).mockImplementation(
    () =>
      ({
        from: (table: unknown) => ({
          where: () =>
            table === businesses
              ? { limit: async () => [BUSINESS] }
              : { orderBy: async () => [] },
        }),
      }) as never
  )
  await expect(
    getBookingsBetween("b1", "2026-01-01", "2027-01-01")
  ).resolves.toEqual([])
})

test("getBookingsBetween checks the owner", async () => {
  vi.mocked(requireOwner).mockResolvedValueOnce({
    userId: "u9",
    name: "Intruder",
    email: "intruder@example.com",
  } as never)
  await expect(
    getBookingsBetween("b1", "2026-10-28", "2026-10-29")
  ).rejects.toThrow("not-found")
})
