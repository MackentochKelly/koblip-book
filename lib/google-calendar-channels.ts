import "server-only"
import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { googleCalendarChannels, googleCalendarConnections } from "@/lib/db/schema"
import {
  busyCalendarsOf,
  refreshGoogleBusy,
  requestGoogleBusyRefresh,
} from "@/lib/google-calendar-busy"
import { GOOGLE_CALENDAR_RULES } from "@/lib/google-calendar-rules"
import {
  GOOGLE_SCOPES,
  GoogleCalendarError,
  googleCalendarApi,
  googleTurnKey,
  stopGoogleChannel,
} from "@/lib/google-calendar"
import { runInTurn } from "@/lib/run-in-turn"

// Push notifications for busy times (G3), as Google recommends instead of
// asking again and again (developers.google.com/workspace/calendar/api/guides/push):
// a channel per busy calendar, so Google calls /api/google-calendar/notify
// when it changes. Google ends channels on its own and never renews them,
// so the timer makes a new one before the old one ends.

// Where Google calls: only over HTTPS with a valid certificate, so never on
// localhost (busy times are then read on the timer alone).
export function googleNotifyAddress(): string | null {
  const site = process.env.BETTER_AUTH_URL
  if (!site) return null
  const url = new URL("/api/google-calendar/notify", site)
  return url.protocol === "https:" ? url.toString() : null
}

function hashOf(token: string) {
  return createHash("sha256").update(token).digest("hex")
}

type Watch = { id: string; resourceId: string; expiration: string }

// Makes sure each busy calendar of a connection has a channel that is not
// about to end, and stops the ones no longer needed. True when Google
// pushes changes for all of them.
export async function ensureGoogleChannels(connectionId: string): Promise<boolean> {
  const [connection] = await db
    .select({
      scopes: googleCalendarConnections.scopes,
      needsReconnect: googleCalendarConnections.needsReconnect,
      busyCalendarIds: googleCalendarConnections.busyCalendarIds,
    })
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.id, connectionId))
    .limit(1)
  const channels = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.connectionId, connectionId))
  const address = googleNotifyAddress()
  let watching =
    !!address &&
    !!connection &&
    !connection.needsReconnect &&
    connection.scopes.split(" ").includes(GOOGLE_SCOPES.freeBusy)
  const renewAt = Date.now() + GOOGLE_CALENDAR_RULES.renewChannelHours * 3_600_000
  const keep = new Set<string>()
  if (watching && address && connection) {
    for (const calendarId of busyCalendarsOf(connection)) {
      const live = channels.find(
        (channel) => channel.calendarId === calendarId && Date.parse(channel.expiresAt) > renewAt
      )
      if (live) {
        keep.add(live.id)
        continue
      }
      const id = randomUUID()
      const token = randomBytes(32).toString("base64url")
      let watch: Watch | null
      try {
        watch = await googleCalendarApi<Watch>(
          connectionId,
          `/calendars/${encodeURIComponent(calendarId)}/events/watch`,
          { method: "POST", body: { id, type: "web_hook", address, token } }
        )
      } catch (error) {
        // A calendar gone or no longer shared: the timer reads its busy
        // times without push.
        if (error instanceof GoogleCalendarError && (error.status === 403 || error.status === 404)) {
          watching = false
          continue
        }
        throw error
      }
      const expiresAt = Number(watch?.expiration)
      if (!watch?.resourceId || !Number.isFinite(expiresAt)) {
        throw new Error("Google Calendar: watch answered without a channel")
      }
      await db.insert(googleCalendarChannels).values({
        id,
        connectionId,
        calendarId,
        resourceId: watch.resourceId,
        tokenHash: hashOf(token),
        expiresAt: new Date(expiresAt).toISOString(),
      })
      keep.add(id)
    }
  }
  // Old channels end after the new one starts, so no change is missed.
  for (const channel of channels) {
    if (!keep.has(channel.id)) await stopGoogleChannel(connectionId, channel)
  }
  return watching
}

// One call from Google (its X-Goog-* headers). Counts only for a channel Book
// made, with its token; then the connection's busy times are read again.
// The first call of a channel ("sync") only says it started.
export async function handleGoogleNotification(headers: {
  channelId: string | null
  token: string | null
  resourceId: string | null
  state: string | null
}) {
  if (!headers.channelId || !headers.token) return
  const [channel] = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.id, headers.channelId))
    .limit(1)
  if (!channel || channel.resourceId !== headers.resourceId) return
  const expected = Buffer.from(channel.tokenHash)
  const given = Buffer.from(hashOf(headers.token))
  if (!timingSafeEqual(expected, given)) return
  if (headers.state === "sync") return
  requestGoogleBusyRefresh(channel.connectionId)
}

// The owner changed which calendars block bookings (G4): push channels for
// the new ones, and busy times read from them now.
export function requestGoogleBusyUpdate(connectionId: string) {
  runInTurn(googleTurnKey(connectionId), async () => {
    await ensureGoogleChannels(connectionId).catch((error) => console.error(error))
    await refreshGoogleBusy(connectionId)
  }).catch((error) => console.error(error))
}
