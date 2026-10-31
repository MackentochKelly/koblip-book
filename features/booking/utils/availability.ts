import { BOOKING_RULES } from "@/lib/booking-rules"
import type { AvailabilityDay } from "../types"
import { addDays, weekdayOf, zonedInstant, zonedToday } from "./zoned-time"

export interface AvailabilityInput {
  hours: Array<{ weekday: number; opensAt: string; closesAt: string }>
  memberHours?: Array<{
    teamMemberId: string
    weekday: number
    opensAt: string
    closesAt: string
  }>
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
  taken: TakenInstant[],
  memberStretches: Record<string, OpenStretch[]>
): string[] {
  const stretches = dayOpenStretches(input.hours, date)
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
            (memberStretches[id] ?? stretches).some(
              (stretch) =>
                stretch.start <= start &&
                start + input.durationMinutes <= stretch.end
            ) && !overlapping.some((booking) => booking.teamMemberId === id)
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

// No member rows means inherited hours. Overnight expansion stays in dayOpenStretches.
export function memberOpenStretches(
  hours: AvailabilityInput["hours"],
  memberHours: NonNullable<AvailabilityInput["memberHours"]>,
  memberId: string,
  date: string
): OpenStretch[] {
  const business = dayOpenStretches(hours, date)
  const own = memberHours.filter((row) => row.teamMemberId === memberId)
  if (own.length === 0) return business
  return business.flatMap((b) =>
    dayOpenStretches(own, date).flatMap((m) => {
      const start = Math.max(b.start, m.start)
      const end = Math.min(b.end, m.end)
      return start < end ? [{ start, end }] : []
    })
  )
}

export function workingMemberIds(
  hours: AvailabilityInput["hours"],
  memberHours: NonNullable<AvailabilityInput["memberHours"]>,
  memberIds: string[],
  date: string,
  start: number,
  duration: number
): string[] {
  return memberIds.filter((id) =>
    memberOpenStretches(hours, memberHours, id, date).some(
      (stretch) => stretch.start <= start && start + duration <= stretch.end
    )
  )
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
  return dates.map((date) => ({
    date,
    times: dayTimes(
      date,
      input,
      taken,
      Object.fromEntries(
        input.teamMemberIds.map((id) => [
          id,
          memberOpenStretches(input.hours, input.memberHours ?? [], id, date),
        ])
      )
    ),
  }))
}
