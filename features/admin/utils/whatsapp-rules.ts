import type { NotificationRuleKey } from "@/lib/notification-rules"

// How the admin's Rules screen shows and edits each rule (A7). Typed by
// every key, so a new rule in lib/notification-rules.ts must be placed here.
export type RuleUnit =
  | "minutesList"
  | "minutes"
  | "seconds"
  | "characters"
  | "count"
  | "words"
  | "days"
  | "percent"
  | "switch"
  | "clock"
  | "cantCome"

export const RULE_UNITS: Record<NotificationRuleKey, RuleUnit> = {
  defaultReminders: "minutesList",
  reminderChoices: "minutesList",
  maxReminders: "count",
  longReminderMinutes: "minutes",
  sendEverySeconds: "seconds",
  sendBatch: "count",
  freeTextMinutes: "minutes",
  stuckSendingMinutes: "minutes",
  historySize: "count",
  statsDays: "count",
  defaultFreeTextInWindow: "switch",
  defaultCantCome: "cantCome",
  defaultThankYouReply: "switch",
  maxButtons: "count",
  maxButtonLabel: "characters",
  defaultQuietStart: "clock",
  defaultQuietEnd: "clock",
  maxHeader: "characters",
  maxBody: "characters",
  maxFooter: "characters",
  minWordsPerField: "words",
  koblipMonthlyTemplates: "count",
  koblipLimitNearPercent: "percent",
  inAppKeepDays: "days",
  inAppPageSize: "count",
  inAppPollSeconds: "seconds",
}

// The rules in groups, in the order the screen shows them.
export const RULE_GROUPS = [
  {
    id: "timing",
    keys: [
      "defaultReminders",
      "reminderChoices",
      "maxReminders",
      "longReminderMinutes",
      "defaultQuietStart",
      "defaultQuietEnd",
    ],
  },
  {
    id: "replies",
    keys: [
      "freeTextMinutes",
      "defaultFreeTextInWindow",
      "defaultCantCome",
      "defaultThankYouReply",
    ],
  },
  {
    id: "sending",
    keys: [
      "sendEverySeconds",
      "sendBatch",
      "stuckSendingMinutes",
      "historySize",
      "statsDays",
      "koblipMonthlyTemplates",
      "koblipLimitNearPercent",
    ],
  },
  {
    id: "inApp",
    keys: ["inAppKeepDays", "inAppPageSize", "inAppPollSeconds"],
  },
  {
    id: "wording",
    keys: [
      "maxButtons",
      "maxButtonLabel",
      "maxHeader",
      "maxBody",
      "maxFooter",
      "minWordsPerField",
    ],
  },
] as const satisfies readonly {
  id: string
  keys: readonly NotificationRuleKey[]
}[]

export const CANT_COME_CHOICES = ["alertOnly", "cancel"] as const
