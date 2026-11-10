// @vitest-environment node
import { createHmac } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import {
  businesses,
  partnerApps,
  partnerEvents,
  partnerInvites,
  user,
} from "@/lib/db/schema"
import { PARTNER_RULES } from "@/lib/partner-rules"

vi.mock("server-only", () => ({}))

const events = await import("./partner-events")

let dir: string
let db: (typeof import("@/lib/db"))["db"]
const fetchMock = vi.fn()
const future = new Date(Date.now() + 86_400_000).toISOString()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "partner-events-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  vi.stubGlobal("fetch", fetchMock)
  await db.insert(user).values({ id: "owner", name: "Owner", email: "o@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() })
  await db.insert(partnerApps).values([
    { id: "sales", name: "Sales", keyHash: "k1", keyHint: "0001", webhookUrl: "https://sales.example.com/hook", eventSecret: "secret", dailyInvites: 5 },
    { id: "quiet", name: "Quiet", keyHash: "k2", keyHint: "0002", eventSecret: "s2", dailyInvites: 5 },
    { id: "gone", name: "Gone", keyHash: "k3", keyHint: "0003", webhookUrl: "https://gone.example.com", eventSecret: "s3", dailyInvites: 5, revokedAt: new Date().toISOString() },
  ])
  await db.insert(businesses).values(
    ["salon", "barber"].map((id) => ({ id, name: id, slug: id, timezone: "UTC", currency: "USD", googlePlaceId: `ChIJ_${id}_place` }))
  )
  await db.insert(partnerInvites).values([
    { id: "by-link", appId: "sales", codeHash: "c1", placeId: "ChIJ_salon_place", ref: "lead-1", endsAt: future },
    { id: "by-place", appId: "quiet", codeHash: "c2", placeId: "ChIJ_salon_place", endsAt: future },
    { id: "revoked", appId: "gone", codeHash: "c3", placeId: "ChIJ_salon_place", endsAt: future },
    { id: "ended", appId: "sales", codeHash: "c4", placeId: "ChIJ_salon_place", endsAt: new Date(Date.now() - 1000).toISOString() },
  ])
})

afterAll(() => {
  vi.unstubAllGlobals()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => fetchMock.mockReset())

const sent = async () =>
  db.select().from(partnerEvents).orderBy(partnerEvents.createdAt)

test("the first open is told once, signed like Chat's events", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
  await events.noteInviteOpened("by-link", "salon")
  await events.noteInviteOpened("by-link", "salon")
  await events.sendDuePartnerEvents()
  const [row] = await db.select().from(partnerInvites).where(eq(partnerInvites.id, "by-link"))
  expect(row.businessId).toBe("salon")
  expect(row.openedAt).not.toBeNull()
  const rows = await sent()
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ type: "invite.opened", state: "sent", attempts: 1 })
  expect(fetchMock).toHaveBeenCalledTimes(1)
  const [url, init] = fetchMock.mock.calls[0]
  expect(url).toBe("https://sales.example.com/hook")
  const body = JSON.parse(init.body)
  expect(body).toMatchObject({ id: rows[0].id, type: "invite.opened", data: { inviteId: "by-link", ref: "lead-1", slug: "salon" } })
  const timestamp = init.headers["x-koblip-timestamp"]
  expect(init.headers["x-koblip-signature"]).toBe(
    `sha256=${createHmac("sha256", "secret").update(`${timestamp}.${init.body}`).digest("hex")}`
  )
})

test("a claim credits every open invite for the business, by link or by place", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 200 }))
  await db.update(businesses).set({ ownerId: "owner" }).where(eq(businesses.id, "salon"))
  await events.noteBusinessClaimed("salon")
  await events.noteBusinessClaimed("salon")
  // The quick sends go one at a time: this waits for them.
  await events.sendDuePartnerEvents()
  const invites = await db.select().from(partnerInvites)
  const claimed = Object.fromEntries(invites.map((invite) => [invite.id, invite.claimedAt !== null]))
  expect(claimed).toEqual({ "by-link": true, "by-place": true, revoked: false, ended: false })
  const claims = (await sent()).filter((row) => row.type === "invite.claimed")
  expect(claims.map((row) => row.appId).sort()).toEqual(["quiet", "sales"])
})

test("a started plan is told to the app whose invite was claimed", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
  await events.notePlanStarted("salon", "pro")
  await events.notePlanStarted("barber", "pro")
  const plans = (await sent()).filter((row) => row.type === "plan.started")
  expect(plans).toHaveLength(2)
  expect(JSON.parse(plans[0].body).data).toMatchObject({ plan: "pro", slug: "salon" })
  await events.sendDuePartnerEvents()
})

test("no webhook fails at once; a refused send is tried again, then given up", async () => {
  fetchMock.mockResolvedValue(new Response(null, { status: 500 }))
  const quiet = (await sent()).filter((row) => row.appId === "quiet")
  expect(quiet.every((row) => row.state === "failed" && row.lastError === "No webhook")).toBe(true)
  const [plan] = (await sent()).filter((row) => row.appId === "sales" && row.type === "plan.started")
  expect(plan).toMatchObject({ state: "pending", lastError: "HTTP 500" })
  // Not due again until the retry time.
  const calls = fetchMock.mock.calls.length
  await events.sendDuePartnerEvents()
  expect(fetchMock.mock.calls.length).toBe(calls)
  let at = Date.now()
  for (let i = 0; i < PARTNER_RULES.maxAttempts; i++) {
    at += (PARTNER_RULES.retryMinutes + 1) * 60_000
    await events.sendDuePartnerEvents(at)
  }
  const [after] = await db.select().from(partnerEvents).where(eq(partnerEvents.id, plan.id))
  expect(after).toMatchObject({ state: "failed", attempts: PARTNER_RULES.maxAttempts })
})
