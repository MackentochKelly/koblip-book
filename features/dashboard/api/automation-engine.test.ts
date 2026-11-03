// @vitest-environment node
import { randomBytes } from "node:crypto"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  automationEvents, automationPauses, automationRuns, automations, businesses,
  bookings, chatConnections, chatReplies, inAppNotifications, koblipChatConnection, notificationSends,
  platformSettings, services, user,
} from "@/lib/db/schema"
import { seal } from "@/lib/secret-box"
import { welcomeDefaults } from "../utils/automation-defaults"

vi.mock("server-only", () => ({}))
const { runAutomations } = await import("./automation-engine")
const { applyChatEvent } = await import("./chat-events")
const { post } = await import("./notification-sender")
const { chatApi } = await import("./chat-oauth")
const { bookSendReceipt } = await import("./automation-state")
const NOW = "2026-11-02T14:00:00.000Z"
const PHONE = "18095550101"
const sent: Record<string, unknown>[] = []
let sendFails = false
let contactFails = false
let unsubscribed = false
let dir: string
let sendGate: Promise<void> | null = null
let sendEntered: (() => void) | null = null
const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
const chat = vi.fn(async (url: string, init: RequestInit = {}) => {
  const answer = (json: unknown, status = 200) => new Response(JSON.stringify(json), { status })
  const path = new URL(url).pathname
  if (path === "/api/contacts/find-or-create") {
    if (contactFails) return answer({ success: false, code: "contact_failed" }, 500)
    // As Chat does: no name or a real one, never an empty one.
    if (JSON.parse(String(init.body)).name === "") return answer({ success: false, code: "invalid" }, 400)
    return answer({ success: true, data: { _id: "contact", is_unsubscribed: unsubscribed } })
  }
  if (path === "/api/whatsapp/send") {
    if (sendFails) return answer({ success: false, code: "send_failed", message: "Private message or phone must not be logged" }, 500)
    sendEntered?.()
    if (sendGate) await sendGate
    sent.push(JSON.parse(String(init.body)))
    return answer({ success: true, data: { id: `record-${sent.length}` } })
  }
  return answer({ success: false, code: "not_found" }, 404)
})

function inbound(eventId = "event-first", extra: Record<string, unknown> = {}) {
  return { type: "inbound", eventId, workspaceId: "own", senderId: "number", fromPhone: PHONE,
    occurredAt: NOW, messageType: "text", text: "Hello", recordId: `inbound-${eventId}`, ...extra }
}
function tap(payload: string, eventId: string, replyToMessageId = "provider-1") {
  return inbound(eventId, { messageType: "button", button: { payload, title: "Chosen" }, replyToMessageId })
}
function outbound(recordId = "manual", extra: Record<string, unknown> = {}) {
  return { type: "outbound", eventId: `outbound-${recordId}`, workspaceId: "own", toPhone: PHONE,
    occurredAt: NOW, recordId, messageId: `message-${recordId}`, messageType: "text", ...extra }
}
async function rows() { return db.select().from(automationRuns) }
async function welcome() {
  await runAutomations(inbound(), null)
  expect(sent).toHaveLength(1)
  await db.update(automationRuns).set({ chatMessageId: "provider-1" })
    .where(eq(automationRuns.chatRecordId, "record-1"))
}
async function connected() {
  await db.insert(chatConnections).values({ businessId: "biz", workspaceId: "own", workspaceName: "Own",
    scopes: "contacts templates conversations automations", accessToken: seal("access"), refreshToken: seal("refresh"),
    accessExpiresAt: "2099-01-01T00:00:00.000Z", phoneNumberId: "number", wabaId: "waba" })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "book-automation-engine-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"))
  vi.stubEnv("CHAT_OAUTH_CLIENT_ID", "book")
  vi.stubEnv("CHAT_OAUTH_CLIENT_SECRET", "secret")
  vi.stubEnv("CHAT_OAUTH_REDIRECT_URI", "http://localhost:3100/api/chat/callback")
  vi.stubEnv("CHAT_CONNECT_URL", "https://chat.example.test/connect/book")
  vi.stubEnv("CHAT_API_URL", "https://api.example.test")
  vi.stubEnv("BETTER_AUTH_URL", "https://book.example.test")
  vi.stubGlobal("fetch", chat)
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.$client.execute("PRAGMA foreign_keys = ON")
  await db.insert(user).values({ id: "owner", name: "Owner", email: "engine-owner@example.test", emailVerified: true })
})
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  await db.delete(businesses)
  await db.delete(chatReplies)
  await db.delete(koblipChatConnection)
  await db.delete(platformSettings)
  await db.insert(businesses).values([
    { id: "biz", slug: "shop", name: "Shop", timezone: "America/New_York", currency: "USD", ownerId: "owner" },
    { id: "other", slug: "other", name: "Other", timezone: "America/New_York", currency: "USD", ownerId: "owner" },
  ])
  await connected()
  await db.insert(automations).values({ id: "welcome", businessId: "biz", key: "welcome", trigger: "firstMessage", on: true, ...welcomeDefaults() })
  sent.length = 0
  sendFails = false
  sendGate = null
  sendEntered = null
  contactFails = false
  unsubscribed = false
  chat.mockClear()
  errorLog.mockClear()
})
afterAll(() => {
  vi.useRealTimers()
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  errorLog.mockRestore()
})

test("Welcome sends all stored choices through the own number and persists an event claim and sent run", async () => {
  await welcome()
  expect(sent[0]).toMatchObject({ whatsapp_phone_number_id: "number", messageType: "interactive", interactiveType: "button",
    messageText: "Thanks for writing to Shop! Choose an option to get help faster.",
    buttonParams: [{ id: "welcome-booking", title: "Book now" }, { id: "welcome-services", title: "Our services" }, { id: "welcome-handoff", title: "Talk to us" }],
  })
  expect(await rows()).toEqual([expect.objectContaining({ businessId: "biz", automationId: "welcome", customerPhone: PHONE, language: "en", step: "welcome", state: "sent", chatRecordId: "record-1" })])
  expect(await db.select().from(automationEvents)).toEqual(expect.arrayContaining([
    expect.objectContaining({ businessId: "biz", workspaceId: "own", eventId: "event-first" }),
    expect.objectContaining({ businessId: "biz", workspaceId: "own", eventId: bookSendReceipt("record-1") }),
  ]))
  expect(chat.mock.calls.every(([, init]) => new Headers(init?.headers).get("authorization") === "Bearer access")).toBe(true)
})

test("repeated and concurrent copies of one event send Welcome once", async () => {
  await Promise.all(Array.from({ length: 5 }, () => runAutomations(inbound(), null)))
  await runAutomations(inbound(), null)
  expect(sent).toHaveLength(1)
  expect((await db.select().from(automationEvents)).filter((row) => row.eventId === "event-first")).toHaveLength(1)
  expect((await rows()).filter((row) => row.state === "sent")).toHaveLength(1)
})

test("a later message inside the welcome interval stays quiet; an older previous message allows a new Welcome", async () => {
  await welcome()
  await runAutomations(inbound("recent"), "2026-11-01T14:00:00.000Z")
  expect(sent).toHaveLength(1)
  vi.setSystemTime("2026-12-03T14:00:00.000Z")
  await runAutomations(inbound("returning", { occurredAt: "2026-12-03T14:00:00.000Z" }), NOW)
  expect(sent).toHaveLength(2)
})

test("the stored welcomeAgainDays rule determines returning-customer eligibility", async () => {
  await db.insert(platformSettings).values({ key: "automation.welcomeAgainDays", value: 2 })
  await runAutomations(inbound(), "2026-10-30T14:00:00.000Z")
  expect(sent).toHaveLength(1)
})

test("disabled automation makes no send", async () => {
  await db.update(automations).set({ on: false }).where(eq(automations.id, "welcome"))
  await runAutomations(inbound(), null)
  expect(sent).toEqual([])
})

test.each([
  { workspaceId: "unconnected" }, { senderId: "other-number" },
])("unconnected source %j never sends", async (extra) => {
  await runAutomations(inbound("wrong-source", extra), null)
  expect(sent).toEqual([])
  expect(await rows()).toEqual([])
})

test.each([
  { needsReconnect: true }, { phoneNumberId: null }, { accessToken: null }, { refreshToken: null },
  { scopes: "contacts templates automations" }, { scopes: "contacts conversations automations" },
])("an unusable own connection %j never sends", async (values) => {
  await db.update(chatConnections).set(values).where(eq(chatConnections.businessId, "biz"))
  await runAutomations(inbound(), null)
  expect(sent).toEqual([])
})

test("the shared Koblip number cannot trigger a business automation", async () => {
  await db.delete(chatConnections)
  await db.insert(koblipChatConnection).values({ id: "koblip", workspaceId: "own", workspaceName: "Shared", scopes: "templates contacts conversations automations", accessToken: seal("shared-access"), refreshToken: seal("shared-refresh"), phoneNumberId: "number" })
  await runAutomations(inbound(), null)
  expect(sent).toEqual([])
  expect(await rows()).toEqual([])
})

test("booking choice sends a CTA to this business's public booking page", async () => {
  await welcome()
  await runAutomations(tap("welcome-booking", "book"), NOW)
  expect(sent).toHaveLength(2)
  expect(sent[1]).toMatchObject({ messageType: "interactive", interactiveType: "cta_url" })
  expect(JSON.stringify(sent[1])).toContain("shop")
  expect((await rows()).find((row) => row.step === "bookingLink")).toMatchObject({ state: "sent", automationId: "welcome" })
})

test("services choice lists at most ten own services and a service tap sends its booking CTA", async () => {
  await db.insert(services).values(Array.from({ length: 12 }, (_, index) => ({ id: `service-${index}`, businessId: "biz", name: `Service ${index}`, durationMinutes: 30, priceMinor: 1000, position: index })))
  await db.insert(services).values({ id: "foreign-service", businessId: "other", name: "Foreign service", durationMinutes: 30, priceMinor: 1000 })
  await welcome()
  await runAutomations(tap("welcome-services", "services"), NOW)
  expect(sent[1]).toMatchObject({ messageType: "interactive", interactiveType: "list" })
  const list = JSON.stringify(sent[1])
  expect(list).toContain("automation-service:welcome:service-0")
  expect(list).toContain("Service 9")
  expect(list).not.toContain("Service 10")
  expect(list).not.toContain("Foreign service")
  await db.update(automationRuns).set({ chatMessageId: "provider-2" })
    .where(eq(automationRuns.chatRecordId, "record-2"))
  await runAutomations(tap("automation-service:welcome:service-0", "service-choice", "provider-2"), NOW)
  expect(sent[2]).toMatchObject({ messageType: "interactive", interactiveType: "cta_url" })
  expect((await rows()).find((row) => row.step === "serviceLink")).toMatchObject({ state: "sent" })
})

test("handoff replies, notifies the owner and pauses all further automation messages for this customer", async () => {
  await welcome()
  await runAutomations(tap("welcome-handoff", "handoff"), NOW)
  expect(sent[1]).toMatchObject({ messageType: "text", messageText: "Got it, someone will answer you soon." })
  expect(await db.select().from(automationPauses)).toEqual([expect.objectContaining({ businessId: "biz", customerPhone: PHONE, until: "2026-11-03T14:00:00.000Z" })])
  expect(await db.select().from(inAppNotifications)).toEqual(expect.arrayContaining([expect.objectContaining({ businessId: "biz", kind: "customerReplied" })]))
  await runAutomations(inbound("paused"), null)
  await runAutomations(tap("welcome-booking", "paused-button"), NOW)
  expect(sent).toHaveLength(2)
  expect((await rows()).some((row) => row.state === "skipped")).toBe(true)
})

test("handoff pause duration follows its stored rule and expires", async () => {
  await db.insert(platformSettings).values({ key: "automation.handoffQuietHours", value: 2 })
  await welcome()
  await runAutomations(tap("welcome-handoff", "handoff"), NOW)
  expect((await db.select().from(automationPauses))[0].until).toBe("2026-11-02T16:00:00.000Z")
  vi.setSystemTime("2026-11-02T17:00:00.000Z")
  await runAutomations(inbound("after-pause", { occurredAt: "2026-11-02T17:00:00.000Z" }), NOW)
  expect(sent).toHaveLength(2)
  await runAutomations({ ...tap("welcome-booking", "action-after-pause"), occurredAt: "2026-11-02T17:00:00.000Z" }, NOW)
  expect(sent).toHaveLength(3)
})

test("button payloads need a known sent parent, matching customer, and an existing saved action", async () => {
  await welcome()
  await runAutomations(tap("welcome-booking", "unknown-parent", "unknown"), NOW)
  await runAutomations(tap("welcome-booking", "chat-record-is-not-provider", "record-1"), NOW)
  await runAutomations(tap("unknown-payload", "unknown-payload"), NOW)
  await runAutomations({ ...tap("welcome-booking", "other-customer"), fromPhone: "18095559999" }, NOW)
  await runAutomations(tap("automation-service:welcome:foreign-service", "foreign-service"), NOW)
  expect(sent).toHaveLength(1)
})

test("stored button order, labels and actions drive the welcome and subsequent choice", async () => {
  const custom = welcomeDefaults()
  custom.wording.en.body = "Hello from {business}."
  custom.buttons = [{ id: "custom-person", label: { en: "A person", es: "Una persona" }, action: { type: "handoff" } }]
  await db.update(automations).set(custom).where(eq(automations.id, "welcome"))
  await welcome()
  expect(sent[0]).toMatchObject({ messageText: "Hello from Shop.", buttonParams: [{ id: "custom-person", title: "A person" }] })
  await runAutomations(tap("custom-person", "custom-handoff"), NOW)
  expect((await rows()).some((row) => row.step === "handoff" && row.state === "sent")).toBe(true)
})

test.each(["send", "contact"])("a Chat %s error records failed, does not throw or retry, and logs no private data", async (failure) => {
  sendFails = failure === "send"
  contactFails = failure === "contact"
  await expect(runAutomations(inbound(), null)).resolves.toBeUndefined()
  expect((await rows()).some((row) => row.state === "failed")).toBe(true)
  const calls = chat.mock.calls.length
  await runAutomations(inbound(), null)
  expect(chat).toHaveBeenCalledTimes(calls)
  expect(errorLog).not.toHaveBeenCalled()
})

test("an opted-out contact is skipped and never receives a send", async () => {
  unsubscribed = true
  await runAutomations(inbound(), null)
  expect(sent).toEqual([])
  expect((await rows()).some((row) => row.state === "skipped")).toBe(true)
})

test("a database failure while logging an attempted send never escapes the webhook boundary", async () => {
  await db.$client.execute("CREATE TRIGGER reject_run BEFORE INSERT ON automation_runs BEGIN SELECT RAISE(ABORT, 'private database detail'); END")
  try {
    await expect(runAutomations(inbound(), null)).resolves.toBeUndefined()
    expect(errorLog).not.toHaveBeenCalled()
  } finally {
    await db.$client.execute("DROP TRIGGER reject_run")
  }
})

test("a manual outbound event pauses the customer, but the automation's own outbound does not", async () => {
  await welcome()
  await runAutomations(outbound("record-1"), null)
  expect(await db.select().from(automationPauses)).toEqual([])
  await runAutomations(outbound(), null)
  expect(await db.select().from(automationPauses)).toEqual([expect.objectContaining({ customerPhone: PHONE, until: "2026-11-03T14:00:00.000Z" })])
  await runAutomations(inbound("after-manual"), null)
  expect(sent).toHaveLength(1)
})

test("an outbound event for a known booking notification does not create a manual handoff pause", async () => {
  await db.insert(bookings).values({ id: "booking", businessId: "biz", serviceName: "Service", durationMinutes: 30, currency: "USD", startAt: "2026-11-04T14:00:00.000Z", endAt: "2026-11-04T14:30:00.000Z", customerName: "Customer", customerPhone: PHONE })
  await db.insert(notificationSends).values({ businessId: "biz", bookingId: "booking", message: "confirmed", dueAt: NOW, state: "sent", sender: "own", chatRecordId: "booking-record" })
  await runAutomations(outbound("booking-record"), null)
  expect(await db.select().from(automationPauses)).toEqual([])
  expect(sent).toEqual([])
})

test.each([null, {}, { type: "inbound" }, inbound("", {}), inbound("bad-date", { occurredAt: "not a date" })])("malformed event %# never throws or sends", async (event) => {
  await expect(runAutomations(event, null)).resolves.toBeUndefined()
  expect(sent).toEqual([])
})

async function customerBooking(id: string, language: "en" | "es", createdAt: string, businessId = "biz") {
  await db.insert(bookings).values({ id, businessId, serviceName: "Service", durationMinutes: 30, currency: "USD",
    startAt: "2026-11-04T14:00:00.000Z", endAt: "2026-11-04T14:30:00.000Z", customerName: "Ana",
    customerPhone: PHONE, customerKey: `p:${PHONE}`, language, createdAt })
}

test("latest own booking selects Spanish and replies retain their parent's language after a newer English booking", async () => {
  await customerBooking("older-en", "en", "2026-10-01T14:00:00.000Z")
  await customerBooking("newer-es", "es", "2026-11-01T14:00:00.000Z")
  await customerBooking("foreign-en", "en", NOW, "other")
  await welcome()
  expect(sent[0]).toMatchObject({ messageText: welcomeDefaults().wording.es.body.replace("{business}", "Shop"),
    buttonParams: [{ id: "welcome-booking", title: "Reservar" }, { id: "welcome-services", title: "Nuestros servicios" }, { id: "welcome-handoff", title: "Hablar con nosotros" }] })
  expect((await rows())[0].language).toBe("es")
  await customerBooking("newest-en", "en", NOW)
  await runAutomations(tap("welcome-handoff", "spanish-handoff"), NOW)
  expect(sent[1]).toMatchObject({ messageType: "text", messageText: welcomeDefaults().wording.es.handoffReply })
  expect((await rows()).find((row) => row.step === "handoff")?.language).toBe("es")
})

test("an outbound callback binds the provider message id before a choice without creating a pause", async () => {
  await runAutomations(inbound(), null)
  expect((await rows())[0].chatMessageId).toBeNull()
  await runAutomations({ ...outbound("record-1"), messageId: "provider-from-callback" }, null)
  expect((await rows())[0].chatMessageId).toBe("provider-from-callback")
  expect(await db.select().from(automationPauses)).toEqual([])
  await runAutomations(tap("welcome-booking", "bound-choice", "provider-from-callback"), NOW)
  expect(sent).toHaveLength(2)
  expect(sent[1]).toMatchObject({ interactiveType: "cta_url" })
})

test("a choice cannot reuse a parent's provider id from another business or source number", async () => {
  await welcome()
  await db.insert(chatConnections).values({ businessId: "other", workspaceId: "other-workspace", workspaceName: "Other",
    scopes: "contacts templates conversations automations", accessToken: seal("other-access"), refreshToken: seal("other-refresh"),
    accessExpiresAt: "2099-01-01T00:00:00.000Z", phoneNumberId: "other-number", wabaId: "other-waba" })
  await db.insert(automations).values({ id: "other-flow", businessId: "other", key: "welcome", trigger: "firstMessage", on: true, ...welcomeDefaults() })
  await runAutomations({ ...tap("welcome-booking", "cross-business"), workspaceId: "other-workspace", senderId: "other-number" }, NOW)
  await runAutomations({ ...tap("welcome-booking", "wrong-number"), senderId: "other-number" }, NOW)
  await runAutomations({ ...tap("welcome-booking", "wrong-workspace"), workspaceId: "unknown-workspace" }, NOW)
  expect(sent).toHaveLength(1)
})

test("services action logs noServices and makes no empty interactive list", async () => {
  await welcome()
  await runAutomations(tap("welcome-services", "no-services"), NOW)
  expect(sent).toHaveLength(1)
  expect((await rows()).find((row) => row.step === "servicesList")).toMatchObject({ state: "skipped", reason: "noServices" })
})

test("expired and future inbound events cannot send outside the customer window", async () => {
  await runAutomations(inbound("expired", { occurredAt: "2026-11-01T13:00:00.000Z" }), null)
  await runAutomations(inbound("future", { occurredAt: "2026-11-02T15:00:00.000Z" }), null)
  expect(sent).toEqual([])
  expect(await rows()).toHaveLength(2)
  expect((await rows()).every((row) => row.state === "skipped" && row.reason === "windowClosed")).toBe(true)
})

test("rendered welcome is validated after inserting the business name and before sending", async () => {
  await db.insert(platformSettings).values({ key: "automation.maxBody", value: 100 })
  await db.update(businesses).set({ name: "Business ".repeat(30) }).where(eq(businesses.id, "biz"))
  await runAutomations(inbound(), null)
  expect(sent).toEqual([])
  expect(chat).not.toHaveBeenCalled()
  expect(await rows()).toEqual([expect.objectContaining({ state: "failed", reason: "tooLong" })])
})

test("a service title exceeding the stored row-title limit fails visibly before sending the list", async () => {
  await db.insert(services).values({ id: "long-service", businessId: "biz", name: "Long service title exceeding the allowed row title", durationMinutes: 30 })
  await welcome()
  await runAutomations(tap("welcome-services", "long-service-list"), NOW)
  expect(sent).toHaveLength(1)
  expect((await rows()).find((row) => row.step === "servicesList")).toMatchObject({ state: "failed", reason: "tooLong" })
})

test("distinct simultaneous first messages with no prior reply still produce only one welcome", async () => {
  await Promise.all(Array.from({ length: 5 }, (_, index) => runAutomations(inbound(`distinct-${index}`), null)))
  expect(sent).toHaveLength(1)
  expect((await db.select().from(automationEvents)).filter((row) => row.eventId.startsWith("distinct-"))).toHaveLength(5)
  expect((await rows()).filter((row) => row.step === "welcome" && row.state === "sent")).toHaveLength(1)
})

test("actual inbound webhook application acknowledges a failed send and dedupes its redelivery", async () => {
  sendFails = true
  await expect(applyChatEvent(inbound())).resolves.toBeUndefined()
  expect((await rows()).some((row) => row.state === "failed")).toBe(true)
  const calls = chat.mock.calls.length
  await expect(applyChatEvent(inbound())).resolves.toBeUndefined()
  expect(chat).toHaveBeenCalledTimes(calls)
  expect(errorLog).not.toHaveBeenCalled()
})

test("actual outbound webhook application binds own sends without pause and pauses manual messages", async () => {
  await runAutomations(inbound(), null)
  await expect(applyChatEvent({ ...outbound("record-1"), messageId: "webhook-provider" })).resolves.toBeUndefined()
  expect((await rows())[0].chatMessageId).toBe("webhook-provider")
  expect(await db.select().from(automationPauses)).toEqual([])
  await expect(applyChatEvent(outbound("manual-webhook"))).resolves.toBeUndefined()
  expect(await db.select().from(automationPauses)).toEqual([expect.objectContaining({ customerPhone: PHONE, until: "2026-11-03T14:00:00.000Z" })])
})

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}

test("an outbound callback racing a shared send waits for its durable receipt instead of pausing the customer", async () => {
  const entered = deferred()
  const response = deferred()
  sendEntered = entered.resolve
  sendGate = response.promise
  const sending = post({ sender: "own", workspaceId: "own", phoneNumberId: "number",
    call: (path, init) => chatApi("biz", path, init) }, PHONE, "Customer", "text",
  (recipient) => ({ ...recipient, messageType: "text", messageText: "Booking confirmed" }), { logErrors: false })
  await entered.promise
  const callback = runAutomations(outbound("record-1"), null)
  response.resolve()
  const [outcome] = await Promise.all([sending, callback])
  expect(outcome).toMatchObject({ state: "sent", chatRecordId: "record-1" })
  expect(await db.select().from(automationPauses)).toEqual([])
  expect(await rows()).toEqual([])
  expect(await db.select().from(notificationSends)).toEqual([])
  expect(await db.select().from(automationEvents)).toEqual(expect.arrayContaining([
    expect.objectContaining({ businessId: "biz", workspaceId: "own", eventId: bookSendReceipt("record-1") }),
  ]))
  await runAutomations(outbound("manual-after-race"), null)
  expect(await db.select().from(automationPauses)).toEqual([expect.objectContaining({ customerPhone: PHONE })])
})

test("a customer who never booked gets the Welcome, with no name sent", async () => {
  await runAutomations(inbound(), null)
  expect(sent).toHaveLength(1)
  expect((await rows())[0]).toMatchObject({ step: "welcome", state: "sent" })
})

test("a Welcome that failed tries again on the customer's next message", async () => {
  sendFails = true
  await runAutomations(inbound("event-first"), null)
  expect((await rows())[0]).toMatchObject({ state: "failed", reason: "send_failed" })
  sendFails = false
  vi.setSystemTime(new Date(Date.parse(NOW) + 60_000))
  await runAutomations(inbound("event-second"), NOW)
  expect(sent).toHaveLength(1)
  // Once it arrived, the next message is an ordinary one.
  vi.setSystemTime(new Date(Date.parse(NOW) + 120_000))
  await runAutomations(inbound("event-third"), NOW)
  expect(sent).toHaveLength(1)
})

test("a customer saved without the country code is still recognized", async () => {
  await db.insert(bookings).values({
    businessId: "biz", serviceName: "Cut", customerName: "Ana", customerPhone: PHONE.slice(1),
    customerKey: `p:${PHONE.slice(1)}`, startAt: NOW, endAt: NOW, durationMinutes: 30, priceMinor: 0, currency: "USD",
    source: "online", language: "es",
  } as typeof bookings.$inferInsert)
  await runAutomations(inbound(), null)
  expect((await rows())[0]).toMatchObject({ customerName: "Ana", language: "es", state: "sent" })
})
