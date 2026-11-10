// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { businesses, partnerApps, partnerInvites } from "@/lib/db/schema"
import { hashSecret, newApiKey } from "@/lib/partner-keys"

vi.mock("server-only", () => ({}))

const { POST } = await import("./route")
const { GET } = await import("./[inviteId]/route")
const { findInviteByCode } = await import("@/features/partners/api/invites")

let dir: string
let db: (typeof import("@/lib/db"))["db"]
const sales = newApiKey()
const other = newApiKey()
const PLACE = "ChIJ_place_one_0001"

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "partner-invites-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  process.env.BETTER_AUTH_URL = "https://book.example.com"
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(partnerApps).values([
    { id: "sales", name: "Sales", keyHash: sales.hash, keyHint: sales.hint, eventSecret: "s", dailyInvites: 2 },
    { id: "other", name: "Other", keyHash: other.hash, keyHint: other.hint, eventSecret: "o", dailyInvites: 5 },
  ])
})

afterAll(() => rmSync(dir, { recursive: true, force: true }))

const ask = (key: string | null, body: unknown) =>
  POST(
    new Request("https://book.example.com/api/partner/v1/invites", {
      method: "POST",
      headers: key ? { authorization: `Bearer ${key}` } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    })
  )

const read = (key: string, id: string) =>
  GET(
    new Request(`https://book.example.com/api/partner/v1/invites/${id}`, {
      headers: { authorization: `Bearer ${key}` },
    }),
    { params: Promise.resolve({ inviteId: id }) }
  )

test("no key, a wrong key or a bad body is refused", async () => {
  expect((await ask(null, { placeId: PLACE })).status).toBe(401)
  expect((await ask("kbk_" + "x".repeat(43), { placeId: PLACE })).status).toBe(401)
  expect((await ask(sales.key, "not json")).status).toBe(400)
  expect((await ask(sales.key, { placeId: "bad id!" })).status).toBe(400)
  expect((await ask(sales.key, { placeId: PLACE, ref: 5 })).status).toBe(400)
})

let url = ""
let inviteId = ""

test("an invite is made: one link, kept only as a hash", async () => {
  const answer = await ask(sales.key, { placeId: PLACE, ref: " lead-7 " })
  expect(answer.status).toBe(201)
  const body = await answer.json()
  url = body.url
  inviteId = body.invite.id
  expect(url).toMatch(/^https:\/\/book\.example\.com\/start\/[A-Za-z0-9_-]{43}$/)
  expect(body.invite).toMatchObject({ ref: "lead-7", placeId: PLACE, state: "open", pageUrl: null })
  const code = url.split("/start/")[1]
  const [row] = await db.select().from(partnerInvites).where(eq(partnerInvites.id, inviteId))
  expect(row.codeHash).toBe(hashSecret(code))
  expect(await findInviteByCode(code)).toMatchObject({ state: "open", id: inviteId, placeId: PLACE })
  expect(await findInviteByCode("y".repeat(43))).toEqual({ state: "ended" })
})

test("the same place again gives back the open invite's id", async () => {
  const answer = await ask(sales.key, { placeId: PLACE })
  expect(answer.status).toBe(409)
  expect(await answer.json()).toEqual({ error: "invite_open", id: inviteId })
})

test("the daily cap holds", async () => {
  expect((await ask(sales.key, { placeId: "ChIJ_place_two_0002" })).status).toBe(201)
  const capped = await ask(sales.key, { placeId: "ChIJ_place_three_03" })
  expect(capped.status).toBe(429)
  expect(await capped.json()).toEqual({ error: "daily_cap" })
})

test("a business already owned on Book gets no invite", async () => {
  await db.insert(businesses).values({
    id: "owned",
    name: "Owned",
    slug: "owned-salon",
    timezone: "UTC",
    currency: "USD",
    googlePlaceId: "ChIJ_owned_place_01",
    ownerId: null,
  })
  // Not owned yet: an invite is fine.
  expect((await ask(other.key, { placeId: "ChIJ_owned_place_01" })).status).toBe(201)
  const { user } = await import("@/lib/db/schema")
  await db.insert(user).values({ id: "owner", name: "Owner", email: "o@example.com", emailVerified: true, createdAt: new Date(), updatedAt: new Date() })
  await db.update(businesses).set({ ownerId: "owner" }).where(eq(businesses.id, "owned"))
  const answer = await ask(other.key, { placeId: "ChIJ_owned_place_01" })
  expect(answer.status).toBe(409)
  expect(await answer.json()).toEqual({
    error: "already_on_book",
    pageUrl: "https://book.example.com/b/owned-salon",
  })
})

test("an app reads only its own invites", async () => {
  const mine = await read(sales.key, inviteId)
  expect(mine.status).toBe(200)
  expect((await mine.json()).invite).toMatchObject({ id: inviteId, state: "open" })
  expect((await read(other.key, inviteId)).status).toBe(404)
})

test("a revoked app's key stops working and its link ends", async () => {
  await db.update(partnerApps).set({ revokedAt: new Date().toISOString() }).where(eq(partnerApps.id, "sales"))
  expect((await read(sales.key, inviteId)).status).toBe(401)
  expect(await findInviteByCode(url.split("/start/")[1])).toEqual({ state: "ended" })
})
