import { OTHER_GROUP } from "@/lib/service-groups"
import type { OwnerBooking } from "../types"

// What a booking is now, for the Bookings page's status tabs: a booked one
// that has not ended is upcoming; one that has ended but was never marked
// done or no-show is "not marked", so the owner can catch up.
export type BookingState =
  | "upcoming"
  | "unmarked"
  | "completed"
  | "no_show"
  | "cancelled"

export const STATUS_FILTERS = [
  "all",
  "upcoming",
  "unmarked",
  "completed",
  "no_show",
  "cancelled",
] as const
export type StatusFilter = (typeof STATUS_FILTERS)[number]

export interface BookingFilters {
  search: string
  status: StatusFilter
  // Empty: every category / every service / every team member. Categories
  // are category ids, OTHER_GROUP for Other.
  categoryIds: string[]
  serviceIds: string[]
  teamIds: string[]
}

export const NO_FILTERS: BookingFilters = {
  search: "",
  status: "all",
  categoryIds: [],
  serviceIds: [],
  teamIds: [],
}

// `now` is an ISO time.
export function bookingState(booking: OwnerBooking, now: string): BookingState {
  if (booking.status !== "confirmed") return booking.status
  return booking.endAt >= now ? "upcoming" : "unmarked"
}

// The bookings that match the search, categories, services and team; the
// status is left to `byStatus`, so each tab can show how many it holds.
// `categoryOf`: the category of a booking's service, null for Other.
export function matchBookings(
  bookings: OwnerBooking[],
  filters: Omit<BookingFilters, "status">,
  categoryOf: (booking: OwnerBooking) => string | null = () => null
): OwnerBooking[] {
  const words = filters.search.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const digits = filters.search.replace(/\D/g, "")
  return bookings.filter((booking) => {
    if (
      filters.categoryIds.length > 0 &&
      // Other: a service with no category, or one that is gone.
      !filters.categoryIds.includes(categoryOf(booking) ?? OTHER_GROUP)
    )
      return false
    if (
      filters.serviceIds.length > 0 &&
      !(booking.serviceId && filters.serviceIds.includes(booking.serviceId))
    )
      return false
    if (
      filters.teamIds.length > 0 &&
      !(booking.teamMemberId && filters.teamIds.includes(booking.teamMemberId))
    )
      return false
    if (words.length === 0) return true
    const text = [
      booking.customerName,
      booking.serviceName,
      booking.teamMemberName ?? "",
      ...booking.addons.map((addon) => addon.name),
    ]
      .join(" ")
      .toLowerCase()
    // A number typed is matched against the phone's digits too.
    const phone = (booking.customerPhone ?? "").replace(/\D/g, "")
    return (
      words.every((word) => text.includes(word)) ||
      (digits.length >= 3 && phone.includes(digits))
    )
  })
}

export function byStatus(
  bookings: OwnerBooking[],
  status: StatusFilter,
  now: string
): OwnerBooking[] {
  if (status === "all") return bookings
  return bookings.filter((booking) => bookingState(booking, now) === status)
}

export function statusCounts(
  bookings: OwnerBooking[],
  now: string
): Record<StatusFilter, number> {
  const counts = Object.fromEntries(
    STATUS_FILTERS.map((status) => [status, 0])
  ) as Record<StatusFilter, number>
  counts.all = bookings.length
  for (const booking of bookings) counts[bookingState(booking, now)] += 1
  return counts
}

// What the owner can do with a booking at `now`: before it starts, move or
// cancel it; once it has started, mark it done or no-show; after that, undo.
export type BookingAction = "move" | "cancel" | "done" | "noShow" | "undo"

export function bookingActions(
  booking: OwnerBooking,
  now: string
): BookingAction[] {
  if (booking.status === "cancelled") return []
  if (booking.status !== "confirmed") return ["undo"]
  if (booking.startAt > now) return ["move", "cancel"]
  return ["done", "noShow"]
}
