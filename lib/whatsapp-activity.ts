import "server-only"
import { and, desc, eq, or, sql, type SQL } from "drizzle-orm"

import { db } from "@/lib/db"
import { bookings, businesses, notificationSends } from "@/lib/db/schema"
import type { ActivityFilter, BusinessNotificationSend } from "@/types/whatsapp"

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
        filter.state ? eq(notificationSends.state, filter.state) : undefined,
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
