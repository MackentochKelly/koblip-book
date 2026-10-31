// @vitest-environment node
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  chatTemplates,
  koblipChatConnection,
  koblipChatTemplates,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"

vi.mock("server-only", () => ({}))

const {
  chatConnectionFor,
  koblipMessages,
  koblipSendableTemplate,
  refreshChatTemplates,
  removeOldChatTemplates,
  refreshKoblipTemplates,
  sendableTemplate,
  submitChatTemplate,
  submitKoblipTemplate,
} = await import("./chat-templates")

let dir: string
let closeDb: () => void

// A stand-in for Chat's API: one workspace, its numbers and templates.
let numbers: unknown[] = []
let stored: {
  _id: string
  template_name: string
  language: string
  status: string
  rejection_reason?: string
}[] = []
// Templates Meta has but Chat lost, and Chat's copies of them.
let atMeta: { id: string; name: string; language: string }[] = []
const copied: unknown[] = []
const created: Record<string, unknown>[] = []
const edited: { id: string; body: Record<string, unknown> }[] = []
const synced: unknown[] = []
const removed: { id: string; body: Record<string, unknown> }[] = []
const chat = vi.fn(async (url: string, init: RequestInit = {}) => {
  const answer = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status })
  const { pathname: path, searchParams } = new URL(url)
  if (path === "/api/whatsapp/connections") return answer({ success: true, data: numbers })
  // Chat lists templates per WhatsApp account, as in production.
  if (path === "/api/template") {
    if (!searchParams.get("waba_id")) return answer({ success: false, message: "WABA ID is required" }, 400)
    return answer({ success: true, data: stored })
  }
  if (init.method === "DELETE" && path.startsWith("/api/template/")) {
    const id = path.split("/").pop()!
    removed.push({ id, body: JSON.parse(String(init.body)) })
    stored = stored.filter((row) => row._id !== id)
    return answer({ success: true, data: { deleted_from_meta: true } })
  }
  if (init.method === "PUT" && path.startsWith("/api/template/")) {
    edited.push({ id: path.split("/").pop()!, body: JSON.parse(String(init.body)) })
    return answer({ success: true })
  }
  if (path === "/api/template/sync-status") {
    synced.push(JSON.parse(String(init.body)))
    return answer({ success: true })
  }
  if (path === "/api/template/meta-list") return answer({ success: true, data: atMeta })
  if (path === "/api/template/sync") {
    const body = JSON.parse(String(init.body))
    copied.push(body)
    for (const row of atMeta.filter((item) => body.meta_template_ids.includes(item.id))) {
      stored.push({ _id: `c-${row.id}`, template_name: row.name, language: row.language, status: "PENDING" })
    }
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
  atMeta = []
  copied.length = 0
  created.length = 0
  edited.length = 0
  synced.length = 0
  removed.length = 0
  chat.mockClear()
  await db.delete(chatTemplates)
  await db.delete(koblipChatTemplates)
  await db.delete(koblipChatConnection)
  await connect()
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

test("with no WhatsApp number nothing is made and the owner is told", async () => {
  await refreshChatTemplates("biz")
  expect(await submitChatTemplate("biz", "reminder", "en")).toBe("noNumber")
  expect(created).toHaveLength(0)
  expect((await chatConnectionFor("biz"))?.messages).toBe("noNumber")
})

test("the oldest active number is used and nothing is made until the owner submits", async () => {
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
  await refreshChatTemplates("biz")
  const [row] = await db.select().from(chatConnections)
  expect(row).toMatchObject({ wabaId: "waba1", phoneNumberId: "pOld" })
  expect(created).toHaveLength(0)
  expect(edited).toHaveLength(0)
  expect((await chatConnectionFor("biz"))?.messages).toBe("notSubmitted")
})

test("submitting makes the template with its buttons, and only that one", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  expect(await submitChatTemplate("biz", "reminder", "en")).toBeNull()
  expect(created).toEqual([
    {
      waba_id: "waba1",
      platform: "whatsapp",
      template_name: "koblip_book_booking_reminder_v2",
      language: "en",
      category: "UTILITY",
      header_text: "Appointment reminder",
      message_body:
        "Hi {{1}}, a reminder of your {{2}} at {{3}} on {{4}} at {{5}}. See you soon!",
      footer_text: "Reply here to talk to us",
      variable_examples: { 1: "Alex", 2: "Haircut", 3: "Lumen Studio", 4: "Friday, May 8", 5: "3:30 PM" },
      buttons: [
        { type: "quick_reply", text: "I'll be there", payload: "confirm" },
        { type: "quick_reply", text: "Can't make it", payload: "cantCome" },
      ],
      save_as_draft: false,
    },
  ])
  const rows = await db.select().from(chatTemplates)
  expect(rows).toEqual([
    expect.objectContaining({
      message: "reminder",
      language: "en",
      chatTemplateId: "t1",
      status: "pending",
      reason: null,
      submitted: expect.objectContaining({ header: "Appointment reminder" }),
    }),
  ])
})

test("submitting again changes Chat's template instead of making another", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  await submitChatTemplate("biz", "confirmed", "es")
  await submitChatTemplate("biz", "confirmed", "es")
  expect(created).toHaveLength(1)
  expect(edited).toEqual([
    { id: "t1", body: expect.objectContaining({ header_text: "Reserva confirmada", buttons: [] }) },
  ])
})

test("a template Meta has but Chat lost is copied back, then changed, not made again", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  atMeta = [
    { id: "m1", name: "koblip_book_booking_reminder_v2", language: "es" },
    { id: "m2", name: "someone_else", language: "es" },
  ]
  await submitChatTemplate("biz", "reminder", "es")
  expect(copied).toEqual([{ waba_id: "waba1", meta_template_ids: ["m1"] }])
  expect(created).toHaveLength(0)
  expect(edited.map(({ id }) => id)).toEqual(["c-m1"])
})

test("refreshing reads Meta's review and reason, and the approved template is sent as submitted", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  await submitChatTemplate("biz", "reminder", "en")
  await submitChatTemplate("biz", "reminder", "es")
  stored[0].status = "APPROVED"
  stored[1].status = "REJECTED"
  stored[1].rejection_reason = "INVALID_FORMAT"
  await refreshChatTemplates("biz")
  expect(synced).toEqual([{ waba_id: "waba1", template_ids: ["t1", "t2"] }])
  const rows = await db.select().from(chatTemplates)
  expect(rows).toContainEqual(expect.objectContaining({ language: "es", status: "rejected", reason: "INVALID_FORMAT" }))
  expect((await chatConnectionFor("biz"))?.messages).toBe("rejected")

  const { approved } = await sendableTemplate("biz", "reminder", "en")
  expect(approved).toMatchObject({ chatTemplateId: "t1", template: { name: "koblip_book_booking_reminder_v2" } })
  expect((await sendableTemplate("biz", "reminder", "es")).approved).toBeNull()
})

test("a template Chat already has under Book's name is used as it is", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  stored = [{ _id: "x1", template_name: "koblip_book_booking_confirmed_v2", language: "en", status: "APPROVED" }]
  await refreshChatTemplates("biz")
  expect(created).toHaveLength(0)
  const { approved } = await sendableTemplate("biz", "confirmed", "en")
  expect(approved?.chatTemplateId).toBe("x1")
})

test("a template Chat no longer has, or under an earlier name, is forgotten", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  stored = [{ _id: "old1", template_name: "koblip_book_booking_confirmed", language: "en", status: "PENDING" }]
  await db
    .insert(chatTemplates)
    .values({ businessId: "biz", message: "confirmed", language: "en", chatTemplateId: "old1", status: "pending" })
  await refreshChatTemplates("biz")
  expect(await db.select().from(chatTemplates)).toEqual([])
  expect(created).toHaveLength(0)
})

test("a connection made before templates were asked for must reconnect", async () => {
  await connect("contacts automations conversations")
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  await refreshChatTemplates("biz")
  expect(await submitChatTemplate("biz", "reminder", "en")).toBe("notConnected")
  expect(chat).not.toHaveBeenCalled()
  expect((await chatConnectionFor("biz"))?.needsReconnect).toBe(true)
})

async function connectKoblip() {
  await db.insert(koblipChatConnection).values({
    id: "koblip",
    workspaceId: "wk",
    workspaceName: "Koblip",
    scopes: "contacts templates automations conversations",
    accessToken: seal("koa_k"),
    refreshToken: seal("kor_k"),
    accessExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  })
}

test("Koblip's set: nothing is made until the admin submits, and the number is saved", async () => {
  expect(await submitKoblipTemplate("reminder", "en", "u1")).toBe("notConnected")
  await connectKoblip()
  expect(await submitKoblipTemplate("reminder", "en", "u1")).toBe("noNumber")
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await refreshKoblipTemplates()
  const [row] = await db.select().from(koblipChatConnection)
  expect(row).toMatchObject({ wabaId: "wabak", phoneNumberId: "pk" })
  expect(created).toHaveLength(0)
  expect((await koblipMessages()).every((item) => item.texts.en.review === "draft")).toBe(true)
})

test("submitting one of Koblip's messages makes it in Koblip's workspace and logs who did", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  expect(await submitKoblipTemplate("reminder", "es", "u1")).toBeNull()
  expect(created).toEqual([
    expect.objectContaining({
      waba_id: "wabak",
      template_name: "koblip_booking_reminder_v2",
      language: "es",
      category: "UTILITY",
      save_as_draft: false,
      buttons: [
        { type: "quick_reply", text: "Ahí estaré", payload: "confirm" },
        { type: "quick_reply", text: "No podré ir", payload: "cantCome" },
      ],
    }),
  ])
  expect(chat.mock.calls.every(([, init]) => new Headers(init?.headers).get("authorization") === "Bearer koa_k")).toBe(true)
  const [change] = await db.select().from(platformSettingChanges)
  expect(change).toMatchObject({ key: "whatsapp.koblipSubmit.reminder.es", before: null, changedBy: "u1" })

  const reminder = (await koblipMessages()).find((item) => item.message === "reminder")!
  expect(reminder.texts.es.review).toBe("waiting")
  expect(reminder.texts.en.review).toBe("draft")
  expect(reminder.texts.es.preview).toContain("Ana")

  // Submitting again changes Chat's copy instead of making another.
  expect(await submitKoblipTemplate("reminder", "es", "u1")).toBeNull()
  expect(created).toHaveLength(1)
  expect(edited).toEqual([expect.objectContaining({ id: "t1" })])
})

test("Meta's review of Koblip's set is read back, and the approved one is sent", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await submitKoblipTemplate("confirmed", "en", "u1")
  await submitKoblipTemplate("cancelled", "en", "u1")
  stored[0].status = "APPROVED"
  stored[1].status = "REJECTED"
  stored[1].rejection_reason = "Too promotional"
  await refreshKoblipTemplates()
  expect(synced).toEqual([{ waba_id: "wabak", template_ids: ["t1", "t2"] }])

  const messages = await koblipMessages()
  expect(messages.find((item) => item.message === "confirmed")!.texts.en.review).toBe("approved")
  expect(messages.find((item) => item.message === "cancelled")!.texts.en).toMatchObject({
    review: "rejected",
    reason: "Too promotional",
  })
  expect((await koblipSendableTemplate("confirmed", "en")).approved?.chatTemplateId).toBe("t1")
  expect((await koblipSendableTemplate("cancelled", "en")).approved).toBeNull()
})

test("removing the first templates lists them per WhatsApp account and keeps approved ones", async () => {
  const names = ["koblip_book_booking_reminder", "koblip_book_booking_confirmed"]
  const lines: string[] = []
  const log = (line: string) => lines.push(line)

  // No WhatsApp account saved yet: skipped, Chat is not asked.
  await db.update(chatConnections).set({ wabaId: null, phoneNumberId: null })
  expect(await removeOldChatTemplates({ names, remove: true, log })).toEqual({ deleted: 0, failed: 0 })
  expect(lines).toEqual(["Lumen Studio: no WhatsApp account saved yet, skipped"])
  expect(chat).not.toHaveBeenCalled()

  await db.update(chatConnections).set({ wabaId: "waba1" })
  stored = [
    { _id: "old1", template_name: "koblip_book_booking_reminder", language: "en", status: "PENDING" },
    { _id: "old2", template_name: "koblip_book_booking_confirmed", language: "es", status: "APPROVED" },
    { _id: "new1", template_name: "koblip_book_booking_reminder_v2", language: "en", status: "PENDING" },
  ]

  // A dry run deletes nothing.
  lines.length = 0
  expect(await removeOldChatTemplates({ names, remove: false, log })).toEqual({ deleted: 0, failed: 0 })
  expect(lines).toEqual([
    "Lumen Studio: koblip_book_booking_reminder (en), PENDING: would delete",
    "Lumen Studio: koblip_book_booking_confirmed (es), APPROVED: approved, kept",
  ])
  expect(removed).toEqual([])
  expect(new URL(String(chat.mock.calls[0][0])).searchParams.get("waba_id")).toBe("waba1")

  expect(await removeOldChatTemplates({ names, remove: true, log })).toEqual({ deleted: 1, failed: 0 })
  expect(removed).toEqual([{ id: "old1", body: { delete_from_meta: true } }])
  expect(stored.map((row) => row._id)).toEqual(["old2", "new1"])
})
