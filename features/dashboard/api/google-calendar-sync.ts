import "server-only"
import { createHash } from "node:crypto"
import { and, asc, eq, gte } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  googleCalendarConnections,
  googleCalendarEvents,
} from "@/lib/db/schema"
import { GoogleCalendarError, googleCalendarApi } from "@/lib/google-calendar"
import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"
import { runInTurn } from "@/lib/run-in-turn"

// Sends bookings to Google Calendar (G2 in docs/plans/google-calendar.md):
// each booking is one event in the connection's "Koblip Book" calendar. A
// fingerprint of what was sent finds what is new, moved, changed or
// cancelled, so each sync sends only that. Runs on the server's timer, never
// inside a booking.

// Raised whenever the event's content changes, so every event is sent again.
const EVENT_VERSION = 1

type Booking = typeof bookings.$inferSelect

// Google accepts our own event ids in base32hex (a-v, 0-9), 5 to 1024
// characters: hex from the booking id, so a retry never makes a second event.
export function eventIdOf(bookingId: string) {
  return createHash("sha256").update(bookingId).digest("hex").slice(0, 40)
}

export function eventOf(booking: Booking, timeZone: string) {
  return {
    summary: `${booking.serviceName} · ${booking.customerName}`,
    start: { dateTime: booking.startAt, timeZone },
    end: { dateTime: booking.endAt, timeZone },
    // A removed event keeps its id at Google; this brings it back.
    status: "confirmed",
    extendedProperties: { private: { koblipBookingId: booking.id } },
  }
}

// What a cancelled booking's event is: removed.
const CANCELLED = "cancelled"

export function fingerprintOf(booking: Booking, timeZone: string) {
  if (booking.status === "cancelled") return CANCELLED
  return createHash("sha256")
    .update(JSON.stringify([EVENT_VERSION, eventOf(booking, timeZone)]))
    .digest("base64url")
}

// The connection's calendar is gone (the person removed it in Google).
class CalendarGone extends Error {}

async function makeCalendar(connectionId: string, timeZone: string) {
  const calendar = await googleCalendarApi<{ id: string }>(connectionId, "/calendars", {
    method: "POST",
    body: { summary: GOOGLE_CALENDAR_RULES.calendarName, timeZone },
  })
  if (!calendar?.id) throw new GoogleCalendarError(null, "no_calendar")
  await db
    .update(googleCalendarConnections)
    .set({ calendarId: calendar.id })
    .where(eq(googleCalendarConnections.id, connectionId))
  return calendar.id
}

function isStatus(error: unknown, ...statuses: number[]) {
  return error instanceof GoogleCalendarError && statuses.includes(error.status ?? 0)
}

async function putEvent(
  connectionId: string,
  calendarId: string,
  eventId: string,
  body: ReturnType<typeof eventOf>,
  sentBefore: boolean
) {
  const events = `/calendars/${encodeURIComponent(calendarId)}/events`
  const update = () =>
    googleCalendarApi(connectionId, `${events}/${eventId}`, { method: "PUT", body })
  const insert = async () => {
    try {
      await googleCalendarApi(connectionId, events, { method: "POST", body: { id: eventId, ...body } })
    } catch (error) {
      // The id is already there (sent before, maybe removed): update it.
      if (isStatus(error, 409)) return update()
      if (isStatus(error, 404)) throw new CalendarGone()
      throw error
    }
  }
  if (!sentBefore) return insert()
  try {
    await update()
  } catch (error) {
    // Removed at Google for good: make it again.
    if (isStatus(error, 404)) return insert()
    throw error
  }
}

async function removeEvent(connectionId: string, calendarId: string, eventId: string) {
  try {
    await googleCalendarApi(
      connectionId,
      `/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      { method: "DELETE" }
    )
  } catch (error) {
    // Already gone.
    if (!isStatus(error, 404, 410)) throw error
  }
}

async function syncConnection(connectionId: string) {
  const [row] = await db
    .select({ connection: googleCalendarConnections, timeZone: businesses.timezone })
    .from(googleCalendarConnections)
    .innerJoin(businesses, eq(businesses.id, googleCalendarConnections.businessId))
    .where(eq(googleCalendarConnections.id, connectionId))
    .limit(1)
  if (!row || row.connection.needsReconnect) return
  const { connection, timeZone } = row

  let lastError: string | null = null
  try {
    const calendarId = connection.calendarId ?? (await makeCalendar(connection.id, timeZone))
    const since = new Date(Date.now() - GOOGLE_CALENDAR_RULES.keepPastHours * 3_600_000).toISOString()
    const rows = await db
      .select({ booking: bookings, sent: googleCalendarEvents })
      .from(bookings)
      .leftJoin(
        googleCalendarEvents,
        and(
          eq(googleCalendarEvents.bookingId, bookings.id),
          eq(googleCalendarEvents.connectionId, connection.id)
        )
      )
      .where(
        and(
          eq(bookings.businessId, connection.businessId),
          // A team member's own calendar gets only their bookings (G5).
          connection.teamMemberId ? eq(bookings.teamMemberId, connection.teamMemberId) : undefined,
          gte(bookings.endAt, since)
        )
      )
      .orderBy(asc(bookings.startAt))

    let sent = 0
    for (const { booking, sent: before } of rows) {
      const fingerprint = fingerprintOf(booking, timeZone)
      // Unchanged, or cancelled before it was ever sent.
      if (before ? before.fingerprint === fingerprint : fingerprint === CANCELLED) continue
      if (sent >= GOOGLE_CALENDAR_RULES.maxChangesPerSync) break
      sent++
      const eventId = eventIdOf(booking.id)
      if (fingerprint === CANCELLED) {
        await removeEvent(connection.id, calendarId, eventId)
      } else {
        await putEvent(connection.id, calendarId, eventId, eventOf(booking, timeZone), !!before)
      }
      const saved = { eventId, fingerprint, syncedAt: new Date().toISOString() }
      await db
        .insert(googleCalendarEvents)
        .values({ connectionId: connection.id, bookingId: booking.id, ...saved })
        .onConflictDoUpdate({
          target: [googleCalendarEvents.connectionId, googleCalendarEvents.bookingId],
          set: saved,
        })
    }
  } catch (error) {
    if (error instanceof CalendarGone) {
      // Made again, with every event, in the next sync.
      await db
        .update(googleCalendarConnections)
        .set({ calendarId: null })
        .where(eq(googleCalendarConnections.id, connection.id))
      await db.delete(googleCalendarEvents).where(eq(googleCalendarEvents.connectionId, connection.id))
      lastError = "calendar_removed"
    } else if (error instanceof GoogleCalendarError) {
      // Not connected any more: needsReconnect already says so.
      lastError = error.reason === "not_connected" ? null : error.message.slice(0, 200)
    } else {
      console.error(error)
      lastError = (error instanceof Error ? error.message : String(error)).slice(0, 200)
    }
  }
  await db
    .update(googleCalendarConnections)
    .set({ lastSyncAt: new Date().toISOString(), lastError })
    .where(eq(googleCalendarConnections.id, connection.id))
}

// Syncs one connection, never two syncs of it at once.
export function syncGoogleCalendar(connectionId: string) {
  return runInTurn(`google-calendar-sync:${connectionId}`, () => syncConnection(connectionId))
}

// Every working connection, one after another.
export async function syncGoogleCalendars() {
  const rows = await db
    .select({ id: googleCalendarConnections.id })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.needsReconnect, false))
  for (const { id } of rows) {
    await syncGoogleCalendar(id)
  }
}
