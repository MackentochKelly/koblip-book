// @vitest-environment node
import { createHash, randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  googleCalendarConnections,
  googleCalendarEvents,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const {
  GOOGLE_SCOPES,
  endGoogleCalendarConnection,
  finishGoogleCalendarConnect,
  readGoogleCalendarAttempt,
  startGoogleCalendarConnect,
} = await import("@/lib/google-calendar")
const { eventIdOf, syncGoogleCalendar } = await import("./google-calendar-sync")
const { googleCalendarFor } = await import("./google-calendar")

let dir: string
let closeDb: () => void

// A stand-in for Google: its token and revoke endpoints and one account's
// calendars and events, kept as Google would.
const google = {
  scope: "",
  email: "owner@gmail.com",
  refreshAnswer: "ok" as "ok" | "invalid_grant",
  calendars: new Map<string, Map<string, { status: string; summary: string; start: string }>>(),
  revoked: [] as string[],
  calls: [] as string[],
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
    events.set(id, { status: body.status, summary: body.summary, start: body.start.dateTime })
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

const hour = 3_600_000

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
  const { url, cookie } = startGoogleCalendarConnect("biz", "u1", "owner@example.com")
  const attempt = readGoogleCalendarAttempt(cookie, new URL(url).searchParams.get("state"))
  return finishGoogleCalendarConnect(attempt!, "code")
}

function googleEvents() {
  return [...google.calendars.values()][0]!
}

test("the consent link asks for offline access with the sealed verifier's PKCE challenge", () => {
  const { url, cookie } = startGoogleCalendarConnect("biz", "u1", "owner@example.com")
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
    syncFailed: false,
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
