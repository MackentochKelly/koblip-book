import type { useTranslations } from "next-intl"

import type { TranslationRuleKey } from "@/lib/translations/rules"

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

// Translations → Rules' words (useTranslations or getTranslations).
export type TranslationRuleWords = ReturnType<
  typeof useTranslations<"admin.translations.rules">
>

// A rule's value as words ("1 min, 5 min, 30 min", "50,000 characters"),
// numbers as `locale` writes them and lengths of time as `formatDuration`
// does (useFormatDuration).
export function formatTranslationRule(
  key: TranslationRuleKey,
  value: unknown,
  t: TranslationRuleWords,
  locale: string,
  formatDuration: (minutes: number) => string
): string {
  const number = new Intl.NumberFormat(locale)
  switch (TRANSLATION_RULE_UNITS[key]) {
    case "minutesList":
      return Array.isArray(value)
        ? value.map((item) => formatDuration(Number(item))).join(", ")
        : ""
    case "characters":
      return t("characters", { n: number.format(Number(value)) })
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
