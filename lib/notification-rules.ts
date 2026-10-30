// WhatsApp booking notifications: the defaults a business starts with and the
// limits its owner edits within (docs/koblip-chat-integration.md, step 2).
export const NOTIFICATION_RULES = {
  // Reminders before the visit, in minutes: 24 hours, 2 hours, 30 minutes.
  defaultReminders: [1440, 120, 30],
  // The times an owner can pick for a reminder.
  reminderChoices: [15, 30, 60, 120, 180, 360, 720, 1440, 2880],
  maxReminders: 3,
  // No messages at night, in the business's time zone.
  defaultQuietStart: "21:00",
  defaultQuietEnd: "08:00",
  // Meta's limits for a template's parts (characters).
  maxHeader: 60,
  maxBody: 1024,
  maxFooter: 60,
} as const
