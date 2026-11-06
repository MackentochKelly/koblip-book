import type { PageLanguage } from "@/lib/page-language"

// Home's greeting: morning until noon, afternoon until the language's evening
// hour, by the clock where the business is.
const AFTERNOON_FROM = 12

// When each language's evening greeting starts: "Buenas tardes" lasts until
// about 8pm.
export const EVENING_FROM: Record<PageLanguage, number> = { en: 18, es: 20 }

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
