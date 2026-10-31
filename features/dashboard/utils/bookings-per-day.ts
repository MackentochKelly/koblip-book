import { addDaysTo } from "@/lib/format-booking-time"
import type { OwnerBooking } from "../types"

// Confirmed bookings per day, from `today` for `count` days: the home
// page's counts and the Analytics chart read it.
export function bookingsPerDay(
  upcoming: OwnerBooking[],
  today: string,
  count: number
) {
  return Array.from({ length: count }, (_, index) => {
    const date = addDaysTo(today, index)
    return {
      date,
      bookings: upcoming.filter(
        (booking) => booking.date === date && booking.status === "confirmed"
      ).length,
    }
  })
}
