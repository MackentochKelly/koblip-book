import "server-only"
import { and, count, desc, eq, gte, isNotNull, or, sql, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, businesses, notificationSends } from "@/lib/db/schema"
import type { ActivityFilter, ActivityState, BusinessNotificationSend } from "@/types/whatsapp"

// A LIKE pattern that finds `text` anywhere, with LIKE's own wildcards
// taken literally.
function contains(text: string): string {
  return `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`
}

// Search by customer name (any case) or phone (its digits, so "+1 555" finds
// 15550100000; each booking keeps the digits in customer_key as "p:<digits>").
function searchCondition(search: string): SQL | undefined {
  const text = search.trim()
  if (!text) return undefined
  const byName = sql`${bookings.customerName} like ${contains(text)} escape '\\'`
  const digits = text.replace(/\D/g, "")
  if (!digits) return byName
  return or(byName, sql`${bookings.customerKey} like ${`p:${contains(digits)}`} escape '\\'`)
}

// The status filter: a state, or the read and answered views (D36).
function stateCondition(state: ActivityState): SQL | undefined {
  if (state === "read") return eq(notificationSends.delivery, "read")
  if (state === "replied") return isNotNull(notificationSends.replyAction)
  return eq(notificationSends.state, state)
}

// The latest messages, newest first: what is waiting, sent, or was not sent
// and why; narrowed by message, state and a search (D4). One business's for
// its WhatsApp page, or every business's for the admin (A5, D33). Callers
// check who may see them.
export async function whatsappActivity(
  filter: ActivityFilter,
  { businessId, limit }: { businessId?: string; limit: number }
): Promise<BusinessNotificationSend[]> {
  const rows = await db
    .select({
      id: notificationSends.id,
      businessId: notificationSends.businessId,
      businessName: businesses.name,
      timeZone: businesses.timezone,
      message: notificationSends.message,
      customerName: bookings.customerName,
      dueAt: notificationSends.dueAt,
      sentAt: notificationSends.sentAt,
      state: notificationSends.state,
      reason: notificationSends.reason,
      delivery: notificationSends.delivery,
      via: notificationSends.via,
      sender: notificationSends.sender,
      replyAction: notificationSends.replyAction,
      repliedAt: notificationSends.repliedAt,
    })
    .from(notificationSends)
    .innerJoin(bookings, eq(bookings.id, notificationSends.bookingId))
    .innerJoin(businesses, eq(businesses.id, notificationSends.businessId))
    .where(
      and(
        businessId ? eq(notificationSends.businessId, businessId) : undefined,
        filter.message ? eq(notificationSends.message, filter.message) : undefined,
        filter.state ? stateCondition(filter.state) : undefined,
        filter.search ? searchCondition(filter.search) : undefined
      )
    )
    .orderBy(desc(notificationSends.dueAt))
    .limit(limit)
  return rows.map(({ dueAt, sentAt, replyAction, repliedAt, ...row }) => ({
    ...row,
    at: sentAt ?? dueAt,
    reply: replyAction && repliedAt ? { action: replyAction, at: repliedAt } : null,
  }))
}

export type ActivityStats = { sent: number; read: number; replied: number; failed: number }

// One business's messages over the last `days` (by when each went or was
// due), for the Notifications Overview (D36): sent, read by the customer,
// answered with a button, and failed. Each matches one Activity filter.
export async function whatsappActivityStats(
  businessId: string,
  days: number
): Promise<ActivityStats> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const at = sql`coalesce(${notificationSends.sentAt}, ${notificationSends.dueAt})`
  const counted = (condition: SQL | undefined) =>
    db
      .select({ value: count() })
      .from(notificationSends)
      .where(and(eq(notificationSends.businessId, businessId), gte(at, since), condition))
      .then(([row]) => row?.value ?? 0)
  const [sent, read, replied, failed] = await Promise.all([
    counted(stateCondition("sent")),
    counted(stateCondition("read")),
    counted(stateCondition("replied")),
    counted(stateCondition("failed")),
  ])
  return { sent, read, replied, failed }
}
