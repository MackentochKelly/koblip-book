"use server"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { googleCalendarConnections, teamMembers } from "@/lib/db/schema"
import { endGoogleCalendarConnection } from "@/lib/google-calendar"
import { businessConnectionWhere } from "./google-calendar"
import { getOwnerBusiness } from "./queries"

// Disconnect on the Integrations page: ends the connection at Google and
// forgets its tokens here. The "Koblip Book" calendar stays in Google (G10
// lets the owner remove its events).
export async function disconnectGoogleCalendar(
  businessId: string
): Promise<{ ok: true }> {
  await getOwnerBusiness(businessId)
  const [row] = await db
    .select({ id: googleCalendarConnections.id })
    .from(googleCalendarConnections)
    .where(businessConnectionWhere(businessId))
    .limit(1)
  if (row) await endGoogleCalendarConnection(row.id)
  return { ok: true }
}

// Which team member the owner is (G3): their Google busy times block only
// that person; null blocks nobody (or the whole business with no team).
export async function setGoogleCalendarBusyMember(
  businessId: string,
  teamMemberId: string | null
): Promise<{ ok: boolean }> {
  await getOwnerBusiness(businessId)
  if (teamMemberId !== null) {
    if (typeof teamMemberId !== "string") return { ok: false }
    const [member] = await db
      .select({ id: teamMembers.id })
      .from(teamMembers)
      .where(and(eq(teamMembers.id, teamMemberId), eq(teamMembers.businessId, businessId)))
      .limit(1)
    if (!member) return { ok: false }
  }
  await db
    .update(googleCalendarConnections)
    .set({ busyTeamMemberId: teamMemberId })
    .where(businessConnectionWhere(businessId))
  return { ok: true }
}
