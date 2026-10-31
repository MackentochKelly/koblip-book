// Google Calendar sync (docs/plans/google-calendar.md).
export const GOOGLE_CALENDAR_RULES = {
  // How often the server's timer sends booking changes to Google.
  syncEverySeconds: 60,
  // At most this many events sent per connection in one sync; the rest go
  // in the next one (Google's per-user rate limits).
  maxChangesPerSync: 50,
  // Bookings that ended up to this long ago are still kept in sync.
  keepPastHours: 24,
  // The calendar Book makes in each Google account.
  calendarName: "Koblip Book",
} as const
