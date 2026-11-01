import type { OwnerBooking } from "../types"

// The newest first-time customers among these bookings (a booking on the
// day of their first visit), one row each, newest first.
export function newCustomers(
  bookings: OwnerBooking[],
  firstVisit: Record<string, string>,
  limit: number
): Array<{ key: string; name: string; phone: string | null; date: string }> {
  const seen = new Set<string>()
  return bookings
    .filter((booking) => firstVisit[booking.customerKey] === booking.date)
    .sort((a, b) => b.startAt.localeCompare(a.startAt))
    .filter((booking) => {
      if (seen.has(booking.customerKey)) return false
      seen.add(booking.customerKey)
      return true
    })
    .slice(0, limit)
    .map((booking) => ({
      key: booking.customerKey,
      name: booking.customerName,
      phone: booking.customerPhone,
      date: booking.date,
    }))
}
