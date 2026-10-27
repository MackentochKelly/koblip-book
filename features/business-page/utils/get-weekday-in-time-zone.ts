const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

export function getWeekdayInTimeZone(
  timeZone: string,
  now: Date = new Date()
): number {
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(now)
  return WEEKDAY_INDEX[short]
}
