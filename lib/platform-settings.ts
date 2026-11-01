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

// Automation limits are separate from template limits (notably 20 vs 25
// characters for button labels). Stored overrides use automation.<key>.
export const AUTOMATION_RULES = {
  maxBody: 1024,
  maxButtons: 3,
  maxButtonLabel: 20,
  maxButtonId: 256,
  maxHeader: 60,
  maxFooter: 60,
  maxListBody: 4096,
  maxListRows: 10,
  maxListRowTitle: 24,
  maxListRowDescription: 72,
  maxListRowId: 200,
  maxListSectionTitle: 24,
  welcomeAgainDays: 30,
  handoffQuietHours: 24,
} as const

export type AutomationRules = { [K in keyof typeof AUTOMATION_RULES]: number }

function automationRuleUsable(key: string, value: unknown): boolean {
  if (!Object.hasOwn(AUTOMATION_RULES, key) || typeof value !== "number" || !Number.isSafeInteger(value)) return false
  if (key === "welcomeAgainDays" || key === "handoffQuietHours") return value >= 0
  return value >= 1 && value <= AUTOMATION_RULES[key as keyof AutomationRules]
}

// Both rule groups use the same stored-settings path. Only explicitly allowed
// per-business overrides apply; automation limits currently apply to everyone.
async function storedRules<T extends object>(
  defaults: object,
  accepts: (key: string, value: unknown) => boolean,
  businessId?: string,
  perBusiness: readonly string[] = [],
  prefix = ""
): Promise<T> {
  const rules = structuredClone(defaults) as Record<string, unknown>
  for (const row of await db.select().from(platformSettings)) {
    if (!row.key.startsWith(prefix)) continue
    const key = row.key.slice(prefix.length)
    if (accepts(key, row.value)) rules[key] = row.value
  }
  if (businessId && perBusiness.length) {
    const own = await db.select().from(businessSettings)
      .where(eq(businessSettings.businessId, businessId))
    for (const row of own) {
      if (accepts(row.key, row.value) && perBusiness.includes(row.key)) rules[row.key] = row.value
    }
  }
  return rules as T
}

// The rules for everyone, or for one business when its id is given.
export async function notificationRules(businessId?: string): Promise<NotificationRules> {
  return storedRules<NotificationRules>(NOTIFICATION_RULES, usable, businessId, BUSINESS_RULE_KEYS)
}

export async function automationRules(): Promise<AutomationRules> {
  return storedRules<AutomationRules>(AUTOMATION_RULES, automationRuleUsable, undefined, [], "automation.")
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

// The log entry for an admin's change that is not a rule (a business's
// WhatsApp settings, wording or connection, A4), in the same change log.
// Saved with the change itself through saveAll. `key` says what changed,
// such as `whatsapp.message.reminder`.
export function adminChangeEntry(change: {
  key: string
  businessId: string | null
  before: unknown
  after: unknown
  userId: string
}) {
  return db.insert(platformSettingChanges).values({
    key: change.key,
    businessId: change.businessId,
    before: change.before ?? null,
    after: change.after ?? null,
    changedBy: change.userId,
  })
}
