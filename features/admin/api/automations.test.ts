// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { automationEvents, automationPauses, automationRuns, automations, businesses } from "@/lib/db/schema"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ requireAdmin: vi.fn() }))
const { adminAutomations, adminAutomationRuns } = await import("./automations")
const AT = "2026-11-01T05:00:00.000Z"
const EMPTY = { runs: [], next: null }
let dir: string

function flow(id: string, businessId: string) {
  return {
    id, businessId, key: "welcome", trigger: "firstMessage" as const,
    wording: { en: { body: "Hello {business}.", handoffReply: "Someone will reply.", servicesIntro: "Choose a service." },
      es: { body: "Hola {business}.", handoffReply: "Alguien responderá.", servicesIntro: "Elige un servicio." } },
    buttons: [{ id: "book", label: { en: "Book", es: "Reservar" }, action: { type: "bookingLink" as const } }],
  }
}
function run(id: string, options: Partial<typeof automationRuns.$inferInsert> = {}) {
  const businessId = options.businessId ?? "one"
  return {
    id, businessId, automationId: `${businessId}-flow`, workspaceId: "workspace", phoneNumberId: "number",
    customerPhone: "15551234567", customerName: "Alice", language: "en" as const,
    step: "welcome" as const, state: "sent" as const, reason: null, at: AT, ...options,
  }
}
async function seedRuns() {
  await db.insert(automations).values([flow("one-flow", "one"), flow("two-flow", "two")])
}
async function snapshot() {
  return Promise.all([
    db.select().from(automations), db.select().from(automationRuns),
    db.select().from(automationEvents), db.select().from(automationPauses),
  ])
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "book-admin-automation-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.$client.execute("PRAGMA foreign_keys = ON")
})
beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue({ userId: "admin", name: "Admin", email: "admin@example.test", phone: null, contact: "admin@example.test", emailVerified: true, image: null, isGuest: false })
  await db.delete(businesses)
  await db.insert(businesses).values([
    { id: "one", slug: "one", name: "First business", timezone: "America/New_York", currency: "USD" },
    { id: "two", slug: "two", name: "Second business", timezone: "Europe/Madrid", currency: "EUR" },
    { id: "unread", slug: "unread", name: "Unread business", timezone: "UTC", currency: "USD" },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("admin authorization happens before any validation or database read", async () => {
  vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin required"))
  const before = await snapshot()
  await expect(adminAutomations("")).rejects.toThrow("Admin required")
  await expect(adminAutomationRuns({ state: "pending" } as unknown as Parameters<typeof adminAutomationRuns>[0])).rejects.toThrow("Admin required")
  expect(await snapshot()).toEqual(before)
  expect(requireAdmin).toHaveBeenCalledTimes(2)
})

test("admin reads never create an unread business's welcome or change any automation records", async () => {
  await seedRuns()
  await db.insert(automationRuns).values(run("existing"))
  await db.insert(automationEvents).values({ businessId: "one", workspaceId: "workspace", phoneNumberId: "number", eventId: "seen", occurredAt: AT })
  await db.insert(automationPauses).values({ businessId: "one", workspaceId: "workspace", phoneNumberId: "number", customerPhone: "15551234567", until: "2026-11-02T05:00:00.000Z" })
  const before = await snapshot()
  expect(await adminAutomations("unread")).toEqual([])
  expect(await adminAutomations("missing")).toEqual([])
  expect(await adminAutomationRuns({ businessId: "unread" })).toEqual(EMPTY)
  await adminAutomations("one")
  await adminAutomationRuns({})
  expect(await snapshot()).toEqual(before)
})

test("flows are business scoped and expose exactly the Automation contract", async () => {
  await seedRuns()
  const [one] = await adminAutomations("one")
  expect(one).toEqual({ id: "one-flow", trigger: "firstMessage", on: false, wording: flow("one-flow", "one").wording,
    buttons: flow("one-flow", "one").buttons, isDefault: true, updatedAt: expect.any(String) })
  expect((await adminAutomations("two")).map((row) => row.id)).toEqual(["two-flow"])
})

test("runs carry the exact business DTO and timezone, with optional business and state filters", async () => {
  await seedRuns()
  await db.insert(automationRuns).values([
    run("a-sent"), run("b-failed", { state: "failed", reason: "chat" }),
    run("c-skipped", { businessId: "two", state: "skipped" }),
  ])
  expect(await adminAutomationRuns({ businessId: "one", state: "failed" })).toEqual({ runs: [{
    id: "b-failed", automationId: "one-flow", customerPhone: "15551234567", customerName: "Alice",
    step: "welcome", state: "failed", reason: "chat", at: AT,
    businessId: "one", businessName: "First business", timeZone: "America/New_York",
  }], next: null })
  expect((await adminAutomationRuns({ state: "skipped" })).runs[0]).toMatchObject({ businessId: "two", timeZone: "Europe/Madrid" })
  expect((await adminAutomationRuns({ businessId: "one" })).runs).toHaveLength(2)
})

test("customer search matches case-insensitive names and formatted phone digits including unnamed customers", async () => {
  await seedRuns()
  await db.insert(automationRuns).values([
    run("alice", { customerName: "Alice Example", customerPhone: "18095550101" }),
    run("unnamed", { customerName: null, customerPhone: "18095550202" }),
    run("other", { businessId: "two", customerName: "Different", customerPhone: "18095550303" }),
  ])
  expect((await adminAutomationRuns({ search: "  aLiCe  " })).runs.map((row) => row.id)).toEqual(["alice"])
  expect((await adminAutomationRuns({ search: "+1 (809) 555-0202" })).runs.map((row) => row.id)).toEqual(["unnamed"])
  expect((await adminAutomationRuns({ search: "555" })).runs).toHaveLength(3)
  expect((await adminAutomationRuns({ search: "555", businessId: "two" })).runs.map((row) => row.id)).toEqual(["other"])
})

test.each(["%", "_", "\\"])("search treats %s as a literal rather than a LIKE wildcard", async (literal) => {
  await seedRuns()
  await db.insert(automationRuns).values([
    run("literal", { customerName: `Before${literal}After` }), run("plain", { customerName: "BeforeXAfter" }),
  ])
  expect((await adminAutomationRuns({ search: literal })).runs.map((row) => row.id)).toEqual(["literal"])
})

test("admin pagination uses its listRows rule and stable descending time/id ordering across tied runs", async () => {
  await seedRuns()
  const limit = WHATSAPP_ADMIN_RULES.listRows
  const fixtures = Array.from({ length: limit + 5 }, (_, index) => run(`run-${String(index).padStart(4, "0")}`, {
    businessId: index % 2 ? "one" : "two",
  }))
  await db.insert(automationRuns).values(fixtures)
  await db.insert(automationRuns).values(run("newest", { at: "2026-11-02T05:00:00.000Z" }))
  const first = await adminAutomationRuns({})
  expect(first.runs).toHaveLength(limit)
  expect(first.runs[0].id).toBe("newest")
  expect(first.next).not.toBeNull()
  const second = await adminAutomationRuns({ cursor: first.next! })
  expect(second.next).toBeNull()
  expect([...first.runs, ...second.runs].map((row) => row.id)).toEqual([
    "newest", ...fixtures.map((row) => row.id).sort().reverse(),
  ])
})

test("cursor scope binds business, state and canonical trimmed search, and rejects owner cursors", async () => {
  await seedRuns()
  await db.insert(automationRuns).values(Array.from({ length: WHATSAPP_ADMIN_RULES.listRows + 1 }, (_, index) => run(`r-${String(index).padStart(4, "0")}`)))
  const first = await adminAutomationRuns({ businessId: "one", state: "sent", search: "  Alice " })
  expect(first.next).not.toBeNull()
  expect((await adminAutomationRuns({ businessId: "one", state: "sent", search: "Alice", cursor: first.next! })).runs).toHaveLength(1)
  for (const filter of [{ businessId: "two", state: "sent", search: "Alice" }, { businessId: "one", search: "Alice" },
    { businessId: "one", state: "sent", search: "Other" }, { state: "sent", search: "Alice" }]) {
    expect(await adminAutomationRuns({ ...filter, cursor: first.next! } as Parameters<typeof adminAutomationRuns>[0])).toEqual(EMPTY)
  }
  const owner = Buffer.from(JSON.stringify({ businessId: "one", automationId: null, state: "sent", search: "Alice", at: AT, id: "r-0001" })).toString("base64url")
  expect(await adminAutomationRuns({ businessId: "one", state: "sent", search: "Alice", cursor: owner })).toEqual(EMPTY)
})

test.each(["", "%%%", "not-json", Buffer.from("null").toString("base64url"), Buffer.from("{}").toString("base64url"),
  Buffer.from(JSON.stringify({ businessId: null, state: null, search: "", at: "invalid", id: "x" })).toString("base64url"),
])("malformed cursor %# returns no records", async (cursor) => {
  await seedRuns()
  await db.insert(automationRuns).values(run("one"))
  expect(await adminAutomationRuns({ cursor })).toEqual(EMPTY)
})

test.each([null, [], { state: "pending" }, { search: 1 }, { businessId: "" }, { cursor: 1 }, { unknown: true }])(
  "invalid filter %# returns no records after authorization", async (filter) => {
    expect(await adminAutomationRuns(filter as Parameters<typeof adminAutomationRuns>[0])).toEqual(EMPTY)
    expect(requireAdmin).toHaveBeenCalledTimes(1)
  }
)

test("admin flow and run queries work when SQLite forbids every write", async () => {
  await seedRuns()
  await db.insert(automationRuns).values(run("readonly"))
  await db.$client.execute("PRAGMA query_only = ON")
  try {
    expect(await adminAutomations("unread")).toEqual([])
    expect(await adminAutomations("one")).toHaveLength(1)
    expect((await adminAutomationRuns({ businessId: "one", search: "Alice" })).runs.map((row) => row.id)).toEqual(["readonly"])
  } finally {
    await db.$client.execute("PRAGMA query_only = OFF")
  }
})
