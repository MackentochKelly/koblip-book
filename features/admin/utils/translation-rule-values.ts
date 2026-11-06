import { formatDuration } from "@/lib/format-duration"
import type { TranslationRuleKey } from "@/lib/translations/rules"
import type { AdminMessages } from "../i18n"

// How Admin → Translations → Rules shows and edits each rule. Typed by every
// key, so a new rule in lib/translations/rules.ts must be placed here.
export type TranslationRuleUnit = "minutesList" | "characters" | "count"

export const TRANSLATION_RULE_UNITS: Record<TranslationRuleKey, TranslationRuleUnit> = {
  retryMinutes: "minutesList",
  dailyBusinessCharacters: "characters",
  runTexts: "count",
  requestCharacters: "characters",
  requestTexts: "count",
}

// A rule's value as words ("1 min, 5 min, 30 min", "50,000 characters").
export function formatTranslationRule(
  key: TranslationRuleKey,
  value: unknown,
  m: AdminMessages
): string {
  const number = new Intl.NumberFormat(m.locale)
  switch (TRANSLATION_RULE_UNITS[key]) {
    case "minutesList":
      return Array.isArray(value)
        ? value.map((item) => formatDuration(Number(item))).join(", ")
        : ""
    case "characters":
      return m.translations.rules.characters(number.format(Number(value)))
    case "count":
      return number.format(Number(value))
  }
}

// What the admin typed, as the rule's value; undefined when it cannot be
// one. lib/translations/settings.ts still checks it against the rule.
export function parseTranslationRule(
  key: TranslationRuleKey,
  input: string
): unknown {
  const text = input.trim()
  if (TRANSLATION_RULE_UNITS[key] === "minutesList") {
    const parts = text.split(",").map((part) => part.trim())
    if (parts.some((part) => !/^\d+$/.test(part))) return undefined
    return parts.map(Number)
  }
  const plain = text.replace(/[\s,._]/g, "")
  return /^\d+$/.test(plain) ? Number(plain) : undefined
}

// The value as the edit box shows it.
export function translationRuleInput(
  key: TranslationRuleKey,
  value: unknown
): string {
  return TRANSLATION_RULE_UNITS[key] === "minutesList" && Array.isArray(value)
    ? value.join(", ")
    : String(value)
}
