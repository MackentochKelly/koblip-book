import "server-only"

import { and, eq, isNotNull } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businessSettings, businesses } from "@/lib/db/schema"
import { koblipTemplatesSentByBusiness, usageMonth } from "@/lib/koblip-usage"
import { NOTIFICATION_RULES, NOTIFICATION_RULE_CHECKS } from "@/lib/notification-rules"
import { notificationRules } from "@/lib/platform-settings"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

export interface UsageBusiness {
  id: string
  name: string
  // Templates sent from Koblip's number this month.
  sent: number
  // This business's own limit, or null for everyone's.
  ownLimit: number | null
  limit: number
}

export interface WhatsappUsage {
  // The first moment of this month (UTC, ISO), for its name.
  month: string
  // Everyone's limit: the admin's value, else the default.
  limit: number
  defaultLimit: number
  // The admin changed everyone's limit from the default.
  changed: boolean
  businesses: UsageBusiness[]
}

const KEY = "koblipMonthlyTemplates"

// WhatsApp → Usage (A8): this month's templates from Koblip's number for
// each business it may send for (an owner, not a demo, D22), most first,
// with each one's limit (D3, K6).
export async function getWhatsappUsage(now = new Date()): Promise<WhatsappUsage> {
  await requireAdmin()
  const [rules, sent, served, own] = await Promise.all([
    notificationRules(),
    koblipTemplatesSentByBusiness(now),
    db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(and(isNotNull(businesses.ownerId), eq(businesses.isDemo, false))),
    db
      .select({ businessId: businessSettings.businessId, value: businessSettings.value })
      .from(businessSettings)
      .where(eq(businessSettings.key, KEY)),
  ])
  const limits = new Map(
    own
      .filter(({ value }) => NOTIFICATION_RULE_CHECKS[KEY](value))
      .map(({ businessId, value }) => [businessId, value as number])
  )
  const limit = rules[KEY]
  const defaultLimit = NOTIFICATION_RULES[KEY]
  return {
    month: usageMonth(now).start,
    limit,
    defaultLimit,
    changed: limit !== defaultLimit,
    businesses: served
      .map(({ id, name }) => {
        const ownLimit = limits.get(id) ?? null
        return { id, name, sent: sent.get(id) ?? 0, ownLimit, limit: ownLimit ?? limit }
      })
      .sort((a, b) => b.sent - a.sent || a.name.localeCompare(b.name))
      .slice(0, WHATSAPP_ADMIN_RULES.listRows),
  }
}
