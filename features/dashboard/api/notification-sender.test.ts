// @vitest-environment node
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq, inArray } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businessSettings,
  businesses,
  chatConnections,
  chatReplies,
  chatTemplates,
  inAppNotifications,
  koblipChatConnection,
  koblipChatTemplates,
  notificationSends,
  notificationSettings,
  notificationTexts,
  user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"
import { BOOKING_MESSAGES, defaultWording } from "../utils/booking-templates"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: "u1", name: "Owner", email: "owner@example.com" })),
}))

const { runNotifications } = await import("./notification-sender")
const { applyChatEvent } = await import("./chat-events")
const { sendAgain, sendTestToMyPhone } = await import("./notification-actions")

let dir: string
let closeDb: () => void

// 10:00 in Santo Domingo (UTC-4).
const NOW = new Date("2026-11-02T14:00:00.000Z")
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000)

// A stand-in for Chat's API: contacts and sends, and whose token each send
// used (koa_1: the business's workspace, koa_k: Koblip's).
const sent: Record<string, unknown>[] = []
const sentWith: string[] = []
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
    sentWith.push(String(new Headers(init.headers).get("authorization")))
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
  sentWith.length = 0
  sendFails = false
  unsubscribed = false
  chat.mockClear()
  await db.delete(bookings)
  await db.delete(chatReplies)
  await db.delete(chatTemplates)
  await db.delete(notificationSettings)
  await db.delete(notificationTexts)
  await db.delete(chatConnections)
  await db.delete(koblipChatConnection)
  await db.delete(businessSettings)
  await db.delete(koblipChatTemplates)
  await db.delete(inAppNotifications)
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
    BOOKING_MESSAGES.flatMap((message) =>
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
      templateName: "koblip_book_booking_confirmed_v2",
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
      "*Booking confirmed*\n\nHi Ana, your Haircut at Shop is booked for Wednesday, November 4 at 3:00 PM. We look forward to seeing you then!\n\n_Reply here to talk to us_",
  })
})

// A booking in an hour, so its 30-minute reminder is due soon, from a
// customer who wrote an hour ago.
async function soonInWindow() {
  await db.insert(chatReplies).values({
    workspaceId: "w1",
    phoneNumberId: "p1",
    customerPhone: "18095550101",
    lastReplyAt: later(-60).toISOString(),
  })
  await book("b1", { language: "en", startAt: later(60).toISOString(), endAt: later(90).toISOString() })
  await runNotifications(NOW)
  await runNotifications(later(31))
  return sent.find((body) => body !== sent[0])
}

test("inside the 24-hour window a reminder goes as a normal message with its buttons", async () => {
  expect(await soonInWindow()).toEqual({
    contact_id: "c-18095550101",
    whatsapp_phone_number_id: "p1",
    messageType: "interactive",
    interactiveType: "button",
    messageText: "Hi Ana, a reminder of your Haircut at Shop on Monday, November 2 at 11:00 AM. See you soon!",
    buttonParams: [
      { id: "confirm", title: "I'll be there" },
      { id: "cantCome", title: "Can't make it" },
    ],
    buttonHeader: "Appointment reminder",
    buttonFooter: "Reply here to talk to us",
  })
})

test("the thank-you goes as a normal message while the window is open, never as a template", async () => {
  await db.insert(chatReplies).values({
    workspaceId: "w1",
    phoneNumberId: "p1",
    customerPhone: "18095550101",
    lastReplyAt: later(-5).toISOString(),
  })
  await book("b1")
  await book("b2", { customerPhone: "+1 809 555 0102" })
  await db.insert(notificationSends).values(
    ["b1", "b2"].map((bookingId) => ({
      businessId: "biz",
      bookingId,
      message: "thankYou" as const,
      dueAt: NOW.toISOString(),
      state: "pending" as const,
    }))
  )
  await runNotifications(NOW)

  expect((await sends("b1")).find(([message]) => message === "thankYou")).toEqual([
    "thankYou",
    0,
    "sent",
    "text",
  ])
  expect(sent).toContainEqual({
    contact_id: "c-18095550101",
    whatsapp_phone_number_id: "p1",
    messageType: "text",
    messageText: "¡Gracias, Ana! Shop recibió tu respuesta.",
  })
  expect((await sends("b2")).find(([message]) => message === "thankYou")).toEqual([
    "thankYou",
    0,
    "skipped",
    "windowClosed",
  ])
})

test("the owner hears that a customer can't come or cancelled, even once it is cancelled", async () => {
  await db.insert(notificationSettings).values({
    businessId: "biz",
    ownerPhone: "+18095550199",
    ownerLanguage: "en",
    reminders: [],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
  })
  await book("b1", { source: "owner" })
  await book("b2", { source: "owner", status: "cancelled" })
  await db.insert(notificationSends).values([
    { businessId: "biz", bookingId: "b1", message: "ownerCantCome", dueAt: NOW.toISOString(), state: "pending" },
    { businessId: "biz", bookingId: "b2", message: "ownerCancelled", dueAt: NOW.toISOString(), state: "pending" },
    { businessId: "biz", bookingId: "b2", message: "thankYou", dueAt: NOW.toISOString(), state: "pending" },
  ])
  await runNotifications(NOW)

  const toOwner = sent.filter(({ contact_id }) => contact_id === "c-18095550199")
  expect(toOwner.map((body) => body.template_id).sort()).toEqual([
    "t-ownerCancelled-en",
    "t-ownerCantCome-en",
  ])
  expect(toOwner[0]).toMatchObject({
    templateName: expect.stringMatching(/^koblip_book_owner_/),
    templateVariables: { "1": "Ana", "2": "Haircut", "5": "+1 809 555 0101" },
  })
  // The cancellation does not stop the thank-you; only the closed window does.
  expect((await sends("b2")).find(([message]) => message === "thankYou")).toEqual([
    "thankYou",
    0,
    "skipped",
    "windowClosed",
  ])
})

test("a message to the customer that fails tells the owner, once per booking", async () => {
  await db.insert(notificationSettings).values({
    businessId: "biz",
    ownerPhone: "+18095550199",
    ownerLanguage: "es",
    reminders: [1440],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
  })
  sendFails = true
  await book("b1")
  await runNotifications(NOW)
  sendFails = false
  await runNotifications(later(1))

  // The failed owner's alert tells nobody; the customer's confirmation does.
  expect(sent.map((body) => body.template_id)).toEqual(["t-ownerFailed-es"])
  expect(sent[0]).toMatchObject({
    contact_id: "c-18095550199",
    templateVariables: { "1": "Ana", "2": "Haircut", "5": "+1 809 555 0101" },
  })

  // The reminder fails too: the owner already knows of this booking.
  sendFails = true
  await runNotifications(later(29 * 60))
  sendFails = false
  await runNotifications(later(29 * 60 + 1))
  expect((await sends("b1")).find(([message]) => message === "reminder")).toEqual([
    "reminder",
    1440,
    "failed",
    "send_failed",
  ])
  const alerts = (await sends("b1")).filter(([message]) => message === "ownerFailed")
  expect(alerts).toEqual([["ownerFailed", 0, "sent", "template"]])
  // The owner's bell, once per booking too (N2).
  expect(await bell()).toEqual([
    ["messageFailed", { customerName: "Ana", serviceName: "Haircut", startAt: expect.any(String) }],
  ])
})

test("with the 24-hour setting off, the template goes even inside the window", async () => {
  await db.insert(notificationSettings).values({
    businessId: "biz",
    reminders: [1440, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
    freeTextInWindow: false,
  })
  expect(await soonInWindow()).toMatchObject({ messageType: "template", template_id: "t-reminder-en" })
})

test("buttons too long for a normal message: the approved template carries them", async () => {
  await db.insert(notificationTexts).values({
    businessId: "biz",
    message: "reminder",
    language: "en",
    ...defaultWording("reminder", "en"),
    buttons: [{ action: "confirm", label: "Yes, I will be there!" }],
  })
  expect(await soonInWindow()).toMatchObject({ messageType: "template", template_id: "t-reminder-en" })
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

// What the owner's "Move booking" does (features/booking/api/move-owner-booking.ts).
async function move(id: string, startAt: string) {
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  await db
    .update(bookings)
    .set({ startAt, endAt: new Date(Date.parse(startAt) + 30 * 60_000).toISOString(), moves: row.moves + 1 })
    .where(eq(bookings.id, id))
  const waiting = and(eq(notificationSends.bookingId, id), eq(notificationSends.state, "pending"))
  await db
    .update(notificationSends)
    .set({ state: "skipped", reason: "moved" })
    .where(and(waiting, inArray(notificationSends.message, ["reminder", "changed"])))
  // A confirmation still waiting goes with the new time.
  await db
    .update(notificationSends)
    .set({ moves: row.moves + 1 })
    .where(and(waiting, eq(notificationSends.message, "confirmed")))
}

async function sendsByMove(bookingId: string) {
  const rows = await db.select().from(notificationSends).where(eq(notificationSends.bookingId, bookingId))
  return rows
    .filter((row) => row.message === "changed" || row.message === "reminder")
    .map((row) => [row.moves, row.message, row.reminderMinutes, row.state, row.reason ?? row.via])
    .sort((a, b) => String(a).localeCompare(String(b)))
}

test("a moved booking: the customer is told the new time and reminders follow it", async () => {
  await book("b1")
  await runNotifications(NOW)
  // Thursday 15:00 in Santo Domingo.
  await move("b1", "2026-11-05T19:00:00.000Z")
  await runNotifications(later(5))
  await runNotifications(later(6))

  expect(await sendsByMove("b1")).toEqual([
    [0, "reminder", 1440, "skipped", "moved"],
    [0, "reminder", 30, "skipped", "moved"],
    [1, "changed", 0, "sent", "template"],
    [1, "reminder", 1440, "pending", null],
    [1, "reminder", 30, "pending", null],
  ])
  expect(sent.map((body) => body.template_id)).toEqual(["t-confirmed-es", "t-changed-es"])
  const reminder = (await db.select().from(notificationSends)).find(
    (row) => row.moves === 1 && row.reminderMinutes === 1440
  )
  expect(reminder?.dueAt).toBe("2026-11-04T19:00:00.000Z")
})

test("moved there and back again: each move tells the customer once", async () => {
  await book("b1")
  await runNotifications(NOW)
  await move("b1", "2026-11-05T19:00:00.000Z")
  await runNotifications(later(5))
  await move("b1", "2026-11-04T19:00:00.000Z")
  await runNotifications(later(10))
  await runNotifications(later(11))

  expect(sent.map((body) => body.template_id)).toEqual(["t-confirmed-es", "t-changed-es", "t-changed-es"])
  const changed = (await sendsByMove("b1")).filter(([, message]) => message === "changed")
  expect(changed).toEqual([
    [1, "changed", 0, "sent", "template"],
    [2, "changed", 0, "sent", "template"],
  ])
})

test("moved before the customer heard of it: no change message, the reminders still follow", async () => {
  sendFails = true
  await book("b1")
  await runNotifications(NOW)
  sendFails = false
  await move("b1", "2026-11-05T19:00:00.000Z")
  await runNotifications(later(5))

  const rows = await sendsByMove("b1")
  expect(rows).toContainEqual([1, "changed", 0, "skipped", "notTold"])
  expect(rows.filter(([moves, message, , state]) => moves === 1 && message === "reminder" && state === "pending")).not.toHaveLength(0)
  expect(sent.filter((body) => body.template_id === "t-changed-es")).toHaveLength(0)
})

test("moved while the confirmation was still waiting: it goes with the new time, no change message", async () => {
  await book("b1")
  await move("b1", "2026-11-05T19:00:00.000Z")
  await runNotifications(NOW)
  await runNotifications(later(1))

  expect(sent.map((body) => body.template_id)).toEqual(["t-confirmed-es"])
  expect(await sendsByMove("b1")).toContainEqual([1, "changed", 0, "skipped", "notTold"])
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
  expect((await sends("b1")).find(([message]) => message === "reminder")).toEqual([
    "reminder",
    1440,
    "skipped",
    "turnedOff",
  ])

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

test("a test message goes to the owner's phone with sample values, and says why not", async () => {
  expect(await sendTestToMyPhone("biz", "confirmed")).toEqual({ ok: false, error: "noOwnerPhone" })
  await db.insert(notificationSettings).values({
    businessId: "biz",
    ownerPhone: "+1 809 555 0199",
    ownerLanguage: "es",
    reminders: [1440, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
  })
  expect(await sendTestToMyPhone("biz", "confirmed")).toEqual({ ok: true })
  expect(sent).toEqual([
    expect.objectContaining({
      contact_id: "c-18095550199",
      messageType: "template",
      template_id: "t-confirmed-es",
      templateVariables: expect.objectContaining({ 1: "Ana", 3: "Shop" }),
    }),
  ])
  expect(await db.select().from(notificationSends)).toEqual([])
})

test("send again: a failed message goes once more, and only a failed one", async () => {
  sendFails = true
  await book("b1")
  await runNotifications(NOW)
  sendFails = false
  const [failed] = await db
    .select()
    .from(notificationSends)
    .where(and(eq(notificationSends.bookingId, "b1"), eq(notificationSends.message, "confirmed")))
  expect(failed.state).toBe("failed")

  expect(await sendAgain("biz", failed.id)).toEqual({ ok: true })
  await runNotifications(later(1))
  expect((await sends("b1")).find(([message]) => message === "confirmed")).toEqual([
    "confirmed",
    0,
    "sent",
    "template",
  ])
  expect(await sendAgain("biz", failed.id)).toEqual({ ok: false, error: "notFailed" })
  expect(await sendAgain("other", failed.id)).toEqual({ ok: false, error: "not_found" })
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
    wabaId: "wabak",
    phoneNumberId: "pk",
    createdAt: "2026-02-01T00:00:00.000Z",
  })
  await db.insert(koblipChatTemplates).values(
    (["confirmed", "reminder", "changed", "cancelled", "ownerNewBooking"] as const).flatMap((message) =>
      (["en", "es"] as const).map((language) => ({
        message,
        language,
        chatTemplateId: `k-${message}-${language}`,
        status: "approved",
      }))
    )
  )
}

async function senders(bookingId: string) {
  const rows = await db.select().from(notificationSends).where(eq(notificationSends.bookingId, bookingId))
  return rows.filter((row) => row.state === "sent").map((row) => row.sender)
}

test("the business's own number sends once Meta approved all its messages", async () => {
  await connectKoblip()
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_1"])
  expect(sent[0]).toEqual(expect.objectContaining({ whatsapp_phone_number_id: "p1", template_id: "t-confirmed-es" }))
  expect(await senders("b1")).toEqual(["own"])
})

test("not all approved yet: Koblip's number sends Koblip's own template", async () => {
  await connectKoblip()
  await db
    .update(chatTemplates)
    .set({ status: "pending" })
    .where(and(eq(chatTemplates.message, "reminder"), eq(chatTemplates.language, "en")))
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_k"])
  expect(sent[0]).toEqual(
    expect.objectContaining({
      whatsapp_phone_number_id: "pk",
      template_id: "k-confirmed-es",
      templateName: "koblip_booking_confirmed_v2",
      templateVariables: expect.objectContaining({ 3: "Shop" }),
    })
  )
  expect(await senders("b1")).toEqual(["koblip"])

  // A message the owner turned off does not need approving.
  await db.insert(notificationSettings).values({
    businessId: "biz",
    reminders: [1440, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: ["reminder"],
  })
  await book("b2")
  await runNotifications(NOW)
  expect(sentWith.at(-1)).toBe("Bearer koa_1")
})

test("with no connection of its own, a business sends from Koblip's number", async () => {
  await db.delete(chatConnections)
  await book("b1")
  await runNotifications(NOW)
  expect(await sends("b1")).toEqual([])

  await connectKoblip()
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_k"])
  expect(await senders("b1")).toEqual(["koblip"])
  // Bookings made before Koblip's number could send get nothing.
  await book("b0", { createdAt: "2026-01-15T00:00:00.000Z" })
  await runNotifications(NOW)
  expect(await sends("b0")).toEqual([])
})

test("Koblip's number stops a business's templates at its monthly limit; normal messages still go", async () => {
  const { koblipTemplatesSent } = await import("@/lib/koblip-usage")
  await db.delete(chatConnections)
  await connectKoblip()
  await db.insert(businessSettings).values({ businessId: "biz", key: "koblipMonthlyTemplates", value: 1 })
  // One template already went this month; one last month does not count.
  await book("b0", { createdAt: "2025-12-01T00:00:00.000Z" })
  const went = (sentAt: string, reminderMinutes: number) => ({
    businessId: "biz",
    bookingId: "b0",
    message: "reminder" as const,
    reminderMinutes,
    dueAt: sentAt,
    state: "sent" as const,
    via: "template" as const,
    sender: "koblip" as const,
    sentAt,
  })
  await db.insert(notificationSends).values([went(later(-60).toISOString(), 1440), went("2026-10-31T23:00:00.000Z", 30)])
  expect(await koblipTemplatesSent("biz", NOW)).toBe(1)

  await book("b1")
  await runNotifications(NOW)
  expect((await sends("b1"))[0]).toEqual(["confirmed", 0, "skipped", "monthlyLimit"])
  expect(sent).toEqual([])
  // The owner's bell hears it once this month (N2).
  await runNotifications(later(1))
  expect(await bell()).toEqual([["koblipLimitReached", { sent: 1, limit: 1 }]])

  // Inside the customer's window the words go as a normal message, free.
  await db.insert(chatReplies).values({
    workspaceId: "wk",
    phoneNumberId: "pk",
    customerPhone: "18095550102",
    lastReplyAt: later(-5).toISOString(),
  })
  await book("b2", { customerPhone: "+1 809 555 0102" })
  await runNotifications(NOW)
  expect(sent).toEqual([expect.objectContaining({ whatsapp_phone_number_id: "pk", messageType: "text" })])

  // The admin raises this business's limit: templates go again.
  await db.update(businessSettings).set({ value: 5 })
  await book("b3")
  await runNotifications(NOW)
  expect(sent.at(-1)).toEqual(expect.objectContaining({ messageType: "template", template_id: "k-confirmed-es" }))
})

test("inside the window of Koblip's number, a normal message goes from it", async () => {
  await db.delete(chatConnections)
  await connectKoblip()
  await db.insert(chatReplies).values({
    workspaceId: "wk",
    phoneNumberId: "pk",
    customerPhone: "18095550101",
    lastReplyAt: later(-60).toISOString(),
  })
  await book("b1")
  await runNotifications(NOW)
  expect(sent[0]).toEqual(expect.objectContaining({ whatsapp_phone_number_id: "pk", messageType: "text" }))
})

test("Koblip's number never sends for a business without an owner or a demo", async () => {
  await db.delete(chatConnections)
  await connectKoblip()
  await db.update(businesses).set({ ownerId: null }).where(eq(businesses.id, "biz"))
  await book("b1")
  await runNotifications(NOW)
  await db.update(businesses).set({ ownerId: "u1", isDemo: true }).where(eq(businesses.id, "biz"))
  await runNotifications(NOW)
  await db.update(businesses).set({ isDemo: false }).where(eq(businesses.id, "biz"))
  expect(await sends("b1")).toEqual([])
  expect(sent).toEqual([])
})

// The business's own number connected, one of its messages still waiting
// for Meta, and Koblip's number ready (D35).
async function ownNotApprovedYet() {
  await connectKoblip()
  await db
    .update(chatTemplates)
    .set({ status: "pending" })
    .where(and(eq(chatTemplates.message, "reminder"), eq(chatTemplates.language, "en")))
}

async function wroteTo(workspaceId: string, phoneNumberId: string) {
  await db.insert(chatReplies).values({
    workspaceId,
    phoneNumberId,
    customerPhone: "18095550101",
    lastReplyAt: later(-60).toISOString(),
  })
}

test("the customer wrote to the business's own number: a normal message goes from it before approval", async () => {
  await ownNotApprovedYet()
  await wroteTo("w1", "p1")
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_1"])
  expect(sent[0]).toEqual(expect.objectContaining({ whatsapp_phone_number_id: "p1", messageType: "text" }))
  expect(await senders("b1")).toEqual(["own"])
})

test("the customer wrote only to Koblip's number: Koblip's number still sends", async () => {
  await ownNotApprovedYet()
  await wroteTo("wk", "pk")
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_k"])
  expect(sent[0]).toEqual(expect.objectContaining({ whatsapp_phone_number_id: "pk", messageType: "text" }))
  expect(await senders("b1")).toEqual(["koblip"])
})

test("with the 24-hour setting off, an open window on the own number does not make it send", async () => {
  await ownNotApprovedYet()
  await wroteTo("w1", "p1")
  await db.insert(notificationSettings).values({
    businessId: "biz",
    reminders: [1440, 30],
    quietStart: "21:00",
    quietEnd: "08:00",
    turnedOff: [],
    freeTextInWindow: false,
  })
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_k"])
  expect(sent[0]).toEqual(expect.objectContaining({ messageType: "template", template_id: "k-confirmed-es" }))
  expect(await senders("b1")).toEqual(["koblip"])
})

test("the window on the own number closed: Koblip's number sends the template", async () => {
  await ownNotApprovedYet()
  await db.insert(chatReplies).values({
    workspaceId: "w1",
    phoneNumberId: "p1",
    customerPhone: "18095550101",
    lastReplyAt: later(-25 * 60).toISOString(),
  })
  await book("b1")
  await runNotifications(NOW)
  expect(sentWith).toEqual(["Bearer koa_k"])
  expect(sent[0]).toEqual(expect.objectContaining({ messageType: "template" }))
})

test("the owner's bell hears once a month when Koblip's limit is near (N2)", async () => {
  await db.delete(chatConnections)
  await connectKoblip()
  await db.insert(businessSettings).values({ businessId: "biz", key: "koblipMonthlyTemplates", value: 5 })
  await book("b0")
  await db.insert(notificationSends).values(
    [1440, 60, 30].map((reminderMinutes) => ({
      businessId: "biz",
      bookingId: "b0",
      message: "reminder" as const,
      reminderMinutes,
      dueAt: later(-60).toISOString(),
      state: "sent" as const,
      via: "template" as const,
      sender: "koblip" as const,
      sentAt: later(-60).toISOString(),
    }))
  )
  // The fourth of five is 80%: near.
  await book("b1")
  await runNotifications(NOW)
  await book("b2")
  await runNotifications(later(1))
  expect(await bell()).toEqual([["koblipLimitNear", { sent: 4, limit: 5 }]])
})

async function bell() {
  return (await db.select().from(inAppNotifications)).map(({ kind, data }) => [kind, data])
}
