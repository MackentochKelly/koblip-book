import { addDaysTo } from "@/lib/format-booking-time"

const DAY = /^\d{4}-\d{2}-\d{2}$/
const MONTH = /^\d{4}-\d{2}$/
// The longest range the page loads at once (the queries refuse more).
const MAX_DAYS = 366

export interface DayRange {
  from: string
  to: string
}

// The quick picks beside the date range, newest-first thinking: what is
// coming, then what has been. `around` is where the page opens.
export const RANGE_PRESETS = [
  "around",
  "today",
  "next7",
  "next30",
  "last30",
  "last90",
] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

export function presetRange(preset: RangePreset, today: string): DayRange {
  switch (preset) {
    case "today":
      return { from: today, to: today }
    case "next7":
      return { from: today, to: addDaysTo(today, 6) }
    case "next30":
      return { from: today, to: addDaysTo(today, 29) }
    case "last30":
      return { from: addDaysTo(today, -29), to: today }
    case "last90":
      return { from: addDaysTo(today, -89), to: today }
    case "around":
      return { from: addDaysTo(today, -30), to: addDaysTo(today, 90) }
  }
}

export function presetOf(range: DayRange, today: string): RangePreset | null {
  return (
    RANGE_PRESETS.find((preset) => {
      const other = presetRange(preset, today)
      return other.from === range.from && other.to === range.to
    }) ?? null
  )
}

function realDay(value: unknown): value is string {
  return (
    typeof value === "string" &&
    DAY.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().startsWith(value)
  )
}

// The range in the address, or where the page opens when it is missing,
// backwards or too long.
export function rangeFrom(
  from: unknown,
  to: unknown,
  today: string
): DayRange {
  if (realDay(from) && realDay(to) && from <= to) {
    const days =
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000 +
      1
    if (days <= MAX_DAYS) return { from, to }
  }
  return presetRange("around", today)
}

// The month in the address ("YYYY-MM"), or today's.
export function monthFrom(value: unknown, today: string): string {
  if (typeof value === "string" && MONTH.test(value)) {
    const month = Number(value.slice(5))
    if (month >= 1 && month <= 12) return value
  }
  return today.slice(0, 7)
}

// A month's days plus the week either side, which the calendar shows.
export function monthRange(month: string): DayRange {
  const first = `${month}-01`
  const [year, monthNumber] = month.split("-").map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0))
    .toISOString()
    .slice(0, 10)
  return { from: addDaysTo(first, -7), to: addDaysTo(last, 7) }
}

export function shiftMonth(month: string, by: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Date(Date.UTC(year, monthNumber - 1 + by, 1))
    .toISOString()
    .slice(0, 7)
}
