import "server-only"
import { and, desc, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businessSettings, platformSettingChanges, platformSettings } from "@/lib/db/schema"
import {
  BUSINESS_RULE_KEYS,
  NOTIFICATION_RULE_CHECKS,
  NOTIFICATION_RULES,
  type NotificationRuleKey,
  type NotificationRules,
} from "@/lib/notification-rules"

// The app's rules as they stand: the defaults in code, the admin's values
// over them, and for one business its own values over those (A0). Only the
// admin area changes them (it checks who is asking); every change is logged.

function isRuleKey(key: string): key is NotificationRuleKey {
  return Object.hasOwn(NOTIFICATION_RULES, key)
}

// A stored value still allowed by its rule; anything else (a rule since
// removed, or narrowed) falls back to the default instead of reaching a send.
function usable(key: string, value: unknown): key is NotificationRuleKey {
  return isRuleKey(key) && NOTIFICATION_RULE_CHECKS[key](value)
}

function defaults(): NotificationRules {
  return structuredClone(NOTIFICATION_RULES) as unknown as NotificationRules
}

// The rules for everyone, or for one business when its id is given.
export async function notificationRules(businessId?: string): Promise<NotificationRules> {
  const rules = defaults() as Record<NotificationRuleKey, unknown>
  for (const row of await db.select().from(platformSettings)) {
    if (usable(row.key, row.value)) rules[row.key] = row.value
  }
  if (businessId) {
    const own = await db
      .select()
      .from(businessSettings)
      .where(eq(businessSettings.businessId, businessId))
    for (const row of own) {
      if (usable(row.key, row.value) && BUSINESS_RULE_KEYS.includes(row.key)) rules[row.key] = row.value
    }
  }
  return rules as NotificationRules
}

export type RuleChange = {
  key: NotificationRuleKey
  // The value to use, or null to go back to the default.
  value: unknown
  userId: string
  // Only for a rule in BUSINESS_RULE_KEYS: this business's own value.
  businessId?: string
}

export class RuleValueError extends Error {
  constructor(readonly key: string) {
    super(`Not an allowed value for rule ${key}`)
  }
}

// Saves one rule's value (or reset with null) and logs the change, together.
export async function setNotificationRule({ key, value, userId, businessId }: RuleChange) {
  if (!isRuleKey(key)) throw new RuleValueError(key)
  if (businessId && !BUSINESS_RULE_KEYS.includes(key)) throw new RuleValueError(key)
  if (value !== null && !NOTIFICATION_RULE_CHECKS[key](value)) throw new RuleValueError(key)

  let before: unknown
  let save
  if (businessId) {
    const where = and(eq(businessSettings.businessId, businessId), eq(businessSettings.key, key))
    const [row] = await db.select({ value: businessSettings.value }).from(businessSettings).where(where)
    before = row?.value ?? null
    save =
      value === null
        ? db.delete(businessSettings).where(where)
        : db
            .insert(businessSettings)
            .values({ businessId, key, value, updatedBy: userId })
            .onConflictDoUpdate({
              target: [businessSettings.businessId, businessSettings.key],
              set: { value, updatedBy: userId },
            })
  } else {
    const where = eq(platformSettings.key, key)
    const [row] = await db.select({ value: platformSettings.value }).from(platformSettings).where(where)
    before = row?.value ?? null
    save =
      value === null
        ? db.delete(platformSettings).where(where)
        : db
            .insert(platformSettings)
            .values({ key, value, updatedBy: userId })
            .onConflictDoUpdate({ target: platformSettings.key, set: { value, updatedBy: userId } })
  }
  if (JSON.stringify(before) === JSON.stringify(value)) return
  await saveAll([
    save,
    db.insert(platformSettingChanges).values({
      key,
      businessId: businessId ?? null,
      before,
      after: value,
      changedBy: userId,
    }),
  ])
}

// Each rule for the admin's editor: its default, the admin's value if set,
// and whether a business may have its own.
export async function notificationRuleSettings() {
  const saved = new Map<string, unknown>()
  for (const row of await db.select().from(platformSettings)) {
    if (usable(row.key, row.value)) saved.set(row.key, row.value)
  }
  return (Object.keys(NOTIFICATION_RULES) as NotificationRuleKey[]).map((key) => ({
    key,
    defaultValue: NOTIFICATION_RULES[key] as unknown,
    value: saved.has(key) ? saved.get(key) : null,
    perBusiness: BUSINESS_RULE_KEYS.includes(key),
  }))
}

// The change log, newest first.
export async function notificationRuleChanges(limit = 100) {
  return db
    .select()
    .from(platformSettingChanges)
    .orderBy(desc(platformSettingChanges.id))
    .limit(limit)
}
