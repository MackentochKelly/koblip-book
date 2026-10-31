import type { OwnerBooking } from "../types"

export interface TodayBrief {
  // Today's bookings that still stand (not cancelled).
  count: number
  // The next one still to start today, if any.
  next: OwnerBooking | null
}

// Home's one line about today, counted from the bookings already loaded
// (upcoming and past together hold all of today's).
export function todayBrief(
  bookings: OwnerBooking[],
  today: string,
  now: string
): TodayBrief {
  const seen = new Set<string>()
  const todays = bookings
    .filter((booking) => {
      if (booking.date !== today || booking.status === "cancelled") return false
      if (seen.has(booking.id)) return false
      seen.add(booking.id)
      return true
    })
    .sort((a, b) => a.startAt.localeCompare(b.startAt))
  return {
    count: todays.length,
    next: todays.find((booking) => booking.startAt >= now) ?? null,
  }
}
