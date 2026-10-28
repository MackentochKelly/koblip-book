import type { OwnerBooking } from "@/features/dashboard/types"

export interface BookingStats {
  total: number
  byStatus: {
    confirmed: number
    completed: number
    cancelled: number
    no_show: number
  }
  earnedMinor: number
  currency: string
  expectedMinor: number
  noShowRate: number | null
  byWeekday: { weekday: number; bookings: number }[]
  byHour: { hour: string; bookings: number }[]
  topServices: { service: string; bookings: number }[]
  byTeamMember: { teamMember: string; bookings: number }[]
}

// Counts and money over a booking list. Cancelled bookings count in the
// totals but in no breakdown. Ties break by key ascending so the order
// is stable.
export function bookingStats(
  rows: OwnerBooking[],
  now: string,
  currency: string
): BookingStats {
  const byStatus = { confirmed: 0, completed: 0, cancelled: 0, no_show: 0 }
  let earnedMinor = 0
  let expectedMinor = 0
  const countInto = (map: Map<string, number>, key: string) => {
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  const weekdays = new Map<string, number>()
  const hours = new Map<string, number>()
  const services = new Map<string, number>()
  const members = new Map<string, number>()
  for (const b of rows) {
    byStatus[b.status] += 1
    if (b.status === "completed") {
      earnedMinor += b.priceMinor ?? 0
    }
    if (b.status === "confirmed" && b.endAt >= now) {
      expectedMinor += b.priceMinor ?? 0
    }
    if (b.status === "cancelled") {
      continue
    }
    const [year, month, day] = b.date.split("-").map(Number)
    countInto(
      weekdays,
      String(new Date(Date.UTC(year, month - 1, day)).getUTCDay())
    )
    countInto(hours, b.time.slice(0, 2))
    countInto(services, b.serviceName)
    countInto(members, b.teamMemberName ?? "unassigned")
  }
  const ranked = (map: Map<string, number>) =>
    [...map].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
  return {
    total: rows.length,
    byStatus,
    earnedMinor,
    currency,
    expectedMinor,
    noShowRate:
      byStatus.completed + byStatus.no_show === 0
        ? null
        : Math.round(
            (byStatus.no_show / (byStatus.completed + byStatus.no_show)) * 100
          ) / 100,
    byWeekday: ranked(weekdays).map(([weekday, bookings]) => ({
      weekday: Number(weekday),
      bookings,
    })),
    byHour: ranked(hours)
      .slice(0, 5)
      .map(([hour, bookings]) => ({ hour, bookings })),
    topServices: ranked(services)
      .slice(0, 5)
      .map(([service, bookings]) => ({ service, bookings })),
    byTeamMember: ranked(members).map(([teamMember, bookings]) => ({
      teamMember,
      bookings,
    })),
  }
}
