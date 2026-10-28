// @vitest-environment node
import { expect, test } from "vitest"

const { bookingStats } = await import("./booking-stats")

const NOW = "2026-10-28T12:00:00.000Z"

const booking = (part: Record<string, unknown>) =>
  ({
    id: "k",
    date: "2026-06-01",
    time: "10:00",
    endTime: "10:30",
    startAt: "2026-06-01T14:00:00.000Z",
    endAt: "2026-06-01T14:30:00.000Z",
    serviceId: "s1",
    serviceName: "Cut",
    teamMemberId: "m1",
    teamMemberName: "Ana",
    durationMinutes: 30,
    priceMinor: 1000,
    currency: "DOP",
    customerName: "Luis",
    customerPhone: null,
    customerKey: "n:luis",
    status: "confirmed",
    source: "owner",
    note: null,
    addons: [],
    ...part,
  }) as never

test("totals count every status", () => {
  const stats = bookingStats(
    [
      booking({ status: "confirmed" }),
      booking({ status: "completed" }),
      booking({ status: "cancelled" }),
      booking({ status: "no_show" }),
    ],
    NOW,
    "DOP"
  )
  expect(stats.total).toBe(4)
  expect(stats.byStatus).toEqual({
    confirmed: 1,
    completed: 1,
    cancelled: 1,
    no_show: 1,
  })
})

test("earned counts only completed, expected only future confirmed", () => {
  const stats = bookingStats(
    [
      booking({
        status: "completed",
        priceMinor: 1000,
        endAt: "2020-01-01T00:00:00.000Z",
      }),
      booking({
        status: "completed",
        priceMinor: null,
        endAt: "2020-01-01T00:00:00.000Z",
      }),
      booking({
        status: "confirmed",
        priceMinor: 2000,
        endAt: "2099-01-01T00:00:00.000Z",
      }),
      booking({
        status: "confirmed",
        priceMinor: 3000,
        endAt: "2020-01-01T00:00:00.000Z",
      }),
    ],
    NOW,
    "DOP"
  )
  expect(stats.earnedMinor).toBe(1000)
  expect(stats.expectedMinor).toBe(2000)
  expect(stats.currency).toBe("DOP")
})

test("noShowRate rounds to 2 decimals and is null with no completed or no-show", () => {
  const some = bookingStats(
    [
      booking({ status: "completed" }),
      booking({ status: "completed" }),
      booking({ status: "no_show" }),
    ],
    NOW,
    "DOP"
  )
  expect(some.noShowRate).toBe(0.33)
  const none = bookingStats(
    [booking({ status: "confirmed" }), booking({ status: "cancelled" })],
    NOW,
    "DOP"
  )
  expect(none.noShowRate).toBeNull()
})

test("cancelled stays out of the breakdowns", () => {
  const stats = bookingStats(
    [
      booking({
        status: "cancelled",
        date: "2026-06-01",
        time: "10:00",
        serviceName: "Cut",
        teamMemberName: "Ana",
      }),
      booking({
        status: "completed",
        date: "2026-06-02",
        time: "11:00",
        serviceName: "Color",
        teamMemberName: null,
      }),
    ],
    NOW,
    "DOP"
  )
  // 2026-06-01 was a Monday.
  expect(stats.byWeekday).toEqual([{ weekday: 2, bookings: 1 }])
  expect(stats.byHour).toEqual([{ hour: "11", bookings: 1 }])
  expect(stats.topServices).toEqual([{ service: "Color", bookings: 1 }])
  expect(stats.byTeamMember).toEqual([
    { teamMember: "unassigned", bookings: 1 },
  ])
})

test("breakdowns sort busiest first and cap at 5", () => {
  const rows = Array.from({ length: 7 }, (_, i) =>
    booking({
      id: `k${i}`,
      status: "completed",
      date: "2026-06-01",
      time: `1${i}:00`,
      serviceName: `Service ${i}`,
      teamMemberName: "Ana",
    })
  )
  const stats = bookingStats(rows, NOW, "DOP")
  expect(stats.topServices).toHaveLength(5)
  expect(stats.byHour).toHaveLength(5)
  expect(stats.byWeekday).toEqual([{ weekday: 1, bookings: 7 }])
})

test("an empty range returns the business currency with zero counts", () => {
  const stats = bookingStats([], NOW, "EUR")
  expect(stats.currency).toBe("EUR")
  expect(stats.total).toBe(0)
  expect(stats.earnedMinor).toBe(0)
  expect(stats.expectedMinor).toBe(0)
  expect(stats.noShowRate).toBeNull()
  expect(stats.byWeekday).toEqual([])
})
