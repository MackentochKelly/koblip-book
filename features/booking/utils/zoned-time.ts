function parseDate(date: string): {
  year: number
  month: number
  day: number
} {
  const [year, month, day] = date.split("-").map(Number)
  return { year, month, day }
}

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

// Wall-clock reading of an instant in the zone, minus the instant itself.
function zoneOffsetMs(timeZone: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(utcMs)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )
  return asUtc - utcMs
}

// UTC ms of that wall-clock time in the zone. Iterating the offset keeps it
// correct across daylight-saving changes.
export function zonedInstant(
  date: string,
  minuteOfDay: number,
  timeZone: string
): number {
  const { year, month, day } = parseDate(date)
  const target = Date.UTC(year, month - 1, day) + minuteOfDay * 60_000
  let utc = target
  for (let i = 0; i < 3; i += 1) {
    utc = target - zoneOffsetMs(timeZone, utc)
  }
  return utc
}

export function zonedToday(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((acc, part) => {
      acc[part.type] = part.value
      return acc
    }, {})
  return `${parts.year}-${parts.month}-${parts.day}`
}

export function addDays(date: string, n: number): string {
  const { year, month, day } = parseDate(date)
  const utc = new Date(Date.UTC(year, month - 1, day) + n * 86_400_000)
  return `${utc.getUTCFullYear()}-${pad(utc.getUTCMonth() + 1)}-${pad(utc.getUTCDate())}`
}

export function weekdayOf(date: string): number {
  const { year, month, day } = parseDate(date)
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}
