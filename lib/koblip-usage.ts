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

// Templates sent from Koblip's number for one business in `now`'s month.
export async function koblipTemplatesSent(businessId: string, now = new Date()) {
  const { start, end } = usageMonth(now)
  const [row] = await db
    .select({ n: count() })
    .from(notificationSends)
    .where(
      and(
        eq(notificationSends.businessId, businessId),
        eq(notificationSends.sender, "koblip"),
        eq(notificationSends.via, "template"),
        eq(notificationSends.state, "sent"),
        gte(notificationSends.sentAt, start),
        lt(notificationSends.sentAt, end)
      )
    )
  return row.n
}
