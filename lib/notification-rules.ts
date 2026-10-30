// WhatsApp booking notifications: the defaults a business starts with and the
// limits its owner edits within (docs/koblip-chat-integration.md, step 2).
export const NOTIFICATION_RULES = {
  // Reminders before the visit, in minutes: 24 hours, 2 hours, 30 minutes.
  defaultReminders: [1440, 120, 30],
  // The times an owner can pick for a reminder.
  reminderChoices: [15, 30, 60, 120, 180, 360, 720, 1440, 2880],
  maxReminders: 3,
  // A reminder this long or longer moves out of quiet hours; a shorter one
  // falling in them is skipped.
  longReminderMinutes: 120,
  // How often waiting messages are checked and sent.
  sendEverySeconds: 60,
  // The most messages one check sends.
  sendBatch: 50,
  // Plain text goes only this long after the person last wrote: Meta's
  // 24-hour window, less a margin for clocks and the send itself.
  freeTextMinutes: 24 * 60 - 10,
  // A message still "sending" after this long was cut off (the server
  // stopped); it is marked failed, never sent again.
  stuckSendingMinutes: 10,
  // How many of the latest messages the WhatsApp page's history shows.
  historySize: 30,
  // No messages at night, in the business's time zone.
  defaultQuietStart: "21:00",
  defaultQuietEnd: "08:00",
  // Meta's limits for a template's parts (characters).
  maxHeader: 60,
  maxBody: 1024,
  maxFooter: 60,
} as const
