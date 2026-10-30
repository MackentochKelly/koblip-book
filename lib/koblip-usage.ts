import "server-only"

import { and, count, eq, gte, lt } from "drizzle-orm"
import { db } from "@/lib/db"
import { notificationSends } from "@/lib/db/schema"

// Koblip's number pays Meta for each template it sends, so each business
// gets `koblipMonthlyTemplates` of them per calendar month (D3, K6). Months
// run in UTC, as Meta bills. Normal messages inside 24 hours do not count.

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
