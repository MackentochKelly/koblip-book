"use server"

import { and, eq, inArray, isNull, sql } from "drizzle-orm"
import { refresh } from "next/cache"

import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, inAppNotificationSettings, inAppNotifications } from "@/lib/db/schema"
import { IN_APP_KINDS, type InAppKind } from "@/types/in-app-notifications"
import type { InAppActionResult, InAppChoiceResult } from "../types/notifications"

// Reading notifications in the bell (N1). Each change refreshes the page the
// owner is on, so the count there updates at once (next/cache `refresh`,
// N-D3).

function owned(userId: string) {
  return inArray(
    inAppNotifications.businessId,
    db.select({ id: businesses.id }).from(businesses).where(eq(businesses.ownerId, userId))
  )
}

export async function markNotificationRead(id: string): Promise<InAppActionResult> {
  const session = await requireOwner()
  if (typeof id !== "string") return { ok: false, error: "not_found" }
  const where = and(eq(inAppNotifications.id, id), owned(session.userId))
  const [row] = await db.select({ readAt: inAppNotifications.readAt }).from(inAppNotifications).where(where)
  if (!row) return { ok: false, error: "not_found" }
  if (!row.readAt) {
    await db.update(inAppNotifications).set({ readAt: new Date().toISOString() }).where(where)
    refresh()
  }
  return { ok: true }
}

export async function markAllNotificationsRead(): Promise<InAppActionResult> {
  const session = await requireOwner()
  await db
    .update(inAppNotifications)
    .set({ readAt: new Date().toISOString() })
    .where(and(owned(session.userId), isNull(inAppNotifications.readAt)))
  refresh()
  return { ok: true }
}

// The owner turns one kind on or off for one of their businesses (N3). One
// statement each way, so two quick switches never undo each other.
export async function setNotificationChoice(
  businessId: string,
  kind: InAppKind,
  on: boolean
): Promise<InAppChoiceResult> {
  const session = await requireOwner()
  if (typeof on !== "boolean" || !IN_APP_KINDS.includes(kind)) return { ok: false, error: "invalid" }
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.id, businessId), eq(businesses.ownerId, session.userId)))
    .limit(1)
  if (!business) return { ok: false, error: "not_found" }
  const list = inAppNotificationSettings.turnedOff
  if (on) {
    await db
      .update(inAppNotificationSettings)
      .set({ turnedOff: sql`(select json_group_array(value) from json_each(${list}) where value <> ${kind})` })
      .where(eq(inAppNotificationSettings.businessId, business.id))
  } else {
    await db
      .insert(inAppNotificationSettings)
      .values({ businessId: business.id, turnedOff: [kind] })
      .onConflictDoUpdate({
        target: inAppNotificationSettings.businessId,
        set: {
          turnedOff: sql`case when exists (select 1 from json_each(${list}) where value = ${kind}) then ${list} else json_insert(${list}, '$[#]', ${kind}) end`,
        },
      })
  }
  refresh()
  return { ok: true }
}
