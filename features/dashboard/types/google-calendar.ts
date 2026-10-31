// The business's Google Calendar connection, as the Integrations screen sees
// it: which Google account, whether to connect again, and whether the last
// sync failed; never a token (docs/plans/google-calendar.md).
export type GoogleCalendarConnection = {
  googleEmail: string
  needsReconnect: boolean
  syncFailed: boolean
  // When it last synced (ISO), shown next to Sync now (G9).
  lastSyncAt: string | null
  // The team member the owner is: their Google busy times block only them (G3).
  busyTeamMemberId: string | null
}

// One of the account's Google calendars, and whether its busy times block
// bookings (G4).
export type GoogleCalendarChoice = {
  id: string
  name: string
  primary: boolean
  blocks: boolean
}

// A team member's own Google Calendar, as the Team page sees it (G5).
export type TeamCalendar = {
  googleEmail: string
  needsReconnect: boolean
}
