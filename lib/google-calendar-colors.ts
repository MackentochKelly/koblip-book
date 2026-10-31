// The colours a service can give its Google Calendar events (G7 in
// docs/plans/google-calendar.md): Google's own event colours, kept by their
// colorId (developers.google.com/apps-script/reference/calendar/event-color),
// in the order Google Calendar's own picker shows them. No colour leaves
// the event in its calendar's colour.
export const GOOGLE_EVENT_COLORS = ["11", "4", "6", "5", "2", "10", "7", "9", "1", "3", "8"] as const

export type GoogleEventColor = (typeof GOOGLE_EVENT_COLORS)[number]

export function isGoogleEventColor(value: unknown): value is GoogleEventColor {
  return (GOOGLE_EVENT_COLORS as readonly unknown[]).includes(value)
}
