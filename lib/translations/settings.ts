import "server-only"

import { and, eq, gt, like } from "drizzle-orm"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  platformSettingChanges,
  platformSettings,
  translationEntries,
} from "@/lib/db/schema"
import {
  TRANSLATION_RULE_CHECKS,
  TRANSLATION_RULE_KEYS,
  TRANSLATION_RULES,
  type TranslationRuleKey,
  type TranslationRules,
} from "./rules"

// The translation rules as they stand: the defaults in code, the admin's
// values over them (Admin → Translations → Rules). They live with the app's
// other rules in platform_settings as `translation.<rule>`, and every change
// is logged in platform_setting_changes.

const PREFIX = "translation."

export function isTranslationRuleKey(key: string): key is TranslationRuleKey {
  return (TRANSLATION_RULE_KEYS as readonly string[]).includes(key)
}

async function savedRules(): Promise<Map<TranslationRuleKey, unknown>> {
  const saved = new Map<TranslationRuleKey, unknown>()
  const rows = await db
    .select()
    .from(platformSettings)
    .where(like(platformSettings.key, `${PREFIX}%`))
  for (const row of rows) {
    const key = row.key.slice(PREFIX.length)
    // A value since narrowed or a rule since removed keeps the default.
    if (isTranslationRuleKey(key) && TRANSLATION_RULE_CHECKS[key](row.value)) {
      saved.set(key, row.value)
    }
  }
  return saved
}

// The rules the queue works with.
export async function translationRules(): Promise<TranslationRules> {
  const rules: TranslationRules = { ...TRANSLATION_RULES }
  for (const [key, value] of await savedRules()) {
    Object.assign(rules, { [key]: value })
  }
  return rules
}

export interface TranslationRuleSetting {
  key: TranslationRuleKey
  defaultValue: unknown
  // The admin's value, or null for the default.
  value: unknown
}

// Each rule for the admin's Rules screen.
export async function translationRuleSettings(): Promise<
  TranslationRuleSetting[]
> {
  const saved = await savedRules()
  return TRANSLATION_RULE_KEYS.map((key) => ({
    key,
    defaultValue: TRANSLATION_RULES[key] as unknown,
    value: saved.has(key) ? saved.get(key) : null,
  }))
}

export class TranslationRuleError extends Error {
  constructor(readonly key: string) {
    super(`Not an allowed value for translation rule ${key}`)
  }
}

// Saves one rule's value (null goes back to the default) and logs the
// change, together. A new daily limit counts today: texts the old one held
// for tomorrow (pending, never tried, a next try ahead) are due again, and
// the queue holds back again whatever the new limit still doesn't cover.
export async function setTranslationRule(change: {
  key: TranslationRuleKey
  value: unknown
  userId: string
}): Promise<void> {
  const { key, value, userId } = change
  if (!isTranslationRuleKey(key)) throw new TranslationRuleError(key)
  if (value !== null && !TRANSLATION_RULE_CHECKS[key](value)) {
    throw new TranslationRuleError(key)
  }
  const stored = `${PREFIX}${key}`
  const where = eq(platformSettings.key, stored)
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(where)
  const before = row?.value ?? null
  if (JSON.stringify(before) === JSON.stringify(value)) return
  await saveAll([
    value === null
      ? db.delete(platformSettings).where(where)
      : db
          .insert(platformSettings)
          .values({ key: stored, value, updatedBy: userId })
          .onConflictDoUpdate({
            target: platformSettings.key,
            set: { value, updatedBy: userId },
          }),
    db.insert(platformSettingChanges).values({
      key: stored,
      businessId: null,
      before,
      after: value,
      changedBy: userId,
    }),
    ...(key === "dailyBusinessCharacters"
      ? [
          db
            .update(translationEntries)
            .set({ nextAttemptAt: null })
            .where(
              and(
                eq(translationEntries.status, "pending"),
                eq(translationEntries.attempts, 0),
                gt(translationEntries.nextAttemptAt, new Date().toISOString())
              )
            ),
        ]
      : []),
  ])
}
