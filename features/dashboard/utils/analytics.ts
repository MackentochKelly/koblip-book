import { addDaysTo } from "@/lib/format-booking-time"
import type { OwnerBooking, OwnerCustomer } from "../types"

// How many services the Top services card names.
const TOP_SERVICES = 5

// One number for the last 7 days and the same number for the 7 days before.
export interface Trend {
  current: number
  previous: number
}

// The dashboard's numbers. `bookings` covers the last 30 days up to and
// including `today` ("YYYY-MM-DD", business time zone); cancelled bookings
// count nowhere. Revenue is the price of every kept booking except no-shows.
export function dashboardSummary(
  bookings: OwnerBooking[],
  customers: OwnerCustomer[],
  today: string
) {
  const weekStart = addDaysTo(today, -6)
  const lastWeekStart = addDaysTo(today, -13)
  const kept = bookings.filter((booking) => booking.status !== "cancelled")
  const week = kept.filter((booking) => booking.date >= weekStart)
  const lastWeek = kept.filter(
    (booking) => booking.date >= lastWeekStart && booking.date < weekStart
  )
  const trend = (count: (rows: OwnerBooking[]) => number): Trend => ({
    current: count(week),
    previous: count(lastWeek),
  })
  const revenue = (rows: OwnerBooking[]) =>
    rows
      .filter((booking) => booking.status !== "no_show")
      .reduce((sum, booking) => sum + (booking.priceMinor ?? 0), 0)
  // New: their first booking ever falls in that week.
  const firstBetween = (from: string, to: string) =>
    customers.filter(
      (customer) =>
        customer.firstBooking !== null &&
        customer.firstBooking >= from &&
        customer.firstBooking <= to
    ).length

  const perService = new Map<string, number>()
  for (const booking of kept) {
    perService.set(
      booking.serviceName,
      (perService.get(booking.serviceName) ?? 0) + 1
    )
  }
  const ranked = [...perService]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  const others = ranked
    .slice(TOP_SERVICES)
    .reduce((sum, service) => sum + service.count, 0)

  return {
    bookings: trend((rows) => rows.length),
    revenue: trend(revenue),
    noShows: trend(
      (rows) => rows.filter((booking) => booking.status === "no_show").length
    ),
    newCustomers: {
      current: firstBetween(weekStart, today),
      previous: firstBetween(lastWeekStart, addDaysTo(weekStart, -1)),
    },
    // Last 30 days: the top five, then everything else as one (null name).
    topServices: [
      ...ranked.slice(0, TOP_SERVICES),
      ...(others > 0 ? [{ name: null, count: others }] : []),
    ] as { name: string | null; count: number }[],
    total30: kept.length,
  }
}

export type DashboardSummary = ReturnType<typeof dashboardSummary>

// The change from the week before in whole percent; null when there was
// nothing the week before to compare with.
export function percentChange({ current, previous }: Trend): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
