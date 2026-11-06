// A booking as a calendar event (docs/plans/client-account.md, D12): an
// iCalendar file (RFC 5545) every calendar app opens, and Google
// Calendar's "add event" link. Nothing is stored and no sign-in is needed.

export type CalendarEvent = {
  // Stable per booking, so adding it again updates the same event.
  id: string
  title: string
  // ISO instants.
  startAt: string
  endAt: string
  location: string | null
  details: string | null
}

// 2026-11-07T15:00:00.000Z → 20261107T150000Z (RFC 5545 3.3.5, UTC form).
function utcStamp(iso: string) {
  return new Date(iso)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")
}

// TEXT values escape backslash, semicolon, comma and line breaks
// (RFC 5545 3.3.11).
function text(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n")
}

// Lines longer than 75 octets fold onto lines starting with a space
// (RFC 5545 3.1), never splitting a character.
function fold(line: string) {
  const bytes = new TextEncoder()
  const parts: string[] = []
  let current = ""
  for (const char of line) {
    const limit = parts.length === 0 ? 75 : 74
    if (bytes.encode(current + char).length > limit) {
      parts.push(current)
      current = char
    } else {
      current += char
    }
  }
  parts.push(current)
  return parts.join("\r\n ")
}

export function calendarFile(event: CalendarEvent, now = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Koblip//Koblip Book//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@koblip.com`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    `DTSTART:${utcStamp(event.startAt)}`,
    `DTEND:${utcStamp(event.endAt)}`,
    `SUMMARY:${text(event.title)}`,
    ...(event.location ? [`LOCATION:${text(event.location)}`] : []),
    ...(event.details ? [`DESCRIPTION:${text(event.details)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lines.map(fold).join("\r\n") + "\r\n"
}

// Google Calendar's event template link.
export function googleCalendarHref(event: CalendarEvent): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${utcStamp(event.startAt)}/${utcStamp(event.endAt)}`,
  })
  if (event.location) params.set("location", event.location)
  if (event.details) params.set("details", event.details)
  return `https://calendar.google.com/calendar/render?${params}`
}
