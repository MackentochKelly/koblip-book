import type { useTranslations } from "next-intl"

import type { NotificationRuleKey } from "@/lib/notification-rules"
import { RULE_UNITS } from "./whatsapp-rules"

// The Rules screen's words (useTranslations or getTranslations).
export type RuleWords = ReturnType<typeof useTranslations<"admin.whatsapp.rules">>

// A rule's value as words, in its unit ("24 h, 2 h, 30 min", "25 characters"),
// numbers as `locale` writes them and lengths of time as `formatDuration`
// does (useFormatDuration).
export function formatRuleValue(
  key: NotificationRuleKey,
  value: unknown,
  t: RuleWords,
  locale: string,
  formatDuration: (minutes: number) => string
) {
  const number = new Intl.NumberFormat(locale)
  switch (RULE_UNITS[key]) {
    case "minutesList":
      return Array.isArray(value)
        ? value.map((item) => formatDuration(Number(item))).join(", ")
        : ""
    case "minutes":
      return formatDuration(Number(value))
    case "seconds":
      return t("seconds", { n: Number(value) })
    case "characters":
      return t("characters", { n: Number(value) })
    case "words":
      return t("words", { n: Number(value) })
    case "days":
      return t("days", { n: Number(value) })
    case "percent":
      return new Intl.NumberFormat(locale, { style: "percent" }).format(Number(value) / 100)
    case "switch":
      return value ? t("on") : t("off")
    case "cantCome":
      return value === "cancel" ? t("cantCome.cancel") : t("cantCome.alertOnly")
    case "clock":
      return String(value)
    case "count":
      return number.format(Number(value))
  }
}

// What the admin typed, as the rule's value; undefined when it cannot be one.
// lib/platform-settings.ts still checks it against the rule.
export function parseRuleInput(
  key: NotificationRuleKey,
  input: string
): unknown {
  const text = input.trim()
  switch (RULE_UNITS[key]) {
    case "minutesList": {
      const parts = text.split(",").map((part) => part.trim())
      if (parts.some((part) => !/^\d+$/.test(part))) return undefined
      return parts.map(Number)
    }
    case "switch":
      return text === "true" ? true : text === "false" ? false : undefined
    case "clock":
    case "cantCome":
      return text
    default:
      return text !== "" && Number.isFinite(Number(text))
        ? Number(text)
        : undefined
  }
}

// The value as the edit box shows it.
export function ruleInputOf(key: NotificationRuleKey, value: unknown): string {
  return RULE_UNITS[key] === "minutesList" && Array.isArray(value)
    ? value.join(", ")
    : String(value)
}
