// Home's greeting: morning until noon, afternoon until the language's evening
// hour (i18n shell.greeting.eveningFrom), by the clock where the business is.
const AFTERNOON_FROM = 12

export type PartOfDay = "morning" | "afternoon" | "evening"

export function partOfDay(
  timeZone: string,
  eveningFrom: number,
  now: Date = new Date()
): PartOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "numeric",
      hourCycle: "h23",
    }).format(now)
  )
  if (hour < AFTERNOON_FROM) return "morning"
  if (hour < eveningFrom) return "afternoon"
  return "evening"
}
