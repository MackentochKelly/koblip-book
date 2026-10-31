"use server"

import { and, eq, inArray, isNull } from "drizzle-orm"
import { refresh } from "next/cache"

import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, inAppNotifications } from "@/lib/db/schema"
import type { InAppActionResult } from "../types/notifications"

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
