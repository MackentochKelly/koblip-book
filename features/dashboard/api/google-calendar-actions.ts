"use server"

import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { googleCalendarConnections, teamMembers } from "@/lib/db/schema"
import { endGoogleCalendarConnection } from "@/lib/google-calendar"
import { busyCalendarsOf, listGoogleCalendars } from "@/lib/google-calendar-busy"
import { requestGoogleBusyUpdate } from "@/lib/google-calendar-channels"
import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"
import type { GoogleCalendarChoice } from "../types/google-calendar"
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

async function businessConnection(businessId: string) {
  await getOwnerBusiness(businessId)
  const [row] = await db
    .select({
      id: googleCalendarConnections.id,
      busyCalendarIds: googleCalendarConnections.busyCalendarIds,
    })
    .from(googleCalendarConnections)
    .where(businessConnectionWhere(businessId))
    .limit(1)
  return row ?? null
}

// The Google calendars the owner can tick to block bookings (G4), and which
// are ticked. null when not connected, not allowed or Google can't answer.
export async function getGoogleCalendarChoices(
  businessId: string
): Promise<GoogleCalendarChoice[] | null> {
  const row = await businessConnection(businessId)
  if (!row) return null
  const calendars = await listGoogleCalendars(row.id).catch(() => null)
  if (!calendars) return null
  const ticked = busyCalendarsOf(row)
  return calendars.map((calendar) => ({
    ...calendar,
    blocks: ticked.includes(calendar.id) || (calendar.primary && ticked.includes("primary")),
  }))
}

// Saves which calendars block bookings: only the account's own calendars,
// at most Google's limit for one read.
export async function setGoogleBusyCalendars(
  businessId: string,
  calendarIds: string[]
): Promise<{ ok: boolean }> {
  if (
    !Array.isArray(calendarIds) ||
    !calendarIds.every((id) => typeof id === "string") ||
    calendarIds.length > GOOGLE_CALENDAR_RULES.maxBusyCalendars
  ) {
    return { ok: false }
  }
  const row = await businessConnection(businessId)
  if (!row) return { ok: false }
  const calendars = await listGoogleCalendars(row.id).catch(() => null)
  const known = new Set(calendars?.map((calendar) => calendar.id))
  if (!calendars || !calendarIds.every((id) => known.has(id))) return { ok: false }
  await db
    .update(googleCalendarConnections)
    .set({ busyCalendarIds: [...new Set(calendarIds)] })
    .where(eq(googleCalendarConnections.id, row.id))
  requestGoogleBusyUpdate(row.id)
  return { ok: true }
}
