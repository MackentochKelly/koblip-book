// The business's Google Calendar connection, as the Integrations screen sees
// it: which Google account, whether to connect again, and whether the last
// sync failed; never a token (docs/plans/google-calendar.md).
export type GoogleCalendarConnection = {
  googleEmail: string
  needsReconnect: boolean
  syncFailed: boolean
}
