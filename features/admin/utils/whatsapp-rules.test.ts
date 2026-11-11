import { createTranslator } from "next-intl"
import { expect, test } from "vitest"
import messages from "@/i18n/messages"
import { durationIn } from "@/lib/format-duration"
import {
  NOTIFICATION_RULES,
  NOTIFICATION_RULE_CHECKS,
  type NotificationRuleKey,
} from "@/lib/notification-rules"
import { formatRuleValue, parseRuleInput, ruleInputOf } from "./rule-values"
import { EMAIL_RULE_GROUPS, RULE_GROUPS } from "./whatsapp-rules"

const keys = Object.keys(NOTIFICATION_RULES) as NotificationRuleKey[]

test("every rule is in one WhatsApp group, or on Email → Rules", () => {
  const placed = RULE_GROUPS.flatMap((group) => [...group.keys])
  expect(new Set(placed).size).toBe(placed.length)
  const shown = new Set([...placed, ...EMAIL_RULE_GROUPS.flatMap((group) => [...group.keys])])
  expect([...shown].sort()).toEqual([...keys].sort())
})

test("each default, shown in the edit box and read back, is the same allowed value", () => {
  for (const key of keys) {
    const value = parseRuleInput(key, ruleInputOf(key, NOTIFICATION_RULES[key]))
    expect(value, key).toEqual(NOTIFICATION_RULES[key])
    expect(NOTIFICATION_RULE_CHECKS[key](value), key).toBe(true)
  }
})

test("typed values: minutes lists, numbers, and what cannot be one", () => {
  expect(parseRuleInput("defaultReminders", " 1440, 120 ,30 ")).toEqual([
    1440, 120, 30,
  ])
  expect(parseRuleInput("defaultReminders", "60, soon")).toBeUndefined()
  expect(parseRuleInput("sendBatch", "25")).toBe(25)
  expect(parseRuleInput("sendBatch", "")).toBeUndefined()
  expect(parseRuleInput("minWordsPerField", "2.2")).toBe(2.2)
})

test("values read in their unit", () => {
  const t = createTranslator({
    locale: "en-US",
    messages,
    namespace: "admin.whatsapp.rules",
  })
  const duration = createTranslator({
    locale: "en-US",
    messages,
    namespace: "app.duration",
  })
  const minutes = (n: number) => durationIn(duration, n)
  expect(formatRuleValue("defaultReminders", [1440, 120, 30], t, "en-US", minutes)).toBe(
    "24 h, 2 h, 30 min"
  )
  expect(formatRuleValue("maxButtonLabel", 25, t, "en-US", minutes)).toBe("25 characters")
  expect(formatRuleValue("maxButtonLabel", 1, t, "en-US", minutes)).toBe("1 character")
  expect(formatRuleValue("defaultCantCome", "cancel", t, "en-US", minutes)).toBe(
    "Cancels and frees the time"
  )
  expect(formatRuleValue("defaultThankYouReply", false, t, "en-US", minutes)).toBe("Off")
})
