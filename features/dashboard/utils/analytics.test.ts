import { expect, test } from "vitest"
import type { OwnerBooking, OwnerCustomer } from "../types"
import { dashboardSummary, percentChange } from "./analytics"

const booking = (
  date: string,
  status: OwnerBooking["status"],
  serviceName = "Cut",
  priceMinor: number | null = 1000
) => ({ date, status, serviceName, priceMinor }) as OwnerBooking
const customer = (firstBooking: string | null) =>
  ({ firstBooking }) as OwnerCustomer

test("splits the last 7 days from the 7 before and leaves cancelled out", () => {
  const summary = dashboardSummary(
    [
      booking("2026-10-31", "confirmed"),
      booking("2026-10-25", "no_show"),
      booking("2026-10-25", "cancelled"),
      booking("2026-10-24", "completed", "Beard", 500),
      booking("2026-10-18", "completed", "Beard", null),
      booking("2026-10-10", "completed"),
    ],
    [customer("2026-10-30"), customer("2026-10-20"), customer(null)],
    "2026-10-31"
  )
  expect(summary.bookings).toEqual({ current: 2, previous: 2 })
  expect(summary.revenue).toEqual({ current: 1000, previous: 500 })
  expect(summary.noShows).toEqual({ current: 1, previous: 0 })
  expect(summary.newCustomers).toEqual({ current: 1, previous: 1 })
  expect(summary.topServices).toEqual([
    { name: "Cut", count: 3 },
    { name: "Beard", count: 2 },
  ])
  expect(summary.total30).toBe(5)
})

test("services past the top five are grouped as one", () => {
  const rows = ["A", "B", "C", "D", "E", "F", "G"].map((name) =>
    booking("2026-10-31", "confirmed", name)
  )
  const { topServices } = dashboardSummary(rows, [], "2026-10-31")
  expect(topServices).toHaveLength(6)
  expect(topServices.at(-1)).toEqual({ name: null, count: 2 })
})

test("percent change, with nothing to compare against as null", () => {
  expect(percentChange({ current: 12, previous: 10 })).toBe(20)
  expect(percentChange({ current: 5, previous: 10 })).toBe(-50)
  expect(percentChange({ current: 3, previous: 0 })).toBeNull()
})
