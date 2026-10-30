// @vitest-environment node
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  chatConnections,
  chatReplies,
  chatTemplates,
  notificationSends,
  notificationSettings,
  user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"

vi.mock("server-only", () => ({}))

const { runNotifications } = await import("./notification-sender")
const { applyChatEvent } = await import("./chat-events")

let dir: string
let closeDb: () => void

// 10:00 in Santo Domingo (UTC-4).
const NOW = new Date("2026-11-02T14:00:00.000Z")
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

// A stand-in for Chat's API: contacts and sends.
const sent: Record<string, unknown>[] = []
let sendFails = false
let unsubscribed = false
const chat = vi.fn(async (url: string, init: RequestInit = {}) => {
  const answer = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status })
  const path = new URL(url).pathname
  if (path === "/api/contacts/find-or-create") {
    const body = JSON.parse(String(init.body))
    return answer({ success: true, data: { _id: `c-${body.phone_number}`, is_unsubscribed: unsubscribed } })
  }
  if (path === "/api/whatsapp/send") {
    if (sendFails) return answer({ success: false, code: "send_failed" }, 500)
    sent.push(JSON.parse(String(init.body)))
    return answer({ success: true, data: { id: `m${sent.length}` } })
  }
  return answer({ code: "not_found" }, 404)
})

async function book(id: string, values: Partial<typeof bookings.$inferInsert> = {}) {
  await db.insert(bookings).values({
    id,
    businessId: "biz",
    serviceName: "Haircut",
    durationMinutes: 30,
    currency: "DOP",
    // Wednesday 15:00 in Santo Domingo.
    startAt: "2026-11-04T19:00:00.000Z",
    endAt: "2026-11-04T19:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+1 809 555 0101",
    whatsappOptIn: true,
    language: "es",
    createdAt: NOW.toISOString(),
    ...values,
  })
}

async function sends(bookingId: string) {
  const rows = await db.select().from(notificationSends).where(eq(notificationSends.bookingId, bookingId))
  return rows
    .map((row) => [row.message, row.reminderMinutes, row.state, row.reason ?? row.via])
    .sort((a, b) => String(a).localeCompare(String(b)))
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-notification-sender-test-"))
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
  sent.length = 0
  sendFails = false
  unsubscribed = false
  chat.mockClear()
  await db.delete(bookings)
  await db.delete(chatReplies)
  await db.delete(chatTemplates)
  await db.delete(notificationSettings)
  await db.delete(chatConnections)
  await db.insert(chatConnections).values({
    businessId: "biz",
    workspaceId: "w1",
    workspaceName: "Shop",
    scopes: "contacts templates automations conversations",
    accessToken: seal("koa_1"),
    refreshToken: seal("kor_1"),
    accessExpiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    wabaId: "waba1",
    phoneNumberId: "p1",
    createdAt: "2026-01-01T00:00:00.000Z",
  })
  await db.insert(chatTemplates).values(
    (["confirmed", "reminder", "cancelled", "ownerNewBooking"] as const).flatMap((message) =>
      (["en", "es"] as const).map((language) => ({
        businessId: "biz",
        message,
        language,
        chatTemplateId: `t-${message}-${language}`,
        status: "approved",
      }))
    )
  )
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
})

test("a new booking: the confirmation goes now as the template, reminders wait", async () => {
  await book("b1")
  await runNotifications(NOW)

  expect(await sends("b1")).toEqual([
    ["confirmed", 0, "sent", "template"],
    ["ownerNewBooking", 0, "skipped", "noOwnerPhone"],
    ["reminder", 1440, "pending", null],
    ["reminder", 30, "pending", null],
  ])
  expect(sent).toEqual([
    {
      contact_id: "c-18095550101",
      whatsapp_phone_number_id: "p1",
      messageType: "template",
      template_id: "t-confirmed-es",
      templateName: "koblip_book_booking_confirmed",
      languageCode: "es",
      templateVariables: {
        "1": "Ana",
        "2": "Haircut",
        "3": "Shop",
        "4": "miércoles, 4 de noviembre",
        "5": "3:00 p.m.",
      },
    },
  ])

  // Each message goes once, and a reminder when it is due.
  await runNotifications(NOW)
  expect(sent).toHaveLength(1)
  await runNotifications(later(29 * 60))
  expect(sent).toHaveLength(2)
  expect(sent[1].template_id).toBe("t-reminder-es")
})

test("inside the 24-hour window the same words go as plain text", async () => {
  await db.insert(chatReplies).values({
    workspaceId: "w1",
    phoneNumberId: "p1",
    customerPhone: "18095550101",
    lastReplyAt: later(-60).toISOString(),
  })
  await book("b1", { language: "en" })
  await runNotifications(NOW)
  expect(sent[0]).toEqual({
    contact_id: "c-18095550101",
    whatsapp_phone_number_id: "p1",
    messageType: "text",
    messageText:
      "*Booking confirmed*\n\nHi Ana, your Haircut at Shop is booked for Wednesday, November 4 at 3:00 PM. See you then!\n\n_Reply here to talk to us_",
  })
})

test("the owner's alert, and nothing for customers who did not agree", async () => {
  await db.insert(notificationSettings).values({
    businessId: "biz",
    ownerPhone: "+18095550199",
    ownerLanguage: "en",
    reminders: [1440, 120, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
  })
  await book("b1", { whatsappOptIn: false })
  await book("b2", { source: "owner", customerPhone: null, whatsappOptIn: false })
  await runNotifications(NOW)

  expect(await sends("b1")).toEqual([
    ["confirmed", 0, "skipped", "noOptIn"],
    ["ownerNewBooking", 0, "sent", "template"],
  ])
  expect(await sends("b2")).toEqual([["confirmed", 0, "skipped", "noPhone"]])
  expect(sent).toHaveLength(1)
  expect(sent[0]).toMatchObject({
    contact_id: "c-18095550199",
    template_id: "t-ownerNewBooking-en",
    templateVariables: { "1": "Ana", "5": "+1 809 555 0101" },
  })
})

test("a cancelled booking: its reminders stop and the customer is told", async () => {
  await book("b1")
  await runNotifications(NOW)
  await db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, "b1"))
  await runNotifications(later(5))

  expect(await sends("b1")).toEqual([
    ["cancelled", 0, "sent", "template"],
    ["confirmed", 0, "sent", "template"],
    ["ownerNewBooking", 0, "skipped", "noOwnerPhone"],
    ["reminder", 1440, "skipped", "cancelled"],
    ["reminder", 30, "skipped", "cancelled"],
  ])
  expect(sent.map((body) => body.template_id)).toEqual(["t-confirmed-es", "t-cancelled-es"])
})

test("a failed send is never tried again; turned-off and opted-out messages do not go", async () => {
  sendFails = true
  await book("b1")
  await runNotifications(NOW)
  sendFails = false
  await runNotifications(NOW)
  expect(sent).toHaveLength(0)
  expect((await sends("b1"))[0]).toEqual(["confirmed", 0, "failed", "send_failed"])

  await db.insert(notificationSettings).values({
    businessId: "biz",
    reminders: [1440, 120, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: ["reminder"],
  })
  await runNotifications(later(29 * 60))
  expect((await sends("b1"))[2]).toEqual(["reminder", 1440, "skipped", "turnedOff"])

  unsubscribed = true
  await book("b2")
  await runNotifications(NOW)
  expect((await sends("b2"))[0]).toEqual(["confirmed", 0, "skipped", "unsubscribed"])
  expect(sent).toHaveLength(0)
})

test("bookings made before connecting get nothing", async () => {
  await book("b1", { createdAt: "2025-12-31T00:00:00.000Z" })
  await runNotifications(NOW)
  expect(await sends("b1")).toEqual([])
})

test("Chat's delivery status moves a sent message forward only", async () => {
  await book("b1")
  await runNotifications(NOW)
  const delivery = async () =>
    (await db.select().from(notificationSends).where(eq(notificationSends.chatRecordId, "m1")))[0].delivery
  const event = (status: string, workspaceId = "w1") =>
    applyChatEvent({ type: "status", workspaceId, recordId: "m1", status })

  await event("read", "w2")
  expect(await delivery()).toBeNull()
  await event("delivered")
  await event("read")
  await event("delivered")
  expect(await delivery()).toBe("read")
})
