import "server-only"
import { eq, lt, sql } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { businesses, inAppNotificationSettings, inAppNotifications } from "@/lib/db/schema"
import { notificationRules } from "@/lib/platform-settings"
import type { InAppData, InAppKind } from "@/types/in-app-notifications"

// Creating the owner's in-app notifications (docs/plans/in-app-notifications.md,
// N-D2): one shared function, called where each event already happens. The
// bell reads them through features/notifications.

// Where each kind opens, in the business's owner area.
const LINKS: Record<InAppKind, string> = {
  newBooking: "",
  customerCancelled: "",
  customerConfirmed: "",
  customerCantCome: "",
  customerReplied: "/automations/activity",
  messageFailed: "/automations/activity",
  templateApproved: "/automations/messages",
  templateRejected: "/automations/messages",
  koblipLimitNear: "/automations",
  koblipLimitReached: "/automations",
  connectionRenew: "/integrations",
}

export function inAppLink(businessId: string, kind: InAppKind) {
  return `/dashboard/${businessId}${LINKS[kind]}`
}

export type NotifyOptions = {
  // One notification per key and business: a repeat changes nothing.
  dedupeKey?: string
  // With a key, a repeat makes the one notification new and unread again,
  // with the latest facts (a customer who writes again).
  renew?: boolean
}

// The writes for one notification, to save together with what caused it
// (saveAll): none when none is due (a demo copy, or a kind the owner turned
// off). A list, since a query builder returned from an async function would
// run there and then.
export async function notification(
  businessId: string,
  kind: InAppKind,
  data: InAppData,
  { dedupeKey, renew = false }: NotifyOptions = {}
): Promise<BatchItem<"sqlite">[]> {
  const [row] = await db
    .select({ isDemo: businesses.isDemo, turnedOff: inAppNotificationSettings.turnedOff })
    .from(businesses)
    .leftJoin(inAppNotificationSettings, eq(inAppNotificationSettings.businessId, businesses.id))
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!row || row.isDemo || row.turnedOff?.includes(kind)) return []
  const insert = db
    .insert(inAppNotifications)
    .values({ businessId, kind, data, link: inAppLink(businessId, kind), dedupeKey })
  if (!dedupeKey) return [insert]
  return [
    renew
      ? insert.onConflictDoUpdate({
          target: [inAppNotifications.businessId, inAppNotifications.dedupeKey],
          set: { data, readAt: null, createdAt: sql`excluded.created_at` },
        })
      : insert.onConflictDoNothing(),
  ]
}

// The same, saved on its own: for an event that has nothing else to save.
export async function notify(
  businessId: string,
  kind: InAppKind,
  data: InAppData,
  options?: NotifyOptions
) {
  await saveAll(await notification(businessId, kind, data, options))
}

// Notifications older than the admin's `inAppKeepDays`, read or not, are
// removed (N5); the server's timer calls this on each check.
export async function removeOldNotifications(now = new Date()) {
  const { inAppKeepDays } = await notificationRules()
  const before = new Date(now.getTime() - inAppKeepDays * 86_400_000).toISOString()
  await db.delete(inAppNotifications).where(lt(inAppNotifications.createdAt, before))
}
