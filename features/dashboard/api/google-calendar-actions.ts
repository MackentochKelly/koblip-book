"use server"

import { and, eq } from "drizzle-orm"

import { hasFeature } from "@/lib/plan-access"
import { db } from "@/lib/db"
import { googleCalendarConnections, teamMembers } from "@/lib/db/schema"
import { requireOwner } from "@/lib/dal"
import { sendEmail } from "@/lib/email"
import { teamCalendarEmail } from "@/lib/email-templates"
import { endGoogleCalendarConnection } from "@/lib/google-calendar"
import { createGoogleInvite } from "@/lib/google-calendar-invites"
import { busyCalendarsOf, listGoogleCalendars } from "@/lib/google-calendar-busy"
import { requestGoogleBusyUpdate } from "@/lib/google-calendar-channels"
import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"
import { syncGoogleCalendarNow } from "@/lib/google-calendar-sync"
import type { GoogleCalendarChoice } from "../types/google-calendar"
import { businessConnectionWhere } from "./google-calendar"
import { getOwnerLanguage } from "../i18n/server"
import { getOwnerBusiness } from "./queries"

// Disconnect on the Integrations page: ends the connection at Google and
// forgets its tokens here. The "Koblip Book" calendar stays in Google, or
// goes with every booking's event when the owner asks (G10).
export async function disconnectGoogleCalendar(
  businessId: string,
  removeEvents: boolean
): Promise<{ ok: true; eventsRemoved: boolean }> {
  await getOwnerBusiness(businessId)
  const [row] = await db
    .select({ id: googleCalendarConnections.id })
    .from(googleCalendarConnections)
    .where(businessConnectionWhere(businessId))
    .limit(1)
  const ended = row
    ? await endGoogleCalendarConnection(row.id, { removeEvents: removeEvents === true })
    : { eventsRemoved: true }
  return { ok: true, eventsRemoved: ended.eventsRemoved }
}

// Sync now in the Manage panel (G9): the business's calendar gets every
// change and its busy times are read again, right away. Gives back when it
// synced and whether that worked.
export async function syncGoogleCalendarNowFor(
  businessId: string
): Promise<{ ok: true; lastSyncAt: string | null; failed: boolean } | { ok: false }> {
  await getOwnerBusiness(businessId)
  const read = async () => {
    const [row] = await db
      .select({
        id: googleCalendarConnections.id,
        needsReconnect: googleCalendarConnections.needsReconnect,
        lastSyncAt: googleCalendarConnections.lastSyncAt,
        busyCheckedAt: googleCalendarConnections.busyCheckedAt,
        lastError: googleCalendarConnections.lastError,
      })
      .from(googleCalendarConnections)
      .where(businessConnectionWhere(businessId))
      .limit(1)
    return row ?? null
  }
  const before = await read()
  if (!before || before.needsReconnect) return { ok: false }
  const fresh = (iso: string | null) =>
    !!iso && Date.parse(iso) + GOOGLE_CALENDAR_RULES.syncNowSeconds * 1000 > Date.now()
  const after =
    fresh(before.lastSyncAt) && fresh(before.busyCheckedAt)
      ? before
      : (await syncGoogleCalendarNow(before.id), await read())
  if (!after || after.needsReconnect) return { ok: false }
  return { ok: true, lastSyncAt: after.lastSyncAt, failed: !!after.lastError }
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

// A new link for a team member to connect their own Google Calendar (G5):
// emailed when they have an email, and always given back so the owner can
// share it too.
export async function sendTeamCalendarLink(
  businessId: string,
  teamMemberId: string
): Promise<{ ok: true; url: string; emailedTo: string | null } | { ok: false }> {
  const { business, team } = await getOwnerBusiness(businessId)
  const member = team.find((row) => row.id === teamMemberId)
  if (typeof teamMemberId !== "string" || !member) return { ok: false }
  if (!(await hasFeature(businessId, "googleCalendar"))) return { ok: false }
  const session = await requireOwner()
  const { url } = await createGoogleInvite({
    businessId,
    teamMemberId: member.id,
    createdBy: session.userId,
  })
  const emailed =
    !!member.email &&
    (await sendEmail({
      to: member.email,
      ...(await teamCalendarEmail({
        businessName: business.name,
        url,
        days: GOOGLE_CALENDAR_RULES.inviteDays,
        language: await getOwnerLanguage(),
      })),
    }))
  return { ok: true, url, emailedTo: emailed ? member.email : null }
}

// Ends a team member's own Google Calendar connection (G5).
export async function disconnectTeamCalendar(
  businessId: string,
  teamMemberId: string,
  removeEvents: boolean
): Promise<{ ok: true; eventsRemoved: boolean } | { ok: false }> {
  await getOwnerBusiness(businessId)
  if (typeof teamMemberId !== "string") return { ok: false }
  const [row] = await db
    .select({ id: googleCalendarConnections.id })
    .from(googleCalendarConnections)
    .where(
      and(
        eq(googleCalendarConnections.businessId, businessId),
        eq(googleCalendarConnections.teamMemberId, teamMemberId)
      )
    )
    .limit(1)
  const ended = row
    ? await endGoogleCalendarConnection(row.id, { removeEvents: removeEvents === true })
    : { eventsRemoved: true }
  return { ok: true, eventsRemoved: ended.eventsRemoved }
}
