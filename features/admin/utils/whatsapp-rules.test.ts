import { expect, test } from "vitest"
import {
  NOTIFICATION_RULES,
  NOTIFICATION_RULE_CHECKS,
  type NotificationRuleKey,
} from "@/lib/notification-rules"
import { adminMessagesFor } from "../i18n"
import { formatRuleValue, parseRuleInput, ruleInputOf } from "./rule-values"
import { RULE_GROUPS } from "./whatsapp-rules"

const keys = Object.keys(NOTIFICATION_RULES) as NotificationRuleKey[]

test("every rule is in exactly one group", () => {
  const placed = RULE_GROUPS.flatMap((group) => [...group.keys])
  expect([...placed].sort()).toEqual([...keys].sort())
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

test("values read in their unit, in both languages", () => {
  const en = adminMessagesFor("en")
  const es = adminMessagesFor("es")
  expect(formatRuleValue("defaultReminders", [1440, 120, 30], en)).toBe(
    "24 h, 2 h, 30 min"
  )
  expect(formatRuleValue("maxButtonLabel", 25, en)).toBe("25 characters")
  expect(formatRuleValue("maxButtonLabel", 25, es)).toBe("25 caracteres")
  expect(formatRuleValue("defaultCantCome", "cancel", es)).toBe(
    "Cancela y libera la hora"
  )
  expect(formatRuleValue("defaultThankYouReply", false, en)).toBe("Off")
})
