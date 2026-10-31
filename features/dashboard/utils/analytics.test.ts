import { expect, test } from "vitest"
import type { OwnerBooking } from "../types"
import { percentChange, periodSummary } from "./analytics"

const booking = (
  date: string,
  status: OwnerBooking["status"],
  customerKey = "p:1",
  serviceName = "Cut",
  priceMinor: number | null = 1000
) => ({ date, status, customerKey, serviceName, priceMinor }) as OwnerBooking

const rows = [
  booking("2026-10-31", "confirmed", "p:new"),
  booking("2026-10-25", "no_show", "p:1"),
  booking("2026-10-25", "cancelled", "p:2"),
  booking("2026-10-24", "completed", "p:1", "Beard", 500),
  booking("2026-10-18", "completed", "p:3", "Beard", null),
  booking("2026-10-10", "completed", "p:1"),
  booking("2026-11-02", "confirmed", "p:1"),
]
const firstVisit = { "p:new": "2026-10-31", "p:1": "2026-09-01", "p:3": "2026-10-18" }

test("the last 7 days against the 7 before, cancelled and future left out", () => {
  const summary = periodSummary(rows, firstVisit, "2026-10-31", 7)
  expect(summary.bookings).toEqual({ current: 2, previous: 2 })
  expect(summary.revenue).toEqual({ current: 1000, previous: 500 })
  expect(summary.noShows).toEqual({ current: 1, previous: 0 })
  expect(summary.newCustomers).toEqual({ current: 1, previous: 1 })
  expect(summary.showUp).toEqual({ showedUp: 1, noShows: 1 })
  expect(summary.daily).toHaveLength(7)
  expect(summary.daily[0]).toEqual({
    date: "2026-10-25",
    newCustomers: 0,
    returning: 1,
  })
  expect(summary.daily[6]).toEqual({
    date: "2026-10-31",
    newCustomers: 1,
    returning: 0,
  })
  // 2026-10-31 is a Saturday, 2026-10-25 a Sunday.
  expect(summary.weekdays).toEqual([0, 0, 0, 0, 0, 1, 1])
})

test("a longer period takes in more and names the top services", () => {
  const summary = periodSummary(rows, firstVisit, "2026-10-31", 30)
  expect(summary.bookings.current).toBe(5)
  expect(summary.topServices).toEqual([
    { name: "Cut", count: 3 },
    { name: "Beard", count: 2 },
  ])
})

test("services past the top five are grouped as one", () => {
  const many = ["A", "B", "C", "D", "E", "F", "G"].map((name) =>
    booking("2026-10-31", "confirmed", "p:1", name)
  )
  const { topServices } = periodSummary(many, {}, "2026-10-31", 7)
  expect(topServices).toHaveLength(6)
  expect(topServices.at(-1)).toEqual({ name: null, count: 2 })
})

test("percent change, with nothing to compare against as null", () => {
  expect(percentChange({ current: 12, previous: 10 })).toBe(20)
  expect(percentChange({ current: 5, previous: 10 })).toBe(-50)
  expect(percentChange({ current: 3, previous: 0 })).toBeNull()
})
