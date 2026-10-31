// Google Calendar sync (docs/plans/google-calendar.md).
export const GOOGLE_CALENDAR_RULES = {
  // Booking changes go to Google right away; the server's timer also checks
  // this often, for any change that didn't go through.
  syncEverySeconds: 60,
  // Busy times are read again when Google says a calendar changed (push).
  // Google says some push messages get lost, so they are also read again
  // this often as a safety check.
  busySafetyMinutes: 60,
  // Without push (a site without HTTPS, such as localhost, where Google
  // can't call back), busy times are read this often instead.
  busyWithoutPushSeconds: 120,
  // At most this many calendars block bookings: Google reads busy times
  // from 50 calendars at most in one call.
  maxBusyCalendars: 50,
  // A push channel is renewed this long before Google ends it.
  renewChannelHours: 24,
  // At most this many events sent per connection in one sync; the rest go
  // in the next one (Google's per-user rate limits).
  maxChangesPerSync: 50,
  // Bookings that ended up to this long ago are still kept in sync.
  keepPastHours: 24,
  // A team member's link to connect their calendar works this long (G5).
  inviteDays: 7,
  // The calendar Book makes in each Google account.
  calendarName: "Koblip Book",
} as const
