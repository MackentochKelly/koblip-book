import "server-only"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { googleCalendarConnections } from "@/lib/db/schema"
import type { GoogleCalendarConnection } from "../types/google-calendar"

// The business's own Google Calendar connection (not a team member's).
export function businessConnectionWhere(businessId: string) {
  return and(
    eq(googleCalendarConnections.businessId, businessId),
    isNull(googleCalendarConnections.teamMemberId)
  )
}

export async function googleCalendarFor(
  businessId: string
): Promise<GoogleCalendarConnection | null> {
  const [row] = await db
    .select({
      googleEmail: googleCalendarConnections.googleEmail,
      needsReconnect: googleCalendarConnections.needsReconnect,
      lastError: googleCalendarConnections.lastError,
      busyTeamMemberId: googleCalendarConnections.busyTeamMemberId,
    })
    .from(googleCalendarConnections)
    .where(businessConnectionWhere(businessId))
    .limit(1)
  if (!row) return null
  return {
    googleEmail: row.googleEmail,
    needsReconnect: row.needsReconnect,
    syncFailed: !!row.lastError,
    busyTeamMemberId: row.busyTeamMemberId,
  }
}
