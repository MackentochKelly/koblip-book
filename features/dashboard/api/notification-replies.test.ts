// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { asc, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  chatConnections,
  inAppNotifications,
  koblipChatConnection,
  notificationSends,
  notificationSettings,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

const { applyChatEvent } = await import("./chat-events")

let dir: string
let closeDb: () => void

// The visit is tomorrow; the customer answers today.
const VISIT = "2026-10-31T15:00:00.000Z"
const TODAY = "2026-10-30T12:00:00.000Z"

async function booked(values: Partial<typeof bookings.$inferInsert> = {}) {
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "DOP",
    startAt: VISIT,
    endAt: "2026-10-31T15:30:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550000",
    status: "confirmed",
    whatsappOptIn: true,
    ...values,
  })
}

async function reminderSent(values: Partial<typeof notificationSends.$inferInsert> = {}) {
  await db.insert(notificationSends).values({
    id: "reminder",
    businessId: "biz",
    bookingId: "bk",
    message: "reminder",
    reminderMinutes: 1440,
    dueAt: TODAY,
    state: "sent",
    chatRecordId: "r-reminder",
    ...values,
  })
}

async function settings(values: Partial<typeof notificationSettings.$inferInsert>) {
  await db
    .insert(notificationSettings)
    .values({
      businessId: "biz",
      reminders: [1440],
      quietStart: "21:00",
      quietEnd: "08:00",
      turnedOff: [],
      ...values,
    })
    .onConflictDoUpdate({ target: notificationSettings.businessId, set: values })
}

const status = (extra: Record<string, unknown> = {}) => ({
  type: "status",
  eventId: "s1",
  messageId: "wamid.reminder",
  recordId: "r-reminder",
  workspaceId: "w1",
  status: "delivered",
  occurredAt: TODAY,
  ...extra,
})

const tap = (payload: string, extra: Record<string, unknown> = {}) => ({
  type: "inbound",
  eventId: `tap-${payload}`,
  messageId: "wamid.answer",
  recordId: "r-answer",
  workspaceId: "w1",
  senderId: "p1",
  fromPhone: "18095550000",
  occurredAt: TODAY,
  messageType: "button",
  text: payload,
  replyToMessageId: "wamid.reminder",
  button: { payload, title: payload },
  ...extra,
})

async function sends() {
  return db
    .select({
      message: notificationSends.message,
      state: notificationSends.state,
      reason: notificationSends.reason,
      replyAction: notificationSends.replyAction,
      repliedAt: notificationSends.repliedAt,
    })
    .from(notificationSends)
    .orderBy(asc(notificationSends.message))
}

async function bookingStatus() {
  const [row] = await db.select({ status: bookings.status }).from(bookings)
  return row.status
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-replies-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
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
    workspaceName: "Shop",
    scopes: "contacts templates automations conversations",
  })
  await db.insert(koblipChatConnection).values({
    id: "koblip",
    workspaceId: "w-koblip",
    workspaceName: "Koblip",
    scopes: "contacts templates automations conversations",
  })
})

afterEach(async () => {
  await db.delete(notificationSends)
  await db.delete(bookings)
  await db.delete(notificationSettings)
  await db.delete(inAppNotifications)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a status event keeps WhatsApp's id of the message", async () => {
  await booked()
  await reminderSent()
  await applyChatEvent(status())
  const [row] = await db.select().from(notificationSends)
  expect(row).toMatchObject({ chatMessageId: "wamid.reminder", delivery: "delivered" })
})

test("I'll be there: saved, the thank-you queued, the owner not alerted", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await applyChatEvent(tap("confirm"))
  expect(await bookingStatus()).toBe("confirmed")
  expect(await sends()).toEqual([
    { message: "reminder", state: "sent", reason: null, replyAction: "confirm", repliedAt: TODAY },
    { message: "thankYou", state: "pending", reason: null, replyAction: null, repliedAt: null },
  ])
})

test("Can't make it alerts the owner by default and keeps the booking (D2)", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await settings({ ownerPhone: "+18095559999" })
  await applyChatEvent(tap("cantCome"))
  expect(await bookingStatus()).toBe("confirmed")
  expect((await sends()).map(({ message, state }) => [message, state])).toEqual([
    ["ownerCantCome", "pending"],
    ["reminder", "sent"],
    ["thankYou", "pending"],
  ])
})

test("Can't make it cancels when the owner chose so, and says so", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await settings({ ownerPhone: "+18095559999", cantCome: "cancel", thankYouReply: false })
  await applyChatEvent(tap("cantCome"))
  expect(await bookingStatus()).toBe("cancelled")
  expect((await sends()).map(({ message }) => message)).toEqual(["ownerCancelled", "reminder"])
})

test("without the owner's number the alert is kept as skipped", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await settings({ thankYouReply: false })
  await applyChatEvent(tap("cantCome"))
  expect((await sends())[0]).toMatchObject({
    message: "ownerCantCome",
    state: "skipped",
    reason: "noOwnerPhone",
  })
})

test("a repeated or older tap changes nothing; a newer one replaces it", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await settings({ ownerPhone: "+18095559999" })
  await applyChatEvent(tap("cantCome"))
  await applyChatEvent(tap("cantCome"))
  await applyChatEvent(tap("confirm", { occurredAt: "2026-10-30T11:00:00.000Z" }))
  let rows = await sends()
  expect(rows.filter(({ message }) => message === "ownerCantCome")).toHaveLength(1)
  expect(rows.filter(({ message }) => message === "thankYou")).toHaveLength(1)
  expect(rows.find(({ message }) => message === "reminder")?.replyAction).toBe("cantCome")

  await applyChatEvent(tap("confirm", { occurredAt: "2026-10-30T13:00:00.000Z" }))
  rows = await sends()
  expect(rows.find(({ message }) => message === "reminder")?.replyAction).toBe("confirm")
  expect(rows).toHaveLength(3)
})

test("an answer to a message from before a move is kept but changes nothing", async () => {
  await booked({ moves: 1 })
  await reminderSent({ chatMessageId: "wamid.reminder", moves: 0 })
  await settings({ cantCome: "cancel" })
  await applyChatEvent(tap("cantCome"))
  expect(await bookingStatus()).toBe("confirmed")
  expect(await sends()).toEqual([
    { message: "reminder", state: "sent", reason: null, replyAction: "cantCome", repliedAt: TODAY },
  ])
})

test("a tap through another workspace, or with no button, is not a reply", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await applyChatEvent(tap("confirm", { workspaceId: "w-other" }))
  await applyChatEvent(tap("confirm", { button: null }))
  await applyChatEvent(tap("delete everything"))
  expect(await sends()).toEqual([
    { message: "reminder", state: "sent", reason: null, replyAction: null, repliedAt: null },
  ])
})

test("works for a message sent from Koblip's number", async () => {
  await booked()
  await reminderSent({ sender: "koblip", chatRecordId: "r-k" })
  await applyChatEvent(status({ workspaceId: "w-koblip", recordId: "r-k", messageId: "wamid.k" }))
  await applyChatEvent(tap("confirm", { workspaceId: "w-koblip", replyToMessageId: "wamid.k" }))
  const [row] = await db
    .select()
    .from(notificationSends)
    .where(eq(notificationSends.id, "reminder"))
  expect(row).toMatchObject({ chatMessageId: "wamid.k", replyAction: "confirm", delivery: "delivered" })
  // Koblip's number answers through Koblip's workspace, not the business's.
  await applyChatEvent(tap("cantCome", { replyToMessageId: "wamid.k", occurredAt: "2026-10-30T13:00:00.000Z" }))
  expect((await sends()).find(({ message }) => message === "reminder")?.replyAction).toBe("confirm")
})

async function bell() {
  return db
    .select({ kind: inAppNotifications.kind, data: inAppNotifications.data, readAt: inAppNotifications.readAt })
    .from(inAppNotifications)
}

test("the owner's bell hears each answer once per booking and move (N2)", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await applyChatEvent(tap("confirm"))
  await applyChatEvent(tap("confirm"))
  expect(await bell()).toEqual([
    {
      kind: "customerConfirmed",
      data: { customerName: "Ana", serviceName: "Cut", startAt: VISIT },
      readAt: null,
    },
  ])

  await applyChatEvent(tap("cantCome", { occurredAt: "2026-10-30T13:00:00.000Z" }))
  expect((await bell()).map(({ kind }) => kind)).toEqual(["customerConfirmed", "customerCantCome"])
})

test("a Can't make it that cancels tells the bell it was cancelled (N2)", async () => {
  await booked()
  await reminderSent({ chatMessageId: "wamid.reminder" })
  await settings({ cantCome: "cancel", thankYouReply: false })
  await applyChatEvent(tap("cantCome"))
  expect((await bell()).map(({ kind }) => kind)).toEqual(["customerCancelled"])
})

test("a customer who writes is one notification that comes back unread (N2)", async () => {
  await booked({ customerKey: "p:18095550000" })
  await db.update(chatConnections).set({ phoneNumberId: "p1" })
  const wrote = (eventId: string, occurredAt: string) =>
    applyChatEvent(tap("hello", { eventId, messageType: "text", button: null, text: "Hola", occurredAt }))
  try {
    await wrote("w-1", TODAY)
    await db.update(inAppNotifications).set({ readAt: TODAY })
    await wrote("w-2", "2026-10-30T13:00:00.000Z")
    expect(await bell()).toEqual([
      {
        kind: "customerReplied",
        data: { customerName: "Ana", customerPhone: "18095550000" },
        readAt: null,
      },
    ])
  } finally {
    await db.update(chatConnections).set({ phoneNumberId: null })
  }
})

test("on Koblip's number the reply goes to the business that last wrote to them (N2)", async () => {
  await booked({ customerKey: "p:18095550000" })
  await reminderSent({ sender: "koblip", chatRecordId: "r-k", sentAt: TODAY })
  await applyChatEvent(
    tap("hello", { eventId: "w-k", workspaceId: "w-koblip", messageType: "text", button: null, text: "Hola" })
  )
  expect((await bell()).map(({ kind }) => kind)).toEqual(["customerReplied"])
})
