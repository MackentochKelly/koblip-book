import { NOTIFICATION_RULES } from "@/lib/notification-rules"

// When a booking's reminders go (docs/koblip-chat-integration.md, "When
// reminders go"). Agreed with the owner, for the default 24 h, 2 h and 30 min:
// booked more than a day ahead → 24 h and 30 min; a few hours ahead → 2 h and
// 30 min; one to three hours ahead → 30 min; under an hour → none. In general:
// a reminder fits when the booking was made at least its own length (up to an
// hour) before it; of those that fit, the longest and the shortest go.
// Nothing goes in quiet hours: a long reminder moves to an hour before they
// start, the evening before; a short one is skipped.

const MINUTE = 60_000

// The local date and minutes after midnight of an instant in a time zone.
function localParts(at: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((part) => [part.type, part.value])
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

// The instant a local date and time is in a time zone (two passes settle
// the zone's offset, daylight saving included).
function instantAt(date: string, minutes: number, timeZone: string): Date {
  const [year, month, day] = date.split("-").map(Number)
  const wall = Date.UTC(year, month - 1, day, 0, minutes)
  let guess = wall
  for (let pass = 0; pass < 2; pass++) {
    const seen = localParts(new Date(guess), timeZone)
    const [y, m, d] = seen.date.split("-").map(Number)
    guess += wall - Date.UTC(y, m - 1, d, 0, seen.minutes)
  }
  return new Date(guess)
}

function previousDay(date: string) {
  const [year, month, day] = date.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, day - 1)).toISOString().slice(0, 10)
}

const toMinutes = (time: string) => {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

export function inQuietHours(at: Date, quietStart: string, quietEnd: string, timeZone: string) {
  const start = toMinutes(quietStart)
  const end = toMinutes(quietEnd)
  if (start === end) return false
  const { minutes } = localParts(at, timeZone)
  return start > end ? minutes >= start || minutes < end : minutes >= start && minutes < end
}

export type PlannedReminder = { minutes: number; dueAt: Date }

export function planReminders(input: {
  bookedAt: Date
  startAt: Date
  reminders: readonly number[]
  quietStart: string
  quietEnd: string
  timeZone: string
}): PlannedReminder[] {
  const { bookedAt, startAt, quietStart, quietEnd, timeZone } = input
  const lead = (startAt.getTime() - bookedAt.getTime()) / MINUTE
  const fitting = [...new Set(input.reminders)]
    .filter((minutes) => lead >= minutes + Math.min(minutes, 60))
    .sort((a, b) => b - a)
  const chosen = [...new Set([fitting[0], fitting[fitting.length - 1]])].filter(
    (minutes): minutes is number => minutes !== undefined
  )

  return chosen.flatMap((minutes) => {
    const dueAt = new Date(startAt.getTime() - minutes * MINUTE)
    if (!inQuietHours(dueAt, quietStart, quietEnd, timeZone)) return [{ minutes, dueAt }]
    if (minutes < NOTIFICATION_RULES.longReminderMinutes) return []
    // The evening the quiet hours began: today if it is already late,
    // yesterday if it is the early morning.
    const local = localParts(dueAt, timeZone)
    const evening = local.minutes >= toMinutes(quietStart) ? local.date : previousDay(local.date)
    const moved = instantAt(evening, toMinutes(quietStart) - 60, timeZone)
    return moved.getTime() > bookedAt.getTime() ? [{ minutes, dueAt: moved }] : []
  })
}

// A booking's local date ("YYYY-MM-DD") and time ("HH:mm") in its zone.
export function localDateTime(at: Date, timeZone: string) {
  const { date, minutes } = localParts(at, timeZone)
  const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
  return { date, time }
}
