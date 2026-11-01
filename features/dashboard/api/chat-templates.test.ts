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
  inAppNotifications,
  koblipChatConnection,
  koblipChatTemplates,
  koblipNotificationTexts,
  platformSettingChanges,
  user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"
import { defaultButtons, defaultWording } from "../utils/booking-templates"

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
const { notificationMessagesFor } = await import("./notifications")

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
let atMeta: { id: string; name: string; language: string; status?: string }[] = []
let createRefusal: string | null = null
let deletionSucceeds = true
let beforeDelete: (() => Promise<void>) | null = null
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
    await beforeDelete?.()
    removed.push({ id, body: JSON.parse(String(init.body)) })
    const removedRow = stored.find((row) => row._id === id)
    stored = stored.filter((row) => row._id !== id)
    if (deletionSucceeds && removedRow) {
      atMeta = atMeta.filter((row) => row.name !== removedRow.template_name || row.language !== removedRow.language)
    }
    return answer({ success: true, data: { deleted_from_meta: deletionSucceeds, meta_deletion_error: deletionSucceeds ? undefined : "Meta unavailable" } })
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
      stored.push({ _id: `c-${row.id}`, template_name: row.name, language: row.language, status: row.status ?? "PENDING" })
    }
    return answer({ success: true })
  }
  if (path === "/api/template/create") {
    if (createRefusal) return answer({ success: false, message: createRefusal }, 400)
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
  createRefusal = null
  deletionSucceeds = true
  beforeDelete = null
  copied.length = 0
  created.length = 0
  edited.length = 0
  synced.length = 0
  removed.length = 0
  chat.mockClear()
  await db.delete(chatTemplates)
  await db.delete(koblipChatTemplates)
  await db.delete(koblipNotificationTexts)
  await db.delete(platformSettingChanges)
  await db.delete(koblipChatConnection)
  await db.delete(inAppNotifications)
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

  // The owner's bell hears Meta's answers once (N2).
  await refreshChatTemplates("biz")
  expect((await db.select().from(inAppNotifications)).map(({ kind, data }) => [kind, data]).sort()).toEqual([
    ["templateApproved", { message: "reminder", language: "en" }],
    ["templateRejected", { message: "reminder", language: "es" }],
  ])
})

test("a template Chat already has under Book's name is used as it is", async () => {
  numbers = [{ id: "waba1", phone_numbers: [{ id: "p1" }] }]
  stored = [{ _id: "x1", template_name: "koblip_book_booking_confirmed_v2", language: "en", status: "APPROVED" }]
  await refreshChatTemplates("biz")
  expect(created).toHaveLength(0)
  const { approved } = await sendableTemplate("biz", "confirmed", "en")
  expect(approved?.chatTemplateId).toBe("x1")
  // Found already answered: not news for the bell.
  expect(await db.select().from(inAppNotifications)).toEqual([])
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

  // An unchanged pending submission is already under review.
  expect(await submitKoblipTemplate("reminder", "es", "u1")).toBeNull()
  expect(created).toHaveLength(1)
  expect(edited).toEqual([])
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
  expect(synced).toContainEqual({ waba_id: "wabak", template_ids: ["t1", "t2"] })

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


test("saved Koblip wording and buttons send normally while the approved submitted copy stays unchanged", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await submitKoblipTemplate("reminder", "en", "u1")
  stored[0].status = "APPROVED"
  await refreshKoblipTemplates()
  const approvedBefore = (await koblipSendableTemplate("reminder", "en")).approved
  const wording = { ...defaultWording("reminder", "en"), body: "Hello {name}, your {service} at {business} is on {date} at {time}." }
  const buttons = [{ action: "confirm" as const, label: "Count me in" }]
  await db.insert(koblipNotificationTexts).values({ message: "reminder", language: "en", ...wording, buttons })

  const sendable = await koblipSendableTemplate("reminder", "en")
  expect(sendable.template).toMatchObject({ ...wording, buttons })
  expect(sendable.approved).toEqual(approvedBefore)
  const reminder = (await koblipMessages()).find((row) => row.message === "reminder")!
  expect(reminder.texts.en).toMatchObject({ wording, buttons, review: "draft" })
  expect(reminder.texts.en.preview).toContain("Hello Alex")
  expect(created).toHaveLength(1)
  expect(edited).toEqual([])
})

test("Koblip wording is independent in each language and null buttons use each language's defaults", async () => {
  const en = { ...defaultWording("reminder", "en"), header: "Your upcoming appointment" }
  const es = { ...defaultWording("reminder", "es"), header: "Tu próxima cita" }
  await db.insert(koblipNotificationTexts).values([
    { message: "reminder", language: "en", ...en, buttons: null },
    { message: "reminder", language: "es", ...es, buttons: [] },
  ])
  expect((await koblipSendableTemplate("reminder", "en")).template).toMatchObject({ ...en, buttons: defaultButtons("reminder", "en") })
  expect((await koblipSendableTemplate("reminder", "es")).template).toMatchObject({ ...es, buttons: [] })
  const reminder = (await koblipMessages()).find((row) => row.message === "reminder")!
  expect(reminder.texts.en).toMatchObject({ wording: en, buttons: defaultButtons("reminder", "en"), review: "draft" })
  expect(reminder.texts.es).toMatchObject({ wording: es, buttons: [], review: "draft" })
})

test("a business using Koblip's number sees the saved Koblip wording and default buttons", async () => {
  await db.delete(chatConnections)
  const wording = { ...defaultWording("reminder", "es"), header: "Tu próxima cita" }
  await db.insert(koblipNotificationTexts).values({ message: "reminder", language: "es", ...wording, buttons: null })
  const reminder = (await notificationMessagesFor("biz")).find((row) => row.message === "reminder")!
  expect(reminder.editable).toBe(false)
  expect(reminder.texts.es).toMatchObject({ wording, buttons: defaultButtons("reminder", "es"), review: "draft" })
  expect(reminder.texts.en.wording).toEqual(defaultWording("reminder", "en"))
})

async function approvedKoblipReminder(language: "en" | "es" = "en") {
  await submitKoblipTemplate("reminder", language, "u1")
  const row = stored.find((item) => item.template_name === "koblip_booking_reminder_v2" && item.language === language)!
  row.status = "APPROVED"
  await refreshKoblipTemplates()
  return (await koblipSendableTemplate("reminder", language)).approved!
}

async function changeKoblipReminder(language: "en" | "es" = "en", header = "Your next appointment") {
  const wording = { ...defaultWording("reminder", language), header }
  await db.insert(koblipNotificationTexts)
    .values({ message: "reminder", language, ...wording, buttons: null })
    .onConflictDoUpdate({ target: [koblipNotificationTexts.message, koblipNotificationTexts.language], set: wording })
  return wording
}

test("an approved Koblip version stays live until refresh sees approval, then switches before deleting it", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const original = await approvedKoblipReminder()
  const wording = await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created.map((row) => row.template_name)).toEqual(["koblip_booking_reminder_v2", "koblip_booking_reminder_v3"])
  expect(edited).toEqual([])
  expect((await koblipSendableTemplate("reminder", "en")).approved).toEqual(original)
  expect(removed).toEqual([])
  expect((await koblipMessages()).find((row) => row.message === "reminder")!.texts.en.review).toBe("waiting")

  stored.find((row) => row._id === "t2")!.status = "APPROVED"
  beforeDelete = async () => {
    const live = (await koblipSendableTemplate("reminder", "en")).approved!
    expect(live.chatTemplateId).toBe("t2")
    expect(live.template).toMatchObject({ ...wording, name: "koblip_booking_reminder_v3" })
  }
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe("t2")
  expect(removed).toEqual([{ id: "t1", body: { delete_from_meta: true } }])
  beforeDelete = null
  await changeKoblipReminder("en", "Another approved update")
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created[2].template_name).toBe("koblip_booking_reminder_v4")
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe("t2")
})

test("Meta refusing creation or rejecting review keeps the old approved Koblip version live", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const original = await approvedKoblipReminder()
  await changeKoblipReminder()
  const beforeChanges = await db.select().from(platformSettingChanges)
  createRefusal = "Template limit reached"
  await expect(submitKoblipTemplate("reminder", "en", "u1")).rejects.toMatchObject({ reason: "Template limit reached" })
  expect((await koblipSendableTemplate("reminder", "en")).approved).toEqual(original)
  expect(await db.select().from(platformSettingChanges)).toEqual(beforeChanges)
  createRefusal = null
  await submitKoblipTemplate("reminder", "en", "u1")
  stored.find((row) => row._id === "t2")!.status = "REJECTED"
  stored.find((row) => row._id === "t2")!.rejection_reason = "Promotional wording"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved).toEqual(original)
  expect((await koblipMessages()).find((row) => row.message === "reminder")!.texts.en).toMatchObject({ review: "rejected", reason: "Promotional wording" })
  expect(removed).toEqual([])
})

test("English and Spanish switch independently and a shared old name stays until neither language uses it", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const oldEn = await approvedKoblipReminder("en")
  const oldEs = await approvedKoblipReminder("es")
  await changeKoblipReminder("en")
  await submitKoblipTemplate("reminder", "en", "u1")
  const nextEn = stored.find((row) => row.template_name === "koblip_booking_reminder_v3" && row.language === "en")!
  nextEn.status = "APPROVED"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe(nextEn._id)
  expect((await koblipSendableTemplate("reminder", "es")).approved).toEqual(oldEs)
  expect(removed).toEqual([])

  await changeKoblipReminder("es", "Tu próxima cita")
  await submitKoblipTemplate("reminder", "es", "u1")
  expect(removed).toEqual([])
  const nextEs = stored.find((row) => row.template_name === "koblip_booking_reminder_v3" && row.language === "es")!
  nextEs.status = "APPROVED"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "es")).approved!.chatTemplateId).toBe(nextEs._id)
  expect(removed.map((row) => row.id)).toEqual(expect.arrayContaining([oldEn.chatTemplateId, oldEs.chatTemplateId]))
})

test("a rejected Koblip candidate lost by Chat is copied back before resubmitting without disturbing the live version", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const original = await approvedKoblipReminder()
  await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  stored.find((row) => row._id === "t2")!.status = "REJECTED"
  await refreshKoblipTemplates()
  stored = stored.filter((row) => row._id !== "t2")
  atMeta = [{ id: "meta3", name: "koblip_booking_reminder_v3", language: "en", status: "REJECTED" }]
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(copied).toContainEqual({ waba_id: "wabak", meta_template_ids: ["meta3"] })
  expect(edited).toEqual([expect.objectContaining({ id: "c-meta3" })])
  expect(created).toHaveLength(2)
  expect((await koblipSendableTemplate("reminder", "en")).approved).toEqual(original)
})

test("refresh restores a live Koblip template Chat lost without submitting or discarding its approved snapshot", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const original = await approvedKoblipReminder()
  stored = []
  atMeta = [{ id: "meta2", name: "koblip_booking_reminder_v2", language: "en", status: "APPROVED" }]
  await refreshKoblipTemplates()
  expect(copied).toContainEqual({ waba_id: "wabak", meta_template_ids: ["meta2"] })
  expect((await koblipSendableTemplate("reminder", "en")).approved).toMatchObject({ chatTemplateId: "c-meta2", template: original.template })
  expect(created).toHaveLength(1)
  expect(edited).toEqual([])
})

test("failed Meta cleanup is retried after restoring Chat's deleted copy while the replacement keeps sending", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await approvedKoblipReminder()
  atMeta = [{ id: "meta2", name: "koblip_booking_reminder_v2", language: "en", status: "APPROVED" }]
  await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  stored.find((row) => row._id === "t2")!.status = "APPROVED"
  deletionSucceeds = false
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe("t2")
  expect(stored.some((row) => row._id === "t1")).toBe(false)
  deletionSucceeds = true
  await refreshKoblipTemplates()
  expect(copied).toContainEqual({ waba_id: "wabak", meta_template_ids: ["meta2"] })
  expect(removed.map((row) => row.id)).toEqual(["t1", "c-meta2"])
  expect(atMeta).toEqual([])
  const deletedCount = removed.length
  await refreshKoblipTemplates()
  expect(removed).toHaveLength(deletedCount)
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe("t2")
})

test("two simultaneous Koblip refreshes share one operation and release it for the next refresh", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const first = refreshKoblipTemplates()
  const second = refreshKoblipTemplates()
  expect(second).toBe(first)
  await Promise.all([first, second])
  expect(chat.mock.calls.filter(([url]) => new URL(url).pathname === "/api/whatsapp/connections")).toHaveLength(1)
  await refreshKoblipTemplates()
  expect(chat.mock.calls.filter(([url]) => new URL(url).pathname === "/api/whatsapp/connections")).toHaveLength(2)
})

test("editing a pending Koblip submission makes a new version and never edits a template still under review", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await submitKoblipTemplate("reminder", "en", "u1")
  await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created.map((row) => row.template_name)).toEqual(["koblip_booking_reminder_v2", "koblip_booking_reminder_v3"])
  expect(edited).toEqual([])
  expect((await koblipSendableTemplate("reminder", "en")).approved).toBeNull()
})

test("Use default after submission changes normal wording immediately and waits for approval before replacing the custom template", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  const custom = await changeKoblipReminder("en", "Your custom reminder")
  const original = await approvedKoblipReminder()
  expect(original.template.header).toBe(custom.header)
  await db.delete(koblipNotificationTexts)
  const reset = await koblipSendableTemplate("reminder", "en")
  expect(reset.template).toMatchObject({ ...defaultWording("reminder", "en"), buttons: defaultButtons("reminder", "en") })
  expect(reset.approved).toEqual(original)
  expect((await koblipMessages()).find((row) => row.message === "reminder")!.texts.en.review).toBe("draft")
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created[1].template_name).toBe("koblip_booking_reminder_v3")
  expect((await koblipSendableTemplate("reminder", "en")).approved).toEqual(original)
  stored.find((row) => row._id === "t2")!.status = "APPROVED"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved!.template)
    .toMatchObject({ ...defaultWording("reminder", "en"), buttons: defaultButtons("reminder", "en") })
})

test("an unchanged pending submit adds an audit entry without sending a remote edit", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await submitKoblipTemplate("reminder", "en", "u1")
  const [first] = await db.select().from(platformSettingChanges)
  expect(await submitKoblipTemplate("reminder", "en", "u1")).toBeNull()
  const changes = await db.select().from(platformSettingChanges)
  expect(changes).toHaveLength(2)
  expect(changes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: "whatsapp.koblipSubmit.reminder.en",
      before: first.after,
      after: first.after,
      changedBy: "u1",
    }),
  ]))
  expect(created).toHaveLength(1)
  expect(edited).toEqual([])
})

test("submission first promotes a remotely approved pending version before creating the next edit", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await submitKoblipTemplate("reminder", "en", "u1")
  stored.find((row) => row._id === "t1")!.status = "APPROVED"
  expect((await db.select().from(koblipChatTemplates))[0].status).toBe("pending")
  const wording = await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  const sendable = await koblipSendableTemplate("reminder", "en")
  expect(sendable.template).toMatchObject(wording)
  expect(sendable.approved).toMatchObject({
    chatTemplateId: "t1",
    template: { ...defaultWording("reminder", "en"), name: "koblip_booking_reminder_v2" },
  })
  expect(created.map((row) => row.template_name)).toEqual(["koblip_booking_reminder_v2", "koblip_booking_reminder_v3"])
  expect(edited).toEqual([])
  expect(removed).toEqual([])
})

test("a paused older live version stops sending but stays tracked until its waiting replacement is approved", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await approvedKoblipReminder()
  await changeKoblipReminder()
  await submitKoblipTemplate("reminder", "en", "u1")
  stored.find((row) => row._id === "t1")!.status = "PAUSED"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved).toBeNull()
  const [waiting] = await db.select().from(koblipChatTemplates)
  expect(waiting.status).toBe("pending")
  expect(waiting.live).toBeNull()
  expect(waiting.retired).toEqual(expect.arrayContaining([
    { chatTemplateId: "t1", name: "koblip_booking_reminder_v2", language: "en" },
  ]))
  expect(removed).toEqual([])
  stored.find((row) => row._id === "t2")!.status = "APPROVED"
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved!.chatTemplateId).toBe("t2")
  expect(removed).toEqual([{ id: "t1", body: { delete_from_meta: true } }])
  expect((await db.select().from(koblipChatTemplates))[0].retired).toEqual([])
})

test("a missing template advances the version instead of reusing a deleted Meta name", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  await approvedKoblipReminder()
  stored = []
  atMeta = []
  await refreshKoblipTemplates()
  expect((await koblipSendableTemplate("reminder", "en")).approved).toBeNull()
  expect((await db.select().from(koblipChatTemplates))[0]).toMatchObject({ status: "missing", version: 2 })
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created.map((row) => row.template_name)).toEqual(["koblip_booking_reminder_v2", "koblip_booking_reminder_v3"])
  expect(edited).toEqual([])
  expect((await koblipSendableTemplate("reminder", "en")).approved).toBeNull()
})


test("refreshing an imported legacy approval never calls a newer saved draft its approved wording", async () => {
  await connectKoblip()
  numbers = [{ id: "wabak", phone_numbers: [{ id: "pk" }] }]
  stored = [{ _id: "legacy", template_name: "koblip_booking_reminder_v2", language: "en", status: "APPROVED" }]
  const draft = await changeKoblipReminder()
  await refreshKoblipTemplates()
  const text = (await koblipMessages()).find((row) => row.message === "reminder")!.texts.en
  expect(text).toMatchObject({ wording: draft, isDefault: false, review: "draft", approved: null })
  const sendable = await koblipSendableTemplate("reminder", "en")
  expect(sendable.template.header).toBe(draft.header)
  expect(sendable.approved?.template.header).toBe(defaultWording("reminder", "en").header)
  await submitKoblipTemplate("reminder", "en", "u1")
  expect(created[0].template_name).toBe("koblip_booking_reminder_v3")
  expect((await koblipMessages()).find((row) => row.message === "reminder")!.texts.en.approved).toBeNull()
  stored.find((row) => row.template_name === "koblip_booking_reminder_v3")!.status = "APPROVED"
  await refreshKoblipTemplates()
  expect((await koblipMessages()).find((row) => row.message === "reminder")!.texts.en.approved?.wording).toEqual(draft)
})
