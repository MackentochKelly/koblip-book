import { BOOKING_RULES } from "./booking-rules"

export interface HoursRow {
  weekday: number
  opensAt: string
  closesAt: string
}

export const HOURS_WEEK = [1, 2, 3, 4, 5, 6, 0] as const
export const DEFAULT_HOURS = { opensAt: "09:00", closesAt: "17:00" } as const

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
export function validHours(rows: unknown): rows is HoursRow[] {
  return (
    Array.isArray(rows) &&
    rows.length <= BOOKING_RULES.maxHoursRows &&
    rows.every(
      (row) =>
        row &&
        Number.isInteger(row.weekday) &&
        row.weekday >= 0 &&
        row.weekday <= 6 &&
        typeof row.opensAt === "string" &&
        TIME_PATTERN.test(row.opensAt) &&
        typeof row.closesAt === "string" &&
        TIME_PATTERN.test(row.closesAt)
    )
  )
}
