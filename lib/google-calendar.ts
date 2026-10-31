import "server-only"
import { createHash, randomBytes, timingSafeEqual } from "node:crypto"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  googleCalendarChannels,
  googleCalendarConnections,
  googleCalendarEvents,
} from "@/lib/db/schema"
import { runInTurn } from "@/lib/run-in-turn"
import { open, seal } from "@/lib/secret-box"
import type { GoogleConnectResult } from "@/types/google-calendar-connect"

// Talking to Google Calendar (docs/plans/google-calendar.md): the OAuth 2.0
// web server flow with PKCE (developers.google.com/identity/protocols/oauth2/web-server),
// the tokens, and calls to the Calendar API. Shared code, so the dashboard
// syncs bookings and the booking feature can read busy times. Tokens and the
// client secret never leave the server.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const REVOKE_URL = "https://oauth2.googleapis.com/revoke"
const API_URL = "https://www.googleapis.com/calendar/v3"

// The least Google allows (developers.google.com/workspace/calendar/api/auth):
// a calendar Book makes and manages alone, the list of calendars, and busy
// times only. All asked at once, so nobody reconnects when a step ships.
export const GOOGLE_SCOPES = {
  appCalendar: "https://www.googleapis.com/auth/calendar.app.created",
  calendarList: "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  freeBusy: "https://www.googleapis.com/auth/calendar.events.freebusy",
} as const
const SCOPES = ["openid", "email", ...Object.values(GOOGLE_SCOPES)].join(" ")

// How long the person has to answer in Google's window.
const ATTEMPT_MINUTES = 10
// Refresh this long before the access token runs out.
const REFRESH_EARLY_MS = 60_000

// The cookie that ties Google's answer to the browser and business that asked.
export const GOOGLE_ATTEMPT_COOKIE = "koblip_google_calendar_connect"
export const GOOGLE_ATTEMPT_COOKIE_PATH = "/api/google-calendar"
export const GOOGLE_ATTEMPT_MAX_AGE = ATTEMPT_MINUTES * 60

// The same Google Cloud client as Google login (lib/auth.ts), with its own
// redirect URI, which must be added in Google Cloud > Clients.
function config() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const site = process.env.BETTER_AUTH_URL
  for (const [name, value] of Object.entries({ clientId, clientSecret, site })) {
    if (!value) throw new Error(`Google Calendar: ${name} is not set. See .env.example.`)
  }
  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: new URL("/api/google-calendar/callback", site).toString(),
  }
}

// Where Google's window ends (app/(owner)/connect/google-calendar), at this
// site's public address, not the request's (behind the proxy that is localhost).
export function googleCalendarDoneUrl(businessId: string, result: string) {
  const site = process.env.BETTER_AUTH_URL
  if (!site) throw new Error("Google Calendar: BETTER_AUTH_URL is not set. See .env.example.")
  const url = new URL("/connect/google-calendar", site)
  url.search = new URLSearchParams({ businessId, result }).toString()
  return url
}

// Where a team member's Google window ends (G5): a page of its own, as they
// have no account and opened Book from a link.
export function teamCalendarDoneUrl(result: string) {
  const site = process.env.BETTER_AUTH_URL
  if (!site) throw new Error("Google Calendar: BETTER_AUTH_URL is not set. See .env.example.")
  const url = new URL("/team-calendar/done", site)
  url.search = new URLSearchParams({ result }).toString()
  return url
}

// Whose connection an attempt makes: the business's own, by its owner, or
// a team member's, from their link (G5).
export type ConnectFor =
  | { businessId: string; userId: string }
  | { businessId: string; teamMemberId: string; inviteId: string }

type Attempt = ConnectFor & {
  state: string
  verifier: string
  startedAt: number
}

// Google's consent URL to open, and the sealed attempt to keep in a cookie.
// prompt=consent: Google gives a refresh token only on a consent screen,
// and a reconnect needs a new one.
export function startGoogleCalendarConnect(who: ConnectFor, email?: string) {
  const { clientId, redirectUri } = config()
  const attempt: Attempt = {
    ...who,
    state: randomBytes(32).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    startedAt: Date.now(),
  }
  const url = new URL(AUTH_URL)
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    ...(email ? { login_hint: email } : {}),
    state: attempt.state,
    code_challenge: createHash("sha256").update(attempt.verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString()
  return { url: url.toString(), cookie: seal(JSON.stringify(attempt)) }
}

// The attempt Google answered, only when its state matches and it is recent.
export function readGoogleCalendarAttempt(
  cookie: string | undefined,
  state: string | null
): Attempt | null {
  if (!cookie || !state) return null
  let attempt: Attempt
  try {
    attempt = JSON.parse(open(cookie))
  } catch {
    return null
  }
  const expected = Buffer.from(attempt.state)
  const given = Buffer.from(state)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (Date.now() - attempt.startedAt > ATTEMPT_MINUTES * 60_000) return null
  return attempt
}

type Tokens = {
  access_token: string
  refresh_token?: string
  expires_in: number
  scope: string
  id_token?: string
}

type TokenAnswer =
  | { ok: true; tokens: Tokens }
  // Google answered no (its error code), or the answer never came (null).
  | { ok: false; code: string | null }

async function tokenCall(body: Record<string, string>): Promise<TokenAnswer> {
  const { clientId, clientSecret } = config()
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ ...body, client_id: clientId, client_secret: clientSecret }),
      cache: "no-store",
    })
    const json = await res.json().catch(() => null)
    if (res.ok && json?.access_token) return { ok: true, tokens: json }
    return { ok: false, code: typeof json?.error === "string" ? json.error : null }
  } catch {
    return { ok: false, code: null }
  }
}

// The Google account's email, from the ID token Google's token endpoint just
// sent straight to this server over HTTPS, which Google says needs no
// signature check (developers.google.com/identity/openid-connect/openid-connect).
function emailOf(idToken: string | undefined): string | null {
  const payload = idToken?.split(".")[1]
  if (!payload) return null
  try {
    const email = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).email
    return typeof email === "string" ? email : null
  } catch {
    return null
  }
}

// Swaps Google's one-time code for tokens and saves the connection (the
// business's, or the team member's), then says how it ended and, when
// connected, the connection.
// "denied" when the person left out the calendar itself.
export async function finishGoogleCalendarConnect(
  attempt: Attempt,
  code: string
): Promise<{ result: GoogleConnectResult; connectionId?: string }> {
  const { redirectUri } = config()
  const answer = await tokenCall({
    grant_type: "authorization_code",
    code,
    code_verifier: attempt.verifier,
    redirect_uri: redirectUri,
  })
  if (!answer.ok) return { result: "failed" }
  const { tokens } = answer
  // Google lets a person untick scopes: without its own calendar, Book can do nothing.
  if (!tokens.scope.split(" ").includes(GOOGLE_SCOPES.appCalendar)) return { result: "denied" }
  const email = emailOf(tokens.id_token)
  if (!tokens.refresh_token || !email) return { result: "failed" }
  const refreshToken = tokens.refresh_token

  const teamMemberId = "teamMemberId" in attempt ? attempt.teamMemberId : null
  const where = and(
    eq(googleCalendarConnections.businessId, attempt.businessId),
    teamMemberId
      ? eq(googleCalendarConnections.teamMemberId, teamMemberId)
      : isNull(googleCalendarConnections.teamMemberId)
  )
  const connectionId = await runInTurn(`google-calendar:${attempt.businessId}`, async () => {
    const [before] = await db.select().from(googleCalendarConnections).where(where).limit(1)
    const row = {
      googleEmail: email,
      scopes: tokens.scope,
      accessToken: seal(tokens.access_token),
      refreshToken: seal(refreshToken),
      accessExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      needsReconnect: false,
      lastError: null,
      connectedBy: "userId" in attempt ? attempt.userId : null,
    }
    if (!before) {
      const [made] = await db
        .insert(googleCalendarConnections)
        .values({ businessId: attempt.businessId, teamMemberId, ...row })
        .returning({ id: googleCalendarConnections.id })
      return made!.id
    }
    // Another Google account has none of the events: its calendar is made
    // and filled again.
    const moved = before.googleEmail.toLowerCase() !== email.toLowerCase()
    await saveAll([
      db
        .update(googleCalendarConnections)
        .set({ ...row, ...(moved ? { calendarId: null, busyCalendarIds: null } : {}) })
        .where(eq(googleCalendarConnections.id, before.id)),
      ...(moved
        ? [db.delete(googleCalendarEvents).where(eq(googleCalendarEvents.connectionId, before.id))]
        : []),
    ])
    return before.id
  })
  return { result: "connected", connectionId }
}

type Connection = typeof googleCalendarConnections.$inferSelect

async function readConnection(connectionId: string): Promise<Connection | undefined> {
  return (
    await db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.id, connectionId))
      .limit(1)
  )[0]
}

async function freshAccessToken(connectionId: string, force: boolean): Promise<string | null> {
  const row = await readConnection(connectionId)
  if (!row?.accessToken || !row.refreshToken || row.needsReconnect) return null
  if (
    !force &&
    row.accessExpiresAt &&
    Date.parse(row.accessExpiresAt) - REFRESH_EARLY_MS > Date.now()
  ) {
    return open(row.accessToken)
  }
  const answer = await tokenCall({
    grant_type: "refresh_token",
    refresh_token: open(row.refreshToken),
  })
  if (answer.ok) {
    await db
      .update(googleCalendarConnections)
      .set({
        accessToken: seal(answer.tokens.access_token),
        accessExpiresAt: new Date(Date.now() + answer.tokens.expires_in * 1000).toISOString(),
        ...(answer.tokens.scope ? { scopes: answer.tokens.scope } : {}),
      })
      .where(eq(googleCalendarConnections.id, connectionId))
    return answer.tokens.access_token
  }
  // invalid_grant: revoked, expired or the account is gone; only a new
  // consent helps. Anything else (no answer, Google down) is tried again
  // later with the same refresh token.
  if (answer.code === "invalid_grant") {
    await db
      .update(googleCalendarConnections)
      .set({ accessToken: null, refreshToken: null, accessExpiresAt: null, needsReconnect: true })
      .where(eq(googleCalendarConnections.id, connectionId))
  }
  return null
}

// One refresh at a time per connection. (One server process; several would
// need a shared lock.)
const refreshing = new Map<string, Promise<string | null>>()

function accessToken(connectionId: string, force = false): Promise<string | null> {
  let pending = refreshing.get(connectionId)
  if (!pending) {
    pending = freshAccessToken(connectionId, force).finally(() => refreshing.delete(connectionId))
    refreshing.set(connectionId, pending)
  }
  return pending
}

export class GoogleCalendarError extends Error {
  constructor(
    // null when Google never answered.
    readonly status: number | null,
    // Google's reason, such as "rateLimitExceeded", or "not_connected".
    readonly reason: string | null
  ) {
    super(`Google Calendar API: ${status ?? "no answer"} ${reason ?? ""}`.trim())
  }
}

type ApiInit = { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; body?: unknown }

async function send(token: string, path: string, init: ApiInit) {
  try {
    return await fetch(`${API_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        authorization: `Bearer ${token}`,
        ...(init.body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    })
  } catch {
    throw new GoogleCalendarError(null, null)
  }
}

// One Calendar API call as this connection. A refused access token is
// refreshed once. Throws GoogleCalendarError when not connected or Google
// says no; an empty answer (DELETE) is null.
export async function googleCalendarApi<T>(
  connectionId: string,
  path: string,
  init: ApiInit = {}
): Promise<T | null> {
  let token = await accessToken(connectionId)
  if (!token) throw new GoogleCalendarError(null, "not_connected")
  let res = await send(token, path, init)
  if (res.status === 401) {
    token = await accessToken(connectionId, true)
    if (!token) throw new GoogleCalendarError(401, "not_connected")
    res = await send(token, path, init)
  }
  const text = await res.text().catch(() => "")
  let json = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // Not JSON (a proxy's error page): only the status counts.
  }
  if (!res.ok) {
    const reason = json?.error?.errors?.[0]?.reason ?? json?.error?.status ?? null
    throw new GoogleCalendarError(res.status, typeof reason === "string" ? reason : null)
  }
  return json as T | null
}

// One connection's work with Google (sync, busy times) runs one at a time
// under this key (lib/run-in-turn).
export function googleTurnKey(connectionId: string) {
  return `google-calendar:${connectionId}`
}

// Stops one push channel at Google (only the account that made it can) and
// forgets it. Forgotten even if Google can't be reached: it runs out alone.
export async function stopGoogleChannel(
  connectionId: string,
  channel: { id: string; resourceId: string }
) {
  try {
    await googleCalendarApi(connectionId, "/channels/stop", {
      method: "POST",
      body: { id: channel.id, resourceId: channel.resourceId },
    })
  } catch (error) {
    if (!(error instanceof GoogleCalendarError)) throw error
  }
  await db.delete(googleCalendarChannels).where(eq(googleCalendarChannels.id, channel.id))
}

// Ends the connection at Google, then forgets it here. Forgetting happens
// even if Google cannot be reached; the person can also remove Book at
// myaccount.google.com/permissions.
export async function endGoogleCalendarConnection(connectionId: string) {
  // Push channels first: stopping one needs the account's token.
  const channels = await db
    .select()
    .from(googleCalendarChannels)
    .where(eq(googleCalendarChannels.connectionId, connectionId))
  for (const channel of channels) await stopGoogleChannel(connectionId, channel)
  const row = await readConnection(connectionId)
  if (row?.refreshToken) {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: open(row.refreshToken) }),
      cache: "no-store",
    }).catch(() => null)
  }
  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.id, connectionId))
}
