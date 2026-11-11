// How a client's visit reminders reach them (docs/plans/client-account.md,
// D16), on top of the bell, which always gets them. WhatsApp is the
// business's own reminder, sent only where the booking agreed to WhatsApp.
export const CLIENT_REMINDER_CHANNELS = ["whatsapp", "email", "bell"] as const

export type ClientReminderChannel = (typeof CLIENT_REMINDER_CHANNELS)[number]

// Until the client picks: as before, the business's WhatsApp reminders.
export const DEFAULT_REMINDER_CHANNEL: ClientReminderChannel = "whatsapp"

export function isClientReminderChannel(
  value: unknown
): value is ClientReminderChannel {
  return CLIENT_REMINDER_CHANNELS.some((channel) => channel === value)
}
