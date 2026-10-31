// The Google Calendar connect window (docs/plans/google-calendar.md, G1).

// How Google's window ended: the person allowed, cancelled (or left out the
// calendar), or it failed.
export type GoogleConnectResult = "connected" | "denied" | "failed"

export const GOOGLE_CONNECT_RESULTS: readonly GoogleConnectResult[] = [
  "connected",
  "denied",
  "failed",
]

// The window tells the page that opened it how it ended on this channel
// (same site only), then closes.
export const GOOGLE_CONNECT_CHANNEL = "koblip-google-calendar-connect"

export type GoogleConnectMessage = {
  businessId: string
  result: GoogleConnectResult
}
