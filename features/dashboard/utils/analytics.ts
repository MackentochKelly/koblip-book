import { addDaysTo } from "@/lib/format-booking-time"
import type { OwnerBooking } from "../types"

// The periods the Analytics page offers, in days back from today.
export const PERIODS = [7, 30, 90] as const
export type Period = (typeof PERIODS)[number]

// How many services Top services names.
const TOP_SERVICES = 5

// One number for this period and the same number for the period before.
export interface Trend {
  current: number
  previous: number
}

// How the business did over the last `days` days up to and including
// `today` ("YYYY-MM-DD", business time zone), each number against the
// `days` before. `bookings` must cover both stretches; cancelled ones count
// nowhere. `firstVisit` maps a customer to the day they first booked, so a
// booking on that day is a new customer's. Revenue is the price of every
// kept booking except no-shows.
export function periodSummary(
  bookings: OwnerBooking[],
  firstVisit: Record<string, string>,
  today: string,
  days: number
) {
  const start = addDaysTo(today, 1 - days)
  const previousStart = addDaysTo(start, -days)
  const kept = bookings.filter(
    (booking) => booking.status !== "cancelled" && booking.date <= today
  )
  const current = kept.filter((booking) => booking.date >= start)
  const previous = kept.filter(
    (booking) => booking.date >= previousStart && booking.date < start
  )
  const isNew = (booking: OwnerBooking) =>
    firstVisit[booking.customerKey] === booking.date
  const trend = (count: (rows: OwnerBooking[]) => number): Trend => ({
    current: count(current),
    previous: count(previous),
  })
  const noShows = (rows: OwnerBooking[]) =>
    rows.filter((booking) => booking.status === "no_show").length

  // Every day of the period, oldest first, split new / returning.
  const daily = Array.from({ length: days }, (_, index) => ({
    date: addDaysTo(start, index),
    newCustomers: 0,
    returning: 0,
  }))
  const dayIndex = new Map(daily.map((day, index) => [day.date, index]))
  // Bookings per weekday, Monday first.
  const weekdays = Array.from({ length: 7 }, () => 0)
  const perService = new Map<string, number>()
  for (const booking of current) {
    const day = daily[dayIndex.get(booking.date) ?? -1]
    if (day) {
      if (isNew(booking)) day.newCustomers += 1
      else day.returning += 1
    }
    const sunday0 = new Date(`${booking.date}T00:00:00Z`).getUTCDay()
    weekdays[(sunday0 + 6) % 7] += 1
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
    revenue: trend((rows) =>
      rows
        .filter((booking) => booking.status !== "no_show")
        .reduce((sum, booking) => sum + (booking.priceMinor ?? 0), 0)
    ),
    // Customers whose first booking ever falls in the period.
    newCustomers: trend(
      (rows) =>
        new Set(rows.filter(isNew).map((booking) => booking.customerKey)).size
    ),
    noShows: trend(noShows),
    showUp: {
      showedUp: current.length - noShows(current),
      noShows: noShows(current),
    },
    daily,
    weekdays,
    // The top five, then everything else as one (null name).
    topServices: [
      ...ranked.slice(0, TOP_SERVICES),
      ...(others > 0 ? [{ name: null, count: others }] : []),
    ] as { name: string | null; count: number }[],
  }
}

export type PeriodSummary = ReturnType<typeof periodSummary>

// The change from the period before in whole percent; null when there was
// nothing the period before to compare with.
export function percentChange({ current, previous }: Trend): number | null {
  if (previous === 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
