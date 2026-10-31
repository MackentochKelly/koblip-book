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
  // The days the Notifications Overview counts its numbers over.
  statsDays: 7,
  // Inside 24 hours of the person's last message a normal message goes
  // instead of the template, unless the owner turns it off.
  defaultFreeTextInWindow: true,
  // "Can't make it" only alerts the owner until they choose to cancel
  // (decision D2 in docs/plans/whatsapp-notifications.md).
  defaultCantCome: "alertOnly",
  defaultThankYouReply: true,
  // WhatsApp quick-reply buttons: at most this many, each this many characters.
  maxButtons: 3,
  maxButtonLabel: 25,
  // No messages at night, in the business's time zone.
  defaultQuietStart: "21:00",
  defaultQuietEnd: "08:00",
  // Meta's limits for a template's parts (characters).
  maxHeader: 60,
  maxBody: 1024,
  maxFooter: 60,
  // A message's text needs more words than this for each field, or Meta
  // refuses it ("Params Words Ratio Exceeds Limit"). Meta publishes no number:
  // on 2026-10-30 it refused bodies with 2 words per field and took 2.2.
  minWordsPerField: 2,
  // Template messages one business may send from Koblip's number each
  // calendar month (Koblip pays Meta for them; D3). Normal messages inside
  // 24 hours do not count.
  koblipMonthlyTemplates: 300,
  // The owner hears the Koblip limit is near at this share of it (percent).
  koblipLimitNearPercent: 80,
  // The owner's bell (docs/plans/in-app-notifications.md): notifications are
  // kept this many days, listed this many at a time, and the bell asks for
  // new ones this often while the page is shown.
  inAppKeepDays: 90,
  inAppPageSize: 20,
  inAppPollSeconds: 30,
} as const

// These are the defaults: an admin's values in the database override them
// (lib/platform-settings.ts, A0). Code that sends reads the rules from there.
export type NotificationRules = {
  -readonly [K in keyof typeof NOTIFICATION_RULES]: (typeof NOTIFICATION_RULES)[K] extends readonly number[]
    ? number[]
    : (typeof NOTIFICATION_RULES)[K] extends number
      ? number
      : (typeof NOTIFICATION_RULES)[K] extends boolean
        ? boolean
        : string
}

export type NotificationRuleKey = keyof NotificationRules

// The rules an admin may also set for one business (D3).
export const BUSINESS_RULE_KEYS: readonly NotificationRuleKey[] = ["koblipMonthlyTemplates"]

const wholeAtLeast = (min: number) => (value: unknown) =>
  typeof value === "number" && Number.isInteger(value) && value >= min
const minutes = (value: unknown) =>
  Array.isArray(value) &&
  value.length >= 1 &&
  value.length <= 10 &&
  value.every(wholeAtLeast(1))
const clockTime = (value: unknown) =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)

// What each rule may be set to. A value outside it is never saved.
export const NOTIFICATION_RULE_CHECKS: Record<NotificationRuleKey, (value: unknown) => boolean> = {
  defaultReminders: minutes,
  reminderChoices: minutes,
  maxReminders: wholeAtLeast(1),
  longReminderMinutes: wholeAtLeast(1),
  sendEverySeconds: wholeAtLeast(10),
  sendBatch: wholeAtLeast(1),
  // Never past Meta's own 24 hours.
  freeTextMinutes: (value) => wholeAtLeast(0)(value) && (value as number) <= 24 * 60,
  stuckSendingMinutes: wholeAtLeast(1),
  historySize: wholeAtLeast(1),
  statsDays: (value) => wholeAtLeast(1)(value) && (value as number) <= 90,
  defaultFreeTextInWindow: (value) => typeof value === "boolean",
  // CantComeAction in features/dashboard/types/notifications.ts.
  defaultCantCome: (value) => value === "alertOnly" || value === "cancel",
  defaultThankYouReply: (value) => typeof value === "boolean",
  // Never past Meta's own limits: 3 quick replies, 25 characters each, and
  // 60 / 1024 / 60 characters for a template's header, body and footer.
  maxButtons: (value) => wholeAtLeast(1)(value) && (value as number) <= 3,
  maxButtonLabel: (value) => wholeAtLeast(1)(value) && (value as number) <= 25,
  defaultQuietStart: clockTime,
  defaultQuietEnd: clockTime,
  maxHeader: (value) => wholeAtLeast(1)(value) && (value as number) <= 60,
  maxBody: (value) => wholeAtLeast(1)(value) && (value as number) <= 1024,
  maxFooter: (value) => wholeAtLeast(1)(value) && (value as number) <= 60,
  minWordsPerField: (value) => typeof value === "number" && Number.isFinite(value) && value >= 0,
  koblipMonthlyTemplates: wholeAtLeast(0),
  koblipLimitNearPercent: (value) => wholeAtLeast(1)(value) && (value as number) <= 100,
  inAppKeepDays: wholeAtLeast(1),
  inAppPageSize: (value) => wholeAtLeast(1)(value) && (value as number) <= 100,
  inAppPollSeconds: wholeAtLeast(10),
}
