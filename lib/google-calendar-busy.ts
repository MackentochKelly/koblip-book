import "server-only"
import { and, count, eq, gt, inArray, lt } from "drizzle-orm"

import { BOOKING_RULES } from "@/lib/booking-rules"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { googleCalendarBusy, googleCalendarConnections, teamMembers } from "@/lib/db/schema"
import { GOOGLE_SCOPES, googleCalendarApi, googleTurnKey } from "@/lib/google-calendar"
import { runInTurn } from "@/lib/run-in-turn"

// Busy times from Google Calendar (G3 in docs/plans/google-calendar.md). They
// are read with freeBusy (only start and end, never what the time is for)
// when Google pushes a change (lib/google-calendar-channels.ts) and on the
// timer as a safety check, and kept here; the booking page and owner
// bookings read the kept ones, so Google never slows a booking down.

// The calendars that count as busy. G4 lets the owner pick; until then, the
// account's main calendar. Never the "Koblip Book" calendar: its events are
// the bookings themselves.
export const BUSY_CALENDARS = ["primary"]

type FreeBusy = {
  calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }>
}

// Reads a connection's busy times from now to past the last bookable day and
// keeps them in place of the old ones. Throws when Google can't be reached:
// the old ones stay until the next read.
export async function refreshGoogleBusy(connectionId: string) {
  const [row] = await db
    .select({
      scopes: googleCalendarConnections.scopes,
      needsReconnect: googleCalendarConnections.needsReconnect,
    })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.id, connectionId))
    .limit(1)
  if (!row) return
  const checkedAt = new Date().toISOString()
  const done = db
    .update(googleCalendarConnections)
    .set({ busyCheckedAt: checkedAt })
    .where(eq(googleCalendarConnections.id, connectionId))
  const forget = db.delete(googleCalendarBusy).where(eq(googleCalendarBusy.connectionId, connectionId))
  // Not allowed, or not working: old busy times would block for nothing.
  if (row.needsReconnect || !row.scopes.split(" ").includes(GOOGLE_SCOPES.freeBusy)) {
    await saveAll([forget, done])
    return
  }
  const now = Date.now()
  const answer = await googleCalendarApi<FreeBusy>(connectionId, "/freeBusy", {
    method: "POST",
    body: {
      timeMin: new Date(now).toISOString(),
      timeMax: new Date(now + (BOOKING_RULES.daysAhead + 2) * 86_400_000).toISOString(),
      items: BUSY_CALENDARS.map((id) => ({ id })),
    },
  })
  const busy = Object.values(answer?.calendars ?? {}).flatMap((calendar) => calendar.busy ?? [])
  await saveAll([
    forget,
    ...(busy.length
      ? [
          db.insert(googleCalendarBusy).values(
            busy.map((time) => ({
              connectionId,
              startAt: new Date(time.start).toISOString(),
              endAt: new Date(time.end).toISOString(),
            }))
          ),
        ]
      : []),
    done,
  ])
}

// Connections waiting for a read: a burst of Google's calls makes one read.
const queued = new Set<string>()

// Reads a connection's busy times again soon, after any other work with
// Google on it (one at a time).
export function requestGoogleBusyRefresh(connectionId: string) {
  if (queued.has(connectionId)) return
  queued.add(connectionId)
  runInTurn(googleTurnKey(connectionId), () => {
    queued.delete(connectionId)
    return refreshGoogleBusy(connectionId)
  }).catch((error) => console.error(error))
}

export type GoogleBusyTime = {
  startAt: string
  endAt: string
  // The team member it blocks; null blocks the whole business.
  teamMemberId: string | null
}

// The kept busy times of a business between two instants (ISO). A team
// member's own connection blocks them; the business's own blocks the team
// member the owner chose, or the whole business when it has no team.
export async function googleBusyTimes(
  businessId: string,
  from: string,
  to: string
): Promise<GoogleBusyTime[]> {
  const connections = await db
    .select({
      id: googleCalendarConnections.id,
      teamMemberId: googleCalendarConnections.teamMemberId,
      busyTeamMemberId: googleCalendarConnections.busyTeamMemberId,
    })
    .from(googleCalendarConnections)
    .where(
      and(
        eq(googleCalendarConnections.businessId, businessId),
        eq(googleCalendarConnections.needsReconnect, false)
      )
    )
  if (!connections.length) return []
  const [team] = await db
    .select({ count: count() })
    .from(teamMembers)
    .where(eq(teamMembers.businessId, businessId))
  const hasTeam = (team?.count ?? 0) > 0
  const blocks = new Map<string, string | null>()
  for (const connection of connections) {
    const member = connection.teamMemberId ?? connection.busyTeamMemberId
    if (member) blocks.set(connection.id, member)
    else if (!hasTeam) blocks.set(connection.id, null)
  }
  if (!blocks.size) return []
  const rows = await db
    .select()
    .from(googleCalendarBusy)
    .where(
      and(
        inArray(googleCalendarBusy.connectionId, [...blocks.keys()]),
        lt(googleCalendarBusy.startAt, to),
        gt(googleCalendarBusy.endAt, from)
      )
    )
  return rows.map((row) => ({
    startAt: row.startAt,
    endAt: row.endAt,
    teamMemberId: blocks.get(row.connectionId) ?? null,
  }))
}
