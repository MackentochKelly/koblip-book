// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, chatConnections, chatReplies } from "@/lib/db/schema"
import { runAutomations } from "./automation-engine"

vi.mock("server-only", () => ({}))
vi.mock("./automation-engine", () => ({ runAutomations: vi.fn() }))
vi.mock("@/lib/in-app-notifications", () => ({ notify: vi.fn(), notification: vi.fn() }))
const { applyChatEvent } = await import("./chat-events")
let dir: string
const firstAt = "2026-10-01T10:00:00.000Z"
const laterAt = "2026-10-31T10:00:00.000Z"
const event = (values = {}) => ({
  eventId: "event-1",
  type: "inbound",
  workspaceId: "workspace-a",
  senderId: "number-a",
  fromPhone: "+1 (555) 000-0001",
  occurredAt: firstAt,
  ...values,
})
const observed: { previous: string | null; saved: string | undefined }[] = []

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-automation-hook-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(businesses).values([
    { id: "a", slug: "a", name: "A", timezone: "UTC", currency: "USD" },
    { id: "b", slug: "b", name: "B", timezone: "UTC", currency: "USD" },
  ])
  await db.insert(chatConnections).values([
    { businessId: "a", workspaceId: "workspace-a", workspaceName: "A", scopes: "templates conversations", phoneNumberId: "number-a" },
    { businessId: "b", workspaceId: "workspace-b", workspaceName: "B", scopes: "templates conversations", phoneNumberId: "number-b" },
  ])
})

beforeEach(async () => {
  await db.delete(chatReplies)
  await db.update(chatConnections).set({ needsReconnect: false })
  observed.length = 0
  vi.mocked(runAutomations).mockReset()
  vi.mocked(runAutomations).mockImplementation(async (received, previous) => {
    const value = received as ReturnType<typeof event>
    const [saved] = await db.select().from(chatReplies).where(and(
      eq(chatReplies.workspaceId, value.workspaceId),
      eq(chatReplies.phoneNumberId, value.senderId),
      eq(chatReplies.customerPhone, value.fromPhone.replace(/\D/g, ""))
    ))
    observed.push({ previous, saved: saved?.lastReplyAt })
  })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("the first inbound hook receives null prior time after the reply row is saved", async () => {
  const received = event()
  await applyChatEvent(received)
  expect(runAutomations).toHaveBeenCalledExactlyOnceWith(received, null)
  expect(observed).toEqual([{ previous: null, saved: firstAt }])
  expect(await db.select().from(chatReplies)).toEqual([
    expect.objectContaining({ workspaceId: "workspace-a", phoneNumberId: "number-a", customerPhone: "15550000001", lastReplyAt: firstAt }),
  ])
})

test("a later reply supplies the previous time while the hook sees the new time", async () => {
  await applyChatEvent(event())
  const received = event({ eventId: "event-2", occurredAt: laterAt })
  await applyChatEvent(received)
  expect(runAutomations).toHaveBeenLastCalledWith(received, firstAt)
  expect(observed).toEqual([{ previous: null, saved: firstAt }, { previous: firstAt, saved: laterAt }])
})

test("repeated and out-of-order events preserve the newest reply time and expose the correct prior value", async () => {
  const newest = event({ occurredAt: laterAt })
  await applyChatEvent(newest)
  await applyChatEvent(newest)
  const late = event({ eventId: "late-event", occurredAt: firstAt })
  await applyChatEvent(late)
  expect(runAutomations).toHaveBeenNthCalledWith(2, newest, laterAt)
  expect(runAutomations).toHaveBeenNthCalledWith(3, late, laterAt)
  expect(observed).toEqual([
    { previous: null, saved: laterAt },
    { previous: laterAt, saved: laterAt },
    { previous: laterAt, saved: laterAt },
  ])
  expect(await db.select().from(chatReplies)).toHaveLength(1)
})

test("prior reply lookup is isolated by workspace, number and normalized customer phone", async () => {
  await db.insert(chatReplies).values([
    { workspaceId: "workspace-b", phoneNumberId: "number-a", customerPhone: "15550000001", lastReplyAt: laterAt },
    { workspaceId: "workspace-a", phoneNumberId: "number-other", customerPhone: "15550000001", lastReplyAt: laterAt },
    { workspaceId: "workspace-a", phoneNumberId: "number-a", customerPhone: "15550000002", lastReplyAt: laterAt },
  ])
  const received = event()
  await applyChatEvent(received)
  expect(runAutomations).toHaveBeenCalledExactlyOnceWith(received, null)
  expect(observed).toEqual([{ previous: null, saved: firstAt }])
  const second = event({ eventId: "event-2", fromPhone: "1 555 000 0001", occurredAt: laterAt })
  await applyChatEvent(second)
  expect(runAutomations).toHaveBeenLastCalledWith(second, firstAt)
  expect(await db.select().from(chatReplies)).toHaveLength(4)
})

test.each([
  null,
  {},
  event({ workspaceId: "" }),
  event({ senderId: "" }),
  event({ fromPhone: "no digits" }),
  event({ occurredAt: "invalid date" }),
  event({ workspaceId: "not-connected" }),
])("malformed or unconnected event never invokes the automation hook: %#", async (received) => {
  await applyChatEvent(received)
  expect(runAutomations).not.toHaveBeenCalled()
  expect(await db.select().from(chatReplies)).toEqual([])
})

test("a connection needing reconnection does not invoke the hook or save a reply", async () => {
  await db.update(chatConnections).set({ needsReconnect: true }).where(eq(chatConnections.businessId, "a"))
  await applyChatEvent(event())
  expect(runAutomations).not.toHaveBeenCalled()
  expect(await db.select().from(chatReplies)).toEqual([])
})


test("outbound events reach the automation boundary without changing reply-window rows", async () => {
  vi.mocked(runAutomations).mockResolvedValue(undefined)
  const received = { type: "outbound", eventId: "manual", workspaceId: "workspace-a",
    toPhone: "15550000001", occurredAt: firstAt, recordId: "manual-record" }
  await applyChatEvent(received)
  expect(runAutomations).toHaveBeenCalledExactlyOnceWith(received, null)
  expect(await db.select().from(chatReplies)).toEqual([])
})
