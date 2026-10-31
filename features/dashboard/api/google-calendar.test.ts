// @vitest-environment node
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookingAddons,
  bookings,
  businesses,
  googleCalendarConnections,
  googleCalendarEvents,
  services,
  teamMembers,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
// The owner's check (queries.getOwnerBusiness) is tested with the dashboard.
vi.mock("./queries", () => ({ getOwnerBusiness: vi.fn(async () => ({})) }))

const {
  GOOGLE_SCOPES,
  endGoogleCalendarConnection,
  finishGoogleCalendarConnect,
  readGoogleCalendarAttempt,
  startGoogleCalendarConnect,
} = await import("@/lib/google-calendar")
const { eventIdOf, syncGoogleCalendar, syncGoogleCalendarNow } = await import("@/lib/google-calendar-sync")
const { googleCalendarFor } = await import("./google-calendar")
const { getGoogleCalendarChoices, setGoogleBusyCalendars } = await import("./google-calendar-actions")
const { createGoogleInvite, googleInviteReady, markGoogleInviteUsed, readGoogleInvite } = await import(
  "@/lib/google-calendar-invites"
)
const { teamCalendarsFor } = await import("./google-calendar")
const { googleBusyTimes, refreshGoogleBusy } = await import("@/lib/google-calendar-busy")
const { ensureGoogleChannels, handleGoogleNotification } = await import("@/lib/google-calendar-channels")

let dir: string
let closeDb: () => void
const hour = 3_600_000

// A stand-in for Google: its token and revoke endpoints and one account's
// calendars and events, kept as Google would.
const google = {
  scope: "",
  email: "owner@gmail.com",
  refreshAnswer: "ok" as "ok" | "invalid_grant",
  calendars: new Map<
    string,
    Map<
      string,
      { status: string; summary: string; start: string; description?: string; location?: string; colorId?: string }
    >
  >(),
  revoked: [] as string[],
  calls: [] as string[],
  // The main calendar's busy times freeBusy answers with.
  busy: [] as { start: string; end: string }[],
  // Push channels Google holds: id → its token and when it ends.
  channels: new Map<string, { token: string; expiration: number; calendar: string }>(),
  // Busy times of the other calendars, by id.
  otherBusy: {} as Record<string, { start: string; end: string }[]>,
  stopped: [] as string[],
  channelHours: 24 * 7,
}

function idToken(email: string) {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url")
  return `${part({ alg: "RS256" })}.${part({ email })}.signature`
}

const fetchGoogle = vi.fn(async (input: string, init: RequestInit = {}) => {
  const answer = (status: number, json?: unknown) =>
    new Response(json === undefined ? null : JSON.stringify(json), { status })
  const url = new URL(input)
  const method = init.method ?? "GET"
  google.calls.push(`${method} ${url.pathname}`)
  if (url.href === "https://oauth2.googleapis.com/token") {
    const body = new URLSearchParams(String(init.body))
    if (body.get("client_secret") !== "secret") return answer(401, { error: "invalid_client" })
    if (body.get("grant_type") === "refresh_token" && google.refreshAnswer === "invalid_grant") {
      return answer(400, { error: "invalid_grant" })
    }
    return answer(200, {
      access_token: "ya29.access",
      expires_in: 3599,
      scope: google.scope,
      token_type: "Bearer",
      ...(body.get("grant_type") === "authorization_code"
        ? { refresh_token: "1//refresh", id_token: idToken(google.email) }
        : {}),
    })
  }
  if (url.href === "https://oauth2.googleapis.com/revoke") {
    google.revoked.push(new URLSearchParams(String(init.body)).get("token") ?? "")
    return answer(200)
  }
  const path = url.pathname.replace("/calendar/v3", "")
  const body = init.body ? JSON.parse(String(init.body)) : null
  const watched = path.match(/^\/calendars\/([^/]+)\/events\/watch$/)
  if (method === "POST" && watched) {
    const calendar = decodeURIComponent(watched[1])
    const expiration = Date.now() + google.channelHours * hour
    google.channels.set(body.id, { token: body.token, expiration, calendar })
    return answer(200, { kind: "api#channel", id: body.id, resourceId: `res-${calendar}`, expiration: String(expiration) })
  }
  if (method === "GET" && path === "/users/me/calendarList") {
    return answer(200, {
      items: [
        { id: "work@group.calendar.google.com", summary: "Work" },
        { id: google.email, summary: google.email, primary: true },
        { id: "family@group.calendar.google.com", summary: "Family", summaryOverride: "Home" },
        ...[...google.calendars.keys()].map((id) => ({ id, summary: "Koblip Book" })),
      ],
    })
  }
  if (method === "POST" && path === "/channels/stop") {
    google.channels.delete(body.id)
    google.stopped.push(body.id)
    return answer(204)
  }
  if (method === "POST" && path === "/freeBusy") {
    return answer(200, {
      calendars: Object.fromEntries(
        body.items.map((item: { id: string }) => [
          item.id,
          { busy: item.id === "primary" ? google.busy : (google.otherBusy[item.id] ?? []) },
        ])
      ),
    })
  }
  if (method === "POST" && path === "/calendars") {
    const id = `cal${google.calendars.size + 1}@group.calendar.google.com`
    google.calendars.set(id, new Map())
    return answer(200, { id, summary: body.summary })
  }
  const match = path.match(/^\/calendars\/([^/]+)\/events(?:\/([^/]+))?$/)
  const events = match && google.calendars.get(decodeURIComponent(match[1]))
  if (!match || !events) return answer(404, { error: { errors: [{ reason: "notFound" }] } })
  const eventId = match[2]
  const save = (id: string) =>
    events.set(id, {
      status: body.status,
      summary: body.summary,
      start: body.start.dateTime,
      description: body.description,
      location: body.location,
      colorId: body.colorId,
    })
  if (method === "POST") {
    if (events.has(body.id)) return answer(409, { error: { errors: [{ reason: "duplicate" }] } })
    save(body.id)
    return answer(200, { id: body.id })
  }
  if (method === "PUT") {
    if (!events.has(eventId)) return answer(404, { error: { errors: [{ reason: "notFound" }] } })
    save(eventId)
    return answer(200, { id: eventId })
  }
  if (method === "DELETE") {
    const event = events.get(eventId)
    if (!event || event.status === "cancelled") return answer(410, { error: { errors: [{ reason: "deleted" }] } })
    // Google keeps a removed event's id, as cancelled.
    event.status = "cancelled"
    return answer(204)
  }
  return answer(400)
})

const ALL_SCOPES = ["openid", "https://www.googleapis.com/auth/userinfo.email", ...Object.values(GOOGLE_SCOPES)].join(" ")

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-google-calendar-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
  vi.stubEnv("GOOGLE_CLIENT_ID", "client.apps.googleusercontent.com")
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret")
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100")
  vi.stubGlobal("fetch", fetchGoogle)
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({ id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false })
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
})

beforeEach(async () => {
  await db.delete(googleCalendarConnections)
  await db.delete(bookings)
  await db.delete(teamMembers)
  google.busy = []
  google.channels.clear()
  google.otherBusy = {}
  google.stopped = []
  google.channelHours = 24 * 7
  vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3100")
  google.scope = ALL_SCOPES
  google.email = "owner@gmail.com"
  google.refreshAnswer = "ok"
  google.calendars.clear()
  google.revoked = []
  google.calls = []
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})


function booking(id: string, startsIn: number, more: Partial<typeof bookings.$inferInsert> = {}) {
  const start = Date.now() + startsIn
  return {
    id,
    businessId: "biz",
    serviceName: "Haircut",
    durationMinutes: 60,
    currency: "DOP",
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + hour).toISOString(),
    customerName: "Ana",
    ...more,
  }
}

async function connect() {
  const { url, cookie } = startGoogleCalendarConnect({ businessId: "biz", userId: "u1" }, "owner@example.com")
  const attempt = readGoogleCalendarAttempt(cookie, new URL(url).searchParams.get("state"))
  return finishGoogleCalendarConnect(attempt!, "code")
}

function googleEvents() {
  return [...google.calendars.values()][0]!
}

test("the consent link asks for offline access with the sealed verifier's PKCE challenge", () => {
  const { url, cookie } = startGoogleCalendarConnect({ businessId: "biz", userId: "u1" }, "owner@example.com")
  const link = new URL(url)
  expect(link.origin + link.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth")
  expect(link.searchParams.get("redirect_uri")).toBe("http://localhost:3100/api/google-calendar/callback")
  expect(link.searchParams.get("access_type")).toBe("offline")
  expect(link.searchParams.get("prompt")).toBe("consent")
  expect(link.searchParams.get("scope")?.split(" ")).toContain(GOOGLE_SCOPES.appCalendar)
  const state = link.searchParams.get("state")
  const attempt = readGoogleCalendarAttempt(cookie, state)
  expect(attempt?.businessId).toBe("biz")
  expect(link.searchParams.get("code_challenge")).toBe(
    createHash("sha256").update(attempt!.verifier).digest("base64url")
  )
  expect(readGoogleCalendarAttempt(cookie, "other-state")).toBeNull()
})

test("connecting saves the account with sealed tokens", async () => {
  const { result } = await connect()
  expect(result).toBe("connected")
  const [row] = await db.select().from(googleCalendarConnections)
  expect(row?.googleEmail).toBe("owner@gmail.com")
  expect(row?.refreshToken).not.toContain("refresh")
  await expect(googleCalendarFor("biz")).resolves.toEqual({
    googleEmail: "owner@gmail.com",
    needsReconnect: false,
    lastSyncAt: null,
    syncFailed: false,
    busyTeamMemberId: null,
  })
})

test("leaving out the calendar in Google's window saves nothing", async () => {
  google.scope = "openid https://www.googleapis.com/auth/userinfo.email"
  await expect(connect()).resolves.toEqual({ result: "denied" })
  await expect(googleCalendarFor("biz")).resolves.toBeNull()
})

test("a sync makes the Koblip Book calendar and one event per booking, once", async () => {
  await db.insert(bookings).values([booking("b1", 2 * hour), booking("b2", 5 * hour)])
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  await syncGoogleCalendar(connectionId!)
  expect(google.calendars.size).toBe(1)
  expect([...googleEvents().keys()].sort()).toEqual([eventIdOf("b1"), eventIdOf("b2")].sort())
  expect(google.calls.filter((call) => call.startsWith("POST /calendar/v3/calendars/"))).toHaveLength(2)
  expect(eventIdOf("b1")).toMatch(/^[0-9a-v]{5,1024}$/)
})

test("moved and cancelled bookings update and remove their events", async () => {
  await db.insert(bookings).values([booking("b1", 2 * hour), booking("b2", 5 * hour)])
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  const later = new Date(Date.now() + 24 * hour)
  await db
    .update(bookings)
    .set({ startAt: later.toISOString(), endAt: new Date(later.getTime() + hour).toISOString() })
    .where(eq(bookings.id, "b1"))
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, "b2"))
  await syncGoogleCalendar(connectionId!)
  expect(googleEvents().get(eventIdOf("b1"))?.start).toBe(later.toISOString())
  expect(googleEvents().get(eventIdOf("b2"))?.status).toBe("cancelled")
  // Nothing more to send.
  google.calls = []
  await syncGoogleCalendar(connectionId!)
  expect(google.calls).toEqual([])
})

test("a booking cancelled before any sync is never sent", async () => {
  await db.insert(bookings).values(booking("b1", 2 * hour, { status: "cancelled" }))
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  expect(googleEvents().size).toBe(0)
})

test("a calendar removed in Google is made again with every event at the next change", async () => {
  await db.insert(bookings).values(booking("b1", 2 * hour))
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  google.calendars.clear()
  // Found at the next change: a new booking.
  await db.insert(bookings).values(booking("b2", 5 * hour))
  await syncGoogleCalendar(connectionId!)
  await syncGoogleCalendar(connectionId!)
  expect([...googleEvents().keys()].sort()).toEqual([eventIdOf("b1"), eventIdOf("b2")].sort())
  await expect(googleCalendarFor("biz")).resolves.toMatchObject({ syncFailed: false })
})

test("a refused refresh asks to reconnect and stops syncing", async () => {
  await db.insert(bookings).values(booking("b1", 2 * hour))
  const { connectionId } = await connect()
  await db
    .update(googleCalendarConnections)
    .set({ accessExpiresAt: new Date(0).toISOString() })
    .where(eq(googleCalendarConnections.id, connectionId!))
  google.refreshAnswer = "invalid_grant"
  await syncGoogleCalendar(connectionId!)
  await expect(googleCalendarFor("biz")).resolves.toMatchObject({ needsReconnect: true, syncFailed: false })
  expect(google.calendars.size).toBe(0)
})

test("connecting another Google account starts its calendar over", async () => {
  await db.insert(bookings).values(booking("b1", 2 * hour))
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  google.email = "other@gmail.com"
  const again = await connect()
  expect(again.connectionId).toBe(connectionId)
  await expect(
    db.select().from(googleCalendarEvents).where(eq(googleCalendarEvents.connectionId, connectionId!))
  ).resolves.toEqual([])
  const [row] = await db.select().from(googleCalendarConnections)
  expect(row?.calendarId).toBeNull()
})

test("disconnecting revokes the token at Google and forgets the connection", async () => {
  const { connectionId } = await connect()
  await endGoogleCalendarConnection(connectionId!)
  expect(google.revoked).toEqual(["1//refresh"])
  await expect(googleCalendarFor("biz")).resolves.toBeNull()
})

const busyNow = () => {
  const start = new Date(Date.now() + 3 * hour)
  return { start: start.toISOString(), end: new Date(start.getTime() + hour).toISOString() }
}
const range = () => [new Date().toISOString(), new Date(Date.now() + 48 * hour).toISOString()] as const

test("busy times from the main calendar block the whole business when it has no team", async () => {
  const time = busyNow()
  google.busy = [time]
  const { connectionId } = await connect()
  await refreshGoogleBusy(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([
    { startAt: time.start, endAt: time.end, teamMemberId: null },
  ])
  expect(google.calls.filter((call) => call.includes("freeBusy"))).toHaveLength(1)
})

test("with a team, busy times block only the member the owner is, or nobody", async () => {
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Ana" },
    { id: "m2", businessId: "biz", name: "Luis" },
  ])
  google.busy = [busyNow()]
  const { connectionId } = await connect()
  await refreshGoogleBusy(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([])
  await db
    .update(googleCalendarConnections)
    .set({ busyTeamMemberId: "m2" })
    .where(eq(googleCalendarConnections.id, connectionId!))
  await expect(googleBusyTimes("biz", ...range())).resolves.toMatchObject([{ teamMemberId: "m2" }])
})

test("a new read replaces the old busy times; without the busy scope there are none", async () => {
  google.busy = [busyNow()]
  const { connectionId } = await connect()
  await refreshGoogleBusy(connectionId!)
  google.busy = []
  await refreshGoogleBusy(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([])

  google.busy = [busyNow()]
  google.scope = ALL_SCOPES.replace(GOOGLE_SCOPES.freeBusy, "")
  const again = await connect()
  await refreshGoogleBusy(again.connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([])
})

test("the sync reads busy times too", async () => {
  google.busy = [busyNow()]
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toHaveLength(1)
})

const live = () => vi.stubEnv("BETTER_AUTH_URL", "https://book.example.com")

test("without HTTPS there is no push channel", async () => {
  const { connectionId } = await connect()
  await expect(ensureGoogleChannels(connectionId!)).resolves.toBe(false)
  expect(google.channels.size).toBe(0)
})

test("Google's call for a changed calendar reads the busy times again", async () => {
  live()
  const { connectionId } = await connect()
  await expect(ensureGoogleChannels(connectionId!)).resolves.toBe(true)
  await expect(ensureGoogleChannels(connectionId!)).resolves.toBe(true)
  expect(google.channels.size).toBe(1)
  const [[channelId, { token }]] = [...google.channels]
  google.busy = [busyNow()]
  const call = { channelId, token, resourceId: "res-primary", state: "exists" }
  // A wrong token or a start-up call changes nothing.
  await handleGoogleNotification({ ...call, token: "wrong" })
  await handleGoogleNotification({ ...call, state: "sync" })
  await new Promise((resolve) => setTimeout(resolve, 20))
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([])
  await handleGoogleNotification(call)
  await vi.waitFor(async () => {
    await expect(googleBusyTimes("biz", ...range())).resolves.toHaveLength(1)
  })
})

test("a channel about to end is renewed, then the old one stopped", async () => {
  live()
  google.channelHours = 2
  const { connectionId } = await connect()
  await ensureGoogleChannels(connectionId!)
  const [first] = [...google.channels.keys()]
  google.channelHours = 24 * 7
  await ensureGoogleChannels(connectionId!)
  expect(google.stopped).toEqual([first])
  expect(google.channels.size).toBe(1)
})

test("disconnecting stops the push channels before revoking", async () => {
  live()
  const { connectionId } = await connect()
  await ensureGoogleChannels(connectionId!)
  await endGoogleCalendarConnection(connectionId!)
  expect(google.channels.size).toBe(0)
  expect(google.calls.indexOf("POST /calendar/v3/channels/stop")).toBeLessThan(
    google.calls.indexOf("POST /revoke")
  )
})

test("the owner sees the account's calendars, main first, never Koblip Book's", async () => {
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  await expect(getGoogleCalendarChoices("biz")).resolves.toEqual([
    { id: "owner@gmail.com", name: "owner@gmail.com", primary: true, blocks: true },
    { id: "work@group.calendar.google.com", name: "Work", primary: false, blocks: false },
    { id: "family@group.calendar.google.com", name: "Home", primary: false, blocks: false },
  ])
})

test("ticked calendars block bookings and each gets a push channel", async () => {
  live()
  await connect()
  google.busy = [busyNow()]
  const work = { start: new Date(Date.now() + 6 * hour).toISOString(), end: new Date(Date.now() + 7 * hour).toISOString() }
  google.otherBusy = { "work@group.calendar.google.com": [work] }
  await expect(setGoogleBusyCalendars("biz", ["work@group.calendar.google.com"])).resolves.toEqual({ ok: true })
  await vi.waitFor(async () => {
    await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([
      { startAt: work.start, endAt: work.end, teamMemberId: null },
    ])
  })
  expect([...google.channels.values()].map((channel) => channel.calendar)).toEqual([
    "work@group.calendar.google.com",
  ])
  await expect(getGoogleCalendarChoices("biz")).resolves.toMatchObject([
    { primary: true, blocks: false },
    { name: "Work", blocks: true },
    { name: "Home", blocks: false },
  ])
})

test("a calendar that isn't the account's is refused", async () => {
  await connect()
  await expect(setGoogleBusyCalendars("biz", ["someone-else@gmail.com"])).resolves.toEqual({ ok: false })
  await expect(setGoogleBusyCalendars("biz", "work" as unknown as string[])).resolves.toEqual({ ok: false })
})

async function memberConnect(teamMemberId: string) {
  const { url } = await createGoogleInvite({ businessId: "biz", teamMemberId, createdBy: "u1" })
  const token = url.split("/team-calendar/")[1]!
  const invite = await readGoogleInvite(token)
  const start = startGoogleCalendarConnect({ businessId: "biz", teamMemberId, inviteId: invite!.id })
  const attempt = readGoogleCalendarAttempt(start.cookie, new URL(start.url).searchParams.get("state"))
  return { token, invite: invite!, finished: await finishGoogleCalendarConnect(attempt!, "code") }
}

test("a team member's link connects their own calendar, with only their bookings", async () => {
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Ana" },
    { id: "m2", businessId: "biz", name: "Luis" },
  ])
  await db.insert(bookings).values([
    booking("b-ana", 2 * hour, { teamMemberId: "m1" }),
    booking("b-luis", 3 * hour, { teamMemberId: "m2" }),
  ])
  google.email = "ana@gmail.com"
  const { invite, finished } = await memberConnect("m1")
  expect(invite).toMatchObject({ businessName: "Shop", memberName: "Ana", state: "ready" })
  expect(finished.result).toBe("connected")
  await syncGoogleCalendar(finished.connectionId!)
  expect([...googleEvents().keys()]).toEqual([eventIdOf("b-ana")])
  await expect(teamCalendarsFor("biz")).resolves.toEqual({
    m1: { googleEmail: "ana@gmail.com", needsReconnect: false },
  })
  // The business's own connection is a different one.
  await expect(googleCalendarFor("biz")).resolves.toBeNull()
})

test("a team member's busy times block only them", async () => {
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Ana" },
    { id: "m2", businessId: "biz", name: "Luis" },
  ])
  google.busy = [busyNow()]
  const { finished } = await memberConnect("m1")
  await refreshGoogleBusy(finished.connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toMatchObject([{ teamMemberId: "m1" }])
})

test("a link works once, until it runs out, and a new one ends the old one", async () => {
  await db.insert(teamMembers).values({ id: "m1", businessId: "biz", name: "Ana" })
  const first = await createGoogleInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "u1" })
  const second = await createGoogleInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "u1" })
  await expect(readGoogleInvite(first.url.split("/team-calendar/")[1]!)).resolves.toBeNull()
  const invite = await readGoogleInvite(second.url.split("/team-calendar/")[1]!)
  await expect(googleInviteReady(invite!.id)).resolves.toBe(true)
  await markGoogleInviteUsed(invite!.id)
  await expect(googleInviteReady(invite!.id)).resolves.toBe(false)
  await expect(readGoogleInvite(second.url.split("/team-calendar/")[1]!)).resolves.toMatchObject({ state: "used" })
  await expect(readGoogleInvite("not-a-token")).resolves.toBeNull()

  vi.useFakeTimers({ now: Date.now() })
  const third = await createGoogleInvite({ businessId: "biz", teamMemberId: "m1", createdBy: "u1" })
  vi.setSystemTime(Date.now() + 8 * 24 * hour)
  await expect(readGoogleInvite(third.url.split("/team-calendar/")[1]!)).resolves.toMatchObject({ state: "expired" })
  vi.useRealTimers()
})

test("an event carries the booking's details and a link to its day", async () => {
  vi.stubEnv("BETTER_AUTH_URL", "https://book.example.com")
  await db.update(businesses).set({ address: "Calle 1, Santo Domingo" }).where(eq(businesses.id, "biz"))
  await db.insert(teamMembers).values({ id: "m1", businessId: "biz", name: "Ana" })
  await db.insert(bookings).values(
    booking("b1", 2 * hour, {
      teamMemberId: "m1",
      teamMemberName: "Ana",
      customerName: "Maria",
      customerPhone: "+18095550134",
      note: "First visit",
      priceMinor: 150000,
    })
  )
  await db.insert(bookingAddons).values({ businessId: "biz", bookingId: "b1", name: "Beard trim", durationMinutes: 15 })
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  const event = googleEvents().get(eventIdOf("b1"))!
  expect(event.summary).toBe("Haircut · Maria")
  expect(event.location).toBe("Calle 1, Santo Domingo")
  expect(event.description).toContain("Extras: Beard trim")
  expect(event.description).toContain("With: Ana")
  expect(event.description).toContain("Phone: +18095550134")
  expect(event.description).toContain("WhatsApp: https://wa.me/18095550134")
  expect(event.description).toContain("Note: First visit")
  expect(event.description).toMatch(/Open in Koblip Book: https:\/\/book\.example\.com\/dashboard\/biz\/bookings\?from=\d{4}-\d{2}-\d{2}&to=/)
  await db.update(businesses).set({ address: null }).where(eq(businesses.id, "biz"))
})

test("a team member's event has no owner-area link", async () => {
  await db.insert(teamMembers).values({ id: "m1", businessId: "biz", name: "Ana" })
  await db.insert(bookings).values(booking("b1", 2 * hour, { teamMemberId: "m1" }))
  const { finished } = await memberConnect("m1")
  await syncGoogleCalendar(finished.connectionId!)
  expect(googleEvents().get(eventIdOf("b1"))?.description).not.toContain("Koblip Book:")
})

test("an event takes its service's colour, and a changed colour updates it", async () => {
  await db.insert(services).values({ id: "s1", businessId: "biz", name: "Haircut", durationMinutes: 60, calendarColor: "11" })
  await db.insert(bookings).values(booking("b1", 2 * hour, { serviceId: "s1" }))
  await db.insert(bookings).values(booking("b2", 4 * hour))
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  expect(googleEvents().get(eventIdOf("b1"))?.colorId).toBe("11")
  expect(googleEvents().get(eventIdOf("b2"))?.colorId).toBeUndefined()
  await db.update(services).set({ calendarColor: null }).where(eq(services.id, "s1"))
  await syncGoogleCalendar(connectionId!)
  expect(googleEvents().get(eventIdOf("b1"))?.colorId).toBeUndefined()
  await db.delete(services)
})

test("Sync now reads busy times again even when they aren't due", async () => {
  const { connectionId } = await connect()
  await syncGoogleCalendar(connectionId!)
  google.busy = [busyNow()]
  await syncGoogleCalendar(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toEqual([])
  await syncGoogleCalendarNow(connectionId!)
  await expect(googleBusyTimes("biz", ...range())).resolves.toHaveLength(1)
})
