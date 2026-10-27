import type { BusinessHour } from "../types"

// "HH:mm" → minutes after midnight.
function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number)
  return hours * 60 + minutes
}

// Weekday (0 = Sunday) and minutes after midnight, in the business's time zone.
function nowInTimeZone(timeZone: string, now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"))
  return { weekday, minutes: Number(part("hour")) * 60 + Number(part("minute")) }
}

// Whether the business is open right now. A row that closes after midnight
// (closesAt before opensAt) runs on into the next day.
export function isOpenNow(
  hours: BusinessHour[],
  timeZone: string,
  now: Date = new Date()
): boolean {
  const { weekday, minutes } = nowInTimeZone(timeZone, now)
  const yesterday = (weekday + 6) % 7
  return hours.some((row) => {
    const opens = toMinutes(row.opensAt)
    const closes = toMinutes(row.closesAt)
    const overnight = closes <= opens
    if (row.weekday === weekday) {
      return minutes >= opens && (overnight || minutes < closes)
    }
    return overnight && row.weekday === yesterday && minutes < closes
  })
}
