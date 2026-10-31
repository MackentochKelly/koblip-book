import "server-only"

import { and, asc, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm"

import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, inAppNotificationSettings, inAppNotifications } from "@/lib/db/schema"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"
import type { InAppData, InAppKind } from "@/types/in-app-notifications"
import type { NotificationFilter } from "../utils/notification-filter"

// Notifications (docs/plans/in-app-notifications.md, N6): every stored in-app
// notification, newest first, and each owner's turned-off kinds. Nothing
// hidden.

export type AdminNotification = {
  id: string
  kind: InAppKind
  businessId: string
  businessName: string
  timezone: string
  data: InAppData
  read: boolean
  at: string
}

export type AdminNotificationChoices = {
  businessId: string
  businessName: string
  turnedOff: InAppKind[]
}

export type AdminNotifications = {
  rows: AdminNotification[]
  // Every business, for the filter.
  businesses: { id: string; name: string }[]
  // Only businesses whose owner turned a kind off.
  choices: AdminNotificationChoices[]
}

export async function getAdminNotifications(filter: NotificationFilter): Promise<AdminNotifications> {
  await requireAdmin()
  const where: SQL[] = []
  if (filter.businessId) where.push(eq(inAppNotifications.businessId, filter.businessId))
  if (filter.kind) where.push(eq(inAppNotifications.kind, filter.kind))
  if (filter.read === "read") where.push(isNotNull(inAppNotifications.readAt))
  if (filter.read === "unread") where.push(isNull(inAppNotifications.readAt))
  const [rows, all, choices] = await Promise.all([
    db
      .select({
        id: inAppNotifications.id,
        kind: inAppNotifications.kind,
        businessId: inAppNotifications.businessId,
        businessName: businesses.name,
        timezone: businesses.timezone,
        data: inAppNotifications.data,
        readAt: inAppNotifications.readAt,
        at: inAppNotifications.createdAt,
      })
      .from(inAppNotifications)
      .innerJoin(businesses, eq(businesses.id, inAppNotifications.businessId))
      .where(and(...where))
      .orderBy(desc(inAppNotifications.createdAt), desc(inAppNotifications.id))
      .limit(WHATSAPP_ADMIN_RULES.listRows),
    db
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.isDemo, false))
      .orderBy(asc(businesses.name)),
    db
      .select({
        businessId: inAppNotificationSettings.businessId,
        businessName: businesses.name,
        turnedOff: inAppNotificationSettings.turnedOff,
      })
      .from(inAppNotificationSettings)
      .innerJoin(businesses, eq(businesses.id, inAppNotificationSettings.businessId))
      .orderBy(asc(businesses.name)),
  ])
  return {
    rows: rows.map(({ readAt, ...row }) => ({ ...row, read: readAt !== null })),
    businesses: all,
    choices: choices.filter(({ turnedOff }) => turnedOff.length > 0),
  }
}
