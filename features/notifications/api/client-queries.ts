import "server-only"
import {
  and,
  count,
  desc,
  eq,
  isNull,
  lt,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm"

import { getCustomer, type CustomerSession } from "@/lib/customer-dal"
import { ownBookings } from "@/lib/customer-bookings"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  clientNotificationSettings,
  inAppNotifications,
} from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import {
  CLIENT_IN_APP_KINDS,
  type ClientInAppKind,
} from "@/types/in-app-notifications"
import type { InAppChoice, InAppFeed, InAppPage } from "../types/notifications"

// The client's bell (docs/plans/client-account.md, D10): the notifications
// of the bookings the account owns (lib/customer-bookings.ts), newest first,
// less the kinds the client turned off.

async function turnedOff(userId: string): Promise<ClientInAppKind[]> {
  const [row] = await db
    .select({ turnedOff: clientNotificationSettings.turnedOff })
    .from(clientNotificationSettings)
    .where(eq(clientNotificationSettings.userId, userId))
    .limit(1)
  return row?.turnedOff ?? []
}

// The account's notifications: bookingId is set on every client one, so
// the inner join keeps only the bookings the account owns.
async function mine(customer: CustomerSession): Promise<SQL> {
  const off = await turnedOff(customer.userId)
  return and(
    eq(inAppNotifications.audience, "client"),
    ownBookings(customer),
    off.length ? notInArray(inAppNotifications.kind, off) : undefined
  )!
}

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

export async function clientPageFor(
  customer: CustomerSession,
  cursor?: string
): Promise<InAppPage> {
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
    .innerJoin(bookings, eq(bookings.id, inAppNotifications.bookingId))
    .innerJoin(businesses, eq(businesses.id, inAppNotifications.businessId))
    .where(and(await mine(customer), after(cursor)))
    .orderBy(desc(inAppNotifications.createdAt), desc(inAppNotifications.id))
    .limit(inAppPageSize + 1)
  const items = rows
    .slice(0, inAppPageSize)
    .map(({ readAt, ...row }) => ({ ...row, read: !!readAt }))
  const last = items.at(-1)
  return {
    items,
    nextCursor:
      rows.length > inAppPageSize && last ? `${last.at}|${last.id}` : null,
  }
}

export async function clientUnreadFor(
  customer: CustomerSession
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(inAppNotifications)
    .innerJoin(bookings, eq(bookings.id, inAppNotifications.bookingId))
    .where(and(await mine(customer), isNull(inAppNotifications.readAt)))
  return row.n
}

export async function clientFeedFor(
  customer: CustomerSession,
  cursor?: string
): Promise<InAppFeed> {
  const [unread, page] = await Promise.all([
    clientUnreadFor(customer),
    clientPageFor(customer, cursor),
  ])
  return { unread, page }
}

// For the client area's layout: the first count. 0 when signed out.
export async function getClientUnreadCount() {
  const customer = await getCustomer()
  return customer ? clientUnreadFor(customer) : 0
}

// The client's choices (Settings): every client kind, all on until turned
// off. Null when signed out.
export async function getClientNotificationChoices(): Promise<
  InAppChoice[] | null
> {
  const customer = await getCustomer()
  if (!customer) return null
  const off = await turnedOff(customer.userId)
  return CLIENT_IN_APP_KINDS.map((kind) => ({ kind, on: !off.includes(kind) }))
}
