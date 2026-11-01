import type { BusinessHour } from "../types"

export interface DayHours {
  weekday: number
  label: string
  ranges: { opensAt: string; closesAt: string }[]
}

const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0]

// A business's or a team member's hours, one row per open stretch.
export type HourRow = Pick<BusinessHour, "weekday" | "opensAt" | "closesAt">

export function groupHours(hours: HourRow[]): DayHours[] {
  return MONDAY_FIRST.map((weekday) => ({
    weekday,
    label: DAY_LABELS[weekday],
    ranges: hours
      .filter((row) => row.weekday === weekday)
      .sort((a, b) => a.opensAt.localeCompare(b.opensAt))
      .map((row) => ({ opensAt: row.opensAt, closesAt: row.closesAt })),
  }))
}
