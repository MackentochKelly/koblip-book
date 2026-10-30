// @vitest-environment node
import { createHmac } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, chatConnections, chatReplies, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { applyChatEvent, verifyChatEvent } = await import("@/features/dashboard/api/chat-events")
const { POST } = await import("./route")

const SECRET = "s".repeat(64)
let dir: string
let closeDb: () => void

// Signed exactly as Chat signs (wapi-api services/koblip-sales-status-webhook.service.js).
function sign(body: string, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const hex = createHmac("sha256", SECRET).update(`${timestamp}.`).update(Buffer.from(body, "utf8")).digest("hex")
  return { signature: `sha256=${hex}`, timestamp }
}

function post(body: string, headers: { signature: string; timestamp: string }) {
  return POST(
    new Request("http://localhost/api/chat/events", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-koblip-signature": headers.signature,
        "x-koblip-timestamp": headers.timestamp,
      },
      body,
    })
  )
}

const reply = (occurredAt: string, extra: Record<string, unknown> = {}) => ({
  type: "inbound",
  eventId: `e-${occurredAt}`,
  messageId: "wamid.1",
  recordId: "r1",
  workspaceId: "w1",
  senderId: "p1",
  senderNumber: "15550001111",
  fromPhone: "18095550000",
  occurredAt,
  messageType: "text",
  text: "Hola, ¿a qué hora abren?",
  ...extra,
})

async function replies() {
  return db
    .select({
      workspaceId: chatReplies.workspaceId,
      phoneNumberId: chatReplies.phoneNumberId,
      customerPhone: chatReplies.customerPhone,
      lastReplyAt: chatReplies.lastReplyAt,
    })
    .from(chatReplies)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-chat-events-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("CHAT_EVENTS_SECRET", SECRET)
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
  await db.insert(chatConnections).values({
    businessId: "biz",
    workspaceId: "w1",
    workspaceName: "Lumen Studio",
    scopes: "contacts templates automations conversations",
  })
})

beforeEach(async () => {
  await db.delete(chatReplies)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a signed customer reply is kept, with the bytes as signed (non-ASCII text)", async () => {
  const body = JSON.stringify(reply("2026-10-30T12:00:00.000Z"))
  expect((await post(body, sign(body))).status).toBe(204)
  expect(await replies()).toEqual([
    {
      workspaceId: "w1",
      phoneNumberId: "p1",
      customerPhone: "18095550000",
      lastReplyAt: "2026-10-30T12:00:00.000Z",
    },
  ])
})

test("a bad, missing, stale or reused signature is refused before anything is read", async () => {
  const body = JSON.stringify(reply("2026-10-30T12:00:00.000Z"))
  const good = sign(body)
  expect((await post(body, { ...good, signature: `sha256=${"0".repeat(64)}` })).status).toBe(401)
  expect((await post(body, { ...good, signature: "" })).status).toBe(401)
  expect((await post(`${body} `, good)).status).toBe(401)
  const old = Math.floor(Date.now() / 1000 - 301).toString()
  expect((await post(body, sign(body, old))).status).toBe(401)
  expect(await replies()).toEqual([])
})

test("verification follows Chat's five-minute window", () => {
  const body = Buffer.from("{}")
  const { signature, timestamp } = sign("{}", "1000000")
  expect(verifyChatEvent(body, signature, timestamp, 1_000_000_000 + 300_000)).toBe(true)
  expect(verifyChatEvent(body, signature, timestamp, 1_000_000_000 + 301_000)).toBe(false)
})

test("repeats and late events never move the reply time back", async () => {
  await applyChatEvent(reply("2026-10-30T12:00:00.000Z"))
  await applyChatEvent(reply("2026-10-30T09:00:00.000Z"))
  await applyChatEvent(reply("2026-10-30T12:00:00.000Z"))
  expect((await replies()).map((row) => row.lastReplyAt)).toEqual(["2026-10-30T12:00:00.000Z"])
  await applyChatEvent(reply("2026-10-30T15:30:00.000Z"))
  expect((await replies()).map((row) => row.lastReplyAt)).toEqual(["2026-10-30T15:30:00.000Z"])
})

test("other workspaces, sent messages and statuses are acknowledged and not kept", async () => {
  await applyChatEvent(reply("2026-10-30T12:00:00.000Z", { workspaceId: "w-other" }))
  await applyChatEvent({ ...reply("2026-10-30T12:00:00.000Z"), type: "outbound" })
  await applyChatEvent({ type: "status", workspaceId: "w1", status: "delivered" })
  await applyChatEvent(reply("not a date"))
  expect(await replies()).toEqual([])
})
