// @vitest-environment node
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, chatConnections, chatTemplates, user } from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"

vi.mock("server-only", () => ({}))

const { chatConnectionFor, setUpChatTemplates } = await import("./chat-templates")

let dir: string
let closeDb: () => void

// A stand-in for Chat's API: one workspace, its numbers and templates.
let numbers: unknown[] = []
let stored: { _id: string; template_name: string; language: string; status: string }[] = []
const created: Record<string, unknown>[] = []
const synced: unknown[] = []
const chat = vi.fn(async (url: string, init: RequestInit = {}) => {
  const answer = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status })
  const path = new URL(url).pathname
  if (path === "/api/whatsapp/connections") return answer({ success: true, data: numbers })
  if (path === "/api/template") return answer({ success: true, data: stored })
  if (path === "/api/template/sync-status") {
    synced.push(JSON.parse(String(init.body)))
    return answer({ success: true })
  }
  if (path === "/api/template/create") {
    const body = JSON.parse(String(init.body))
    created.push(body)
    const _id = `t${created.length}`
    stored.push({ _id, template_name: body.template_name, language: body.language, status: "pending" })
    return answer({ template_id: _id }, 201)
  }
  return answer({ code: "not_found" }, 404)
})

async function connect(scopes = "contacts templates automations conversations") {
  const row = {
    workspaceId: "w1",
    workspaceName: "Lumen Studio",
    scopes,
    accessToken: seal("koa_1"),
    refreshToken: seal("kor_1"),
    accessExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    needsReconnect: false,
  }
  await db
    .insert(chatConnections)
    .values({ businessId: "biz", ...row })
    .onConflictDoUpdate({ target: chatConnections.businessId, set: row })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-chat-templates-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
  vi.stubEnv("CHAT_OAUTH_CLIENT_ID", "koblip-book")
  vi.stubEnv("CHAT_OAUTH_CLIENT_SECRET", "secret")
  vi.stubEnv("CHAT_OAUTH_REDIRECT_URI", "http://localhost:3100/api/chat/callback")
  vi.stubEnv("CHAT_CONNECT_URL", "https://chat.example.test/connect/koblip-book")
  vi.stubEnv("CHAT_API_URL", "https://api.example.test")
  vi.stubGlobal("fetch", chat)
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
  numbers = []
  stored = []
  created.length = 0
  synced.length = 0
  chat.mockClear()
  await db.delete(chatTemplates)
  await connect()
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

test("with no WhatsApp number nothing is made and the owner is told", async () => {
  await setUpChatTemplates("biz")
  expect(created).toHaveLength(0)
  expect((await chatConnectionFor("biz"))?.messages).toBe("noNumber")
})

test("the oldest active number is used and every message is made in both languages", async () => {
  numbers = [
    { id: "wabaOff", is_active: false, phone_numbers: [{ id: "pOff", is_active: true, created_at: "2025-01-01" }] },
    {
      id: "waba1",
      is_active: true,
      phone_numbers: [
        { id: "pNew", is_active: true, created_at: "2026-02-01" },
        { id: "pOld", is_active: true, created_at: "2026-01-01" },
        { id: "pInactive", is_active: false, created_at: "2025-06-01" },
      ],
    },
  ]
  await setUpChatTemplates("biz")
  const [row] = await db.select().from(chatConnections)
  expect(row).toMatchObject({ wabaId: "waba1", phoneNumberId: "pOld" })
  expect(created).toHaveLength(10)
  expect(created).toContainEqual({
    waba_id: "waba1",
    platform: "whatsapp",
    template_name: "koblip_book_booking_confirmed",
    language: "en",
    category: "UTILITY",
    header_text: "Booking confirmed",
    message_body: "Hi {{1}}, your {{2}} at {{3}} is booked for {{4}} at {{5}}. See you then!",
    footer_text: "Reply here to talk to us",
    variable_examples: { 1: "Alex", 2: "Haircut", 3: "Lumen Studio", 4: "Friday, May 8", 5: "3:30 PM" },
    save_as_draft: false,
  })
  expect((await chatConnectionFor("biz"))?.messages).toBe("waiting")
})

test("templates already in Chat are reused, and Meta's review is read again", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  await setUpChatTemplates("biz")
  expect(created).toHaveLength(10)

  for (const template of stored) template.status = "APPROVED"
  await setUpChatTemplates("biz")
  expect(created).toHaveLength(10)
  expect(synced).toEqual([
    { waba_id: "waba1", template_ids: expect.arrayContaining(stored.map((t) => t._id)) },
  ])
  expect((await chatConnectionFor("biz"))?.messages).toBe("ready")

  stored[0].status = "rejected"
  await db.delete(chatTemplates)
  await setUpChatTemplates("biz")
  expect((await chatConnectionFor("biz"))?.messages).toBe("rejected")
})

test("a connection made before templates were asked for must reconnect", async () => {
  await connect("contacts automations conversations")
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  await setUpChatTemplates("biz")
  expect(chat).not.toHaveBeenCalled()
  expect((await chatConnectionFor("biz"))?.needsReconnect).toBe(true)
})
