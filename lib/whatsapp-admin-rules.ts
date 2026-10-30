// What the admin's WhatsApp Overview checks (docs/plans/whatsapp-notifications.md,
// A2). Not rules a send follows, so not in lib/notification-rules.ts.
export const WHATSAPP_ADMIN_RULES = {
  // The timer counts as stopped when its last check is older than this many
  // of its waits (`sendEverySeconds`).
  timerLateAfterChecks: 3,
  // Failed messages are counted over this many days.
  failedDays: 7,
  // How long to wait for Koblip Chat to answer before calling it out of reach.
  chatCheckSeconds: 5,
  // The most rows a WhatsApp list shows (24-hour window, Activity), newest
  // first.
  listRows: 200,
  // The server settings WhatsApp needs (.env.local); only whether each is set
  // is ever shown, never its value.
  secrets: [
    "CHAT_API_URL",
    "CHAT_CONNECT_URL",
    "CHAT_OAUTH_CLIENT_ID",
    "CHAT_OAUTH_CLIENT_SECRET",
    "CHAT_OAUTH_REDIRECT_URI",
    "CHAT_EVENTS_SECRET",
    "TOKEN_ENCRYPTION_KEY",
  ],
} as const
