import { BOOKING_RULES } from "@/lib/booking-rules"
import type { AvailabilityDay } from "../types"
import { addDays, weekdayOf, zonedInstant, zonedToday } from "./zoned-time"

export interface AvailabilityInput {
  hours: Array<{ weekday: number; opensAt: string; closesAt: string }>
  timeZone: string
  durationMinutes: number
  seats: number
  teamMemberIds: string[]
  taken: Array<{
    startAt: string
    endAt: string
    teamMemberId: string | null
  }>
  now: number
  dates?: string[]
  // Owner bookings skip the minimum-notice cutoff (walk-ins, past dates).
  ignoreCutoff?: boolean
}

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

function toTime(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`
}

export interface OpenStretch {
  start: number
  end: number
}

// Open stretches of one date in minutes since midnight, clipped to the day.
// A 00:00/00:00 row covers the whole day. A row whose close is at or before
// its open runs past midnight: opensAt→24:00 on its weekday plus
// 00:00→closesAt the next day (the night before's row spills into this day).
function openStretches(
  hours: AvailabilityInput["hours"],
  weekday: number,
  previousWeekday: number
): OpenStretch[] {
  const stretches: OpenStretch[] = []
  for (const row of hours) {
    const open = toMinutes(row.opensAt)
    const close = toMinutes(row.closesAt)
    if (row.weekday === weekday) {
      if (open === 0 && close === 0) {
        stretches.push({ start: 0, end: 1440 })
      } else if (close <= open) {
        stretches.push({ start: open, end: 1440 })
      } else {
        stretches.push({ start: open, end: close })
      }
    } else if (
      row.weekday === previousWeekday &&
      !(open === 0 && close === 0) &&
      close <= open
    ) {
      stretches.push({ start: 0, end: close })
    }
  }
  stretches.sort((a, b) => a.start - b.start)
  const merged: OpenStretch[] = []
  for (const stretch of stretches) {
    const last = merged[merged.length - 1]
    if (last && stretch.start <= last.end) {
      last.end = Math.max(last.end, stretch.end)
    } else {
      merged.push({ ...stretch })
    }
  }
  return merged
}

interface TakenInstant {
  start: number
  end: number
  teamMemberId: string | null
}

function overlaps(booking: TakenInstant, start: number, end: number): boolean {
  return booking.start < end && booking.end > start
}

function dayTimes(
  date: string,
  input: AvailabilityInput,
  taken: TakenInstant[]
): string[] {
  const weekday = weekdayOf(date)
  const stretches = openStretches(
    input.hours,
    weekday,
    (weekday + 6) % 7
  )
  const cutoff = input.now + BOOKING_RULES.minimumNoticeMinutes * 60_000
  const minutes = new Set<number>()
  for (const stretch of stretches) {
    for (
      let start = stretch.start;
      start + input.durationMinutes <= stretch.end;
      start += BOOKING_RULES.slotStepMinutes
    ) {
      const startInstant = zonedInstant(date, start, input.timeZone)
      if (!input.ignoreCutoff && startInstant < cutoff) {
        continue
      }
      const endInstant = zonedInstant(
        date,
        start + input.durationMinutes,
        input.timeZone
      )
      const overlapping = taken.filter((booking) =>
        overlaps(booking, startInstant, endInstant)
      )
      let free: boolean
      if (input.teamMemberIds.length === 0) {
        free = overlapping.length < input.seats
      } else {
        const freeMembers = input.teamMemberIds.filter(
          (id) =>
            !overlapping.some((booking) => booking.teamMemberId === id)
        )
        const nullBookings = overlapping.filter(
          (booking) => booking.teamMemberId === null
        ).length
        free = freeMembers.length > nullBookings
      }
      if (free) {
        minutes.add(start)
      }
    }
  }
  return [...minutes].sort((a, b) => a - b).map(toTime)
}

// Open stretches of one date in minutes since midnight. Used by owner
// bookings to tell "closed" apart from "busy".
export function dayOpenStretches(
  hours: AvailabilityInput["hours"],
  date: string
): OpenStretch[] {
  const weekday = weekdayOf(date)
  return openStretches(hours, weekday, (weekday + 6) % 7)
}

export function availability(input: AvailabilityInput): AvailabilityDay[] {
  const dates =
    input.dates ??
    Array.from({ length: BOOKING_RULES.daysAhead }, (_, i) =>
      addDays(zonedToday(input.now, input.timeZone), i)
    )
  const taken: TakenInstant[] = input.taken.map((booking) => ({
    start: Date.parse(booking.startAt),
    end: Date.parse(booking.endAt),
    teamMemberId: booking.teamMemberId,
  }))
  return dates.map((date) => ({ date, times: dayTimes(date, input, taken) }))
}
