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
  businesses,
  chatConnections,
  chatReplies,
  chatTemplates,
  notificationSends,
  notificationSettings,
  notificationTexts,
  user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"
import { defaultWording } from "../utils/booking-templates"

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
  await db.delete(notificationTexts)
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
    (["confirmed", "reminder", "changed", "cancelled", "ownerNewBooking"] as const).flatMap((message) =>
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

test("a kind of message the sender does not know yet waits as pending", async () => {
  await book("b1")
  await db.insert(notificationSends).values({
    businessId: "biz",
    bookingId: "b1",
    message: "thankYou" as never,
    dueAt: NOW.toISOString(),
    state: "pending",
  })
  await runNotifications(NOW)
  const [row] = await db
    .select()
    .from(notificationSends)
    .where(eq(notificationSends.message, "thankYou" as never))
  expect(row.state).toBe("pending")
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
