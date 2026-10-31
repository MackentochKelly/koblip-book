import "server-only"
import { and, count, desc, eq, isNull, lt, or, type SQL } from "drizzle-orm"

import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, inAppNotifications } from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import type { InAppFeed, InAppPage } from "../types/notifications"

// The owner's bell (docs/plans/in-app-notifications.md, N1): every business
// the owner owns, newest first.

const ownedBy = (userId: string) => eq(businesses.ownerId, userId)

// "<createdAt>|<id>" of the last item shown: the next page starts after it.
function after(cursor: string | undefined): SQL | undefined {
  if (!cursor) return undefined
  const split = cursor.lastIndexOf("|")
  if (split < 1) return undefined
  const at = cursor.slice(0, split)
  const id = cursor.slice(split + 1)
  return or(
    lt(inAppNotifications.createdAt, at),
    and(eq(inAppNotifications.createdAt, at), lt(inAppNotifications.id, id))
  )
}

export async function notificationPageFor(userId: string, cursor?: string): Promise<InAppPage> {
  const { inAppPageSize } = await notificationRules()
  const rows = await db
    .select({
      id: inAppNotifications.id,
      kind: inAppNotifications.kind,
      businessId: inAppNotifications.businessId,
      businessName: businesses.name,
      timezone: businesses.timezone,
      data: inAppNotifications.data,
      link: inAppNotifications.link,
      readAt: inAppNotifications.readAt,
      at: inAppNotifications.createdAt,
    })
    .from(inAppNotifications)
    .innerJoin(businesses, eq(businesses.id, inAppNotifications.businessId))
    .where(and(ownedBy(userId), after(cursor)))
    .orderBy(desc(inAppNotifications.createdAt), desc(inAppNotifications.id))
    .limit(inAppPageSize + 1)
  const items = rows.slice(0, inAppPageSize).map(({ readAt, ...row }) => ({ ...row, read: !!readAt }))
  const last = items.at(-1)
  return {
    items,
    nextCursor: rows.length > inAppPageSize && last ? `${last.at}|${last.id}` : null,
  }
}

export async function unreadCountFor(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(inAppNotifications)
    .innerJoin(businesses, eq(businesses.id, inAppNotifications.businessId))
    .where(and(ownedBy(userId), isNull(inAppNotifications.readAt)))
  return row.n
}

export async function feedFor(userId: string, cursor?: string): Promise<InAppFeed> {
  const [unread, page] = await Promise.all([unreadCountFor(userId), notificationPageFor(userId, cursor)])
  return { unread, page }
}

// For Server Components (the owner layout renders the first count, N-D3).
export async function getUnreadCount() {
  const session = await requireOwner()
  return unreadCountFor(session.userId)
}

export async function getNotificationPage(cursor?: string) {
  const session = await requireOwner()
  return notificationPageFor(session.userId, cursor)
}
