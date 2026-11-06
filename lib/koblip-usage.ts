import "server-only"

import { and, count, eq, gte, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessSettings, notificationSends } from "@/lib/db/schema"
import { NOTIFICATION_RULE_CHECKS, type NotificationRules } from "@/lib/notification-rules"
import { businessPlan } from "@/lib/plan-access"
import type { Plan } from "@/lib/plan-features"

// Koblip's number pays Meta for each template it sends, so each business
// gets a number of them per calendar month (D3, K6) by its plan. Months
// run in UTC, as Meta bills. Normal messages inside 24 hours do not count.

const OWN_LIMIT = "koblipMonthlyTemplates"

// A plan's monthly templates on Koblip's number (docs/plans/subscriptions.md, O4).
export function planTemplateLimit(plan: Plan, rules: NotificationRules) {
  return plan === "pro" ? rules.koblipMonthlyTemplatesPro : rules.koblipMonthlyTemplates
}

// One business's limit: its own, when the admin set one, else its plan's.
// `rules` are everyone's (notificationRules() without a business).
export async function koblipTemplateLimit(businessId: string, rules: NotificationRules) {
  const [[own], plan] = await Promise.all([
    db
      .select({ value: businessSettings.value })
      .from(businessSettings)
      .where(and(eq(businessSettings.businessId, businessId), eq(businessSettings.key, OWN_LIMIT)))
      .limit(1),
    businessPlan(businessId),
  ])
  return own && NOTIFICATION_RULE_CHECKS[OWN_LIMIT](own.value)
    ? (own.value as number)
    : planTemplateLimit(plan, rules)
}

export function usageMonth(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
  return { start: start.toISOString(), end: end.toISOString() }
}

// A template sent from Koblip's number in `now`'s month.
function countedIn(now: Date) {
  const { start, end } = usageMonth(now)
  return and(
    eq(notificationSends.sender, "koblip"),
    eq(notificationSends.via, "template"),
    eq(notificationSends.state, "sent"),
    gte(notificationSends.sentAt, start),
    lt(notificationSends.sentAt, end)
  )
}

// Templates sent from Koblip's number for one business in `now`'s month.
export async function koblipTemplatesSent(businessId: string, now = new Date()) {
  const [row] = await db
    .select({ n: count() })
    .from(notificationSends)
    .where(and(eq(notificationSends.businessId, businessId), countedIn(now)))
  return row.n
}

// The same count for every business that sent any this month (A8's Usage).
export async function koblipTemplatesSentByBusiness(now = new Date()) {
  const rows = await db
    .select({ businessId: notificationSends.businessId, n: count() })
    .from(notificationSends)
    .where(countedIn(now))
    .groupBy(notificationSends.businessId)
  return new Map(rows.map(({ businessId, n }) => [businessId, n]))
}
