import type { OwnerBooking, OwnerCustomer } from "../types"

// How many services the Top services list shows.
const TOP_SERVICES = 5

// The Analytics page's look back over `bookings` (one stretch of days that
// starts on `from`): cancelled bookings are left out of every count.
export function analyticsSummary(
  bookings: OwnerBooking[],
  customers: OwnerCustomer[],
  from: string
) {
  const kept = bookings.filter((booking) => booking.status !== "cancelled")

  // Busiest days: bookings per weekday, Monday first.
  const weekdays = Array.from({ length: 7 }, () => 0)
  for (const booking of kept) {
    const sunday0 = new Date(`${booking.date}T00:00:00Z`).getUTCDay()
    weekdays[(sunday0 + 6) % 7] += 1
  }

  const perService = new Map<string, number>()
  for (const booking of kept) {
    perService.set(
      booking.serviceName,
      (perService.get(booking.serviceName) ?? 0) + 1
    )
  }
  const topServices = [...perService]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_SERVICES)

  // New: their first booking ever falls in this stretch.
  const firstBooking = new Map(
    customers.map((customer) => [customer.key, customer.firstBooking])
  )
  const visitors = new Set(kept.map((booking) => booking.customerKey))
  let newCustomers = 0
  for (const key of visitors) {
    const first = firstBooking.get(key)
    if (first && first >= from) newCustomers += 1
  }

  return {
    bookings: kept.length,
    noShows: kept.filter((booking) => booking.status === "no_show").length,
    newCustomers,
    returningCustomers: visitors.size - newCustomers,
    weekdays,
    topServices,
  }
}

export type AnalyticsSummary = ReturnType<typeof analyticsSummary>
