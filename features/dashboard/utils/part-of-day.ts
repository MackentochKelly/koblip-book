// Home's greeting: morning until noon, afternoon until 6pm, then evening,
// by the clock where the business is.
const AFTERNOON_FROM = 12
const EVENING_FROM = 18

export type PartOfDay = "morning" | "afternoon" | "evening"

export function partOfDay(timeZone: string, now: Date = new Date()): PartOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  )
  if (hour < AFTERNOON_FROM) return "morning"
  if (hour < EVENING_FROM) return "afternoon"
  return "evening"
}
