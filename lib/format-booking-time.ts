// Booking dates and times are the business's own wall clock: a "YYYY-MM-DD"
// day and an "HH:mm" time, shown here without moving them to the visitor's
// time zone.

function asUtc(date: string, time = "00:00"): number {
  const [year, month, day] = date.split("-").map(Number)
  const [hours, minutes] = time.split(":").map(Number)
  return Date.UTC(year, month - 1, day, hours, minutes)
}

// "14:30" → "2:30 PM" (in the given locale).
export function formatClock(time: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(asUtc("2000-01-01", time))
}

// "2026-10-27" → "Tuesday, October 27".
export function formatDay(date: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(asUtc(date))
}

// "2026-10-27" → "Tue".
export function formatWeekdayShort(date: string, locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(asUtc(date))
}

// "2026-10-27", "2026-11-09" → "Oct 27 – Nov 9" (in the given locale, with
// thin spaces around the dash).
export function formatDayRange(
  from: string,
  to: string,
  locale = "en-US"
): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).formatRange(asUtc(from), asUtc(to))
}

// 0 = Sunday … 6 = Saturday → "Sunday".
export function formatWeekday(weekday: number, locale = "en-US"): string {
  // 2000-01-02 was a Sunday.
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    timeZone: "UTC",
  }).format(Date.UTC(2000, 0, 2 + weekday))
}

// "2026-10-27" → 27.
export function dayOfMonth(date: string): number {
  return Number(date.slice(8, 10))
}

// Today in the business's time zone, as "YYYY-MM-DD".
export function todayIn(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
}

// "2026-10-27" plus n days.
export function addDaysTo(date: string, days: number): string {
  return new Date(asUtc(date) + days * 86_400_000).toISOString().slice(0, 10)
}

// The day as a local Date at midnight, for the month calendar.
export function dateFromDay(date: string): Date {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// A local Date from the month calendar back to "YYYY-MM-DD".
export function dayFromDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}
