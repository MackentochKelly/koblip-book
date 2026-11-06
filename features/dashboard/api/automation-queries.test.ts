// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { automationRuns as runsTable, automations, businesses, platformSettings, user } from "@/lib/db/schema"
import type { AutomationRun } from "../types/automations"
import { welcomeDefaults } from "../utils/automation-defaults"

vi.mock("server-only", () => ({}))
// Book's words in Portuguese and French come from the app's words.
const { registerEnglishWords } = await import("@/lib/translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { welcomeWords } = await import("./message-words")
// Book's Welcome flow as the server reads it: Spanish from the migrated
// database, Portuguese and French in English until Google's arrive.
let words: Awaited<ReturnType<typeof welcomeWords>>
const defaults = () => welcomeDefaults(words)
const { ownerCheck } = vi.hoisted(() => ({ ownerCheck: vi.fn(async () => ({})) }))
vi.mock("./queries", () => ({ getOwnerBusiness: ownerCheck }))
const { automationRuns, automationsFor } = await import("./automation-queries")
let dir: string
const AT = "2026-10-31T20:00:00.000Z"
const EMPTY = { runs: [], next: null }

async function addRun(id: string, options: {
  businessId?: string
  automationId?: string
  state?: AutomationRun["state"]
  at?: string
  customerName?: string | null
  customerPhone?: string
} = {}) {
  const businessId = options.businessId ?? "one"
  await db.insert(runsTable).values({
    id, businessId, automationId: options.automationId ?? `${businessId}-welcome`,
    workspaceId: `workspace-${businessId}`, phoneNumberId: "number", eventId: `event-${id}`,
    customerPhone: options.customerPhone ?? "15551234567",
    customerName: options.customerName === undefined ? "Customer" : options.customerName, language: "en",
    step: "welcome", state: options.state ?? "sent", reason: null,
    chatRecordId: `chat-${id}`, chatMessageId: `message-${id}`, at: options.at ?? AT,
  })
}

async function setPageSize(size: number) {
  await db.insert(platformSettings).values({ key: "historySize", value: size, updatedBy: "admin" })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "book-automation-queries-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  words = await welcomeWords()
  await db.$client.execute("PRAGMA foreign_keys = ON")
  await db.insert(user).values({ id: "admin", name: "Admin", email: "automation-query-admin@example.com", emailVerified: true })
})

beforeEach(async () => {
  ownerCheck.mockReset()
  ownerCheck.mockResolvedValue({})
  await db.delete(businesses)
  await db.delete(platformSettings)
  await db.insert(businesses).values([
    { id: "one", slug: "one", name: "One", timezone: "America/New_York", currency: "USD" },
    { id: "two", slug: "two", name: "Two", timezone: "America/New_York", currency: "USD" },
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

async function seedAutomations() {
  for (const businessId of ["one", "two"]) {
    await db.insert(automations).values({ id: `${businessId}-welcome`, businessId, key: "welcome", trigger: "firstMessage", ...defaults() })
  }
}

test("both queries check ownership before reading or initializing a business", async () => {
  ownerCheck.mockRejectedValue(new Error("not owned"))
  await expect(automationsFor("one")).rejects.toThrow("not owned")
  await expect(automationRuns("one", {})).rejects.toThrow("not owned")
  await expect(automationRuns("two", { state: "invalid" } as unknown as Parameters<typeof automationRuns>[1])).rejects.toThrow("not owned")
  expect(ownerCheck.mock.calls).toEqual([["one"], ["one"], ["two"]])
  expect(await db.select().from(automations)).toEqual([])
})

test("the authorized first read initializes one disabled bilingual welcome and stays scoped", async () => {
  const first = await automationsFor("one")
  expect(ownerCheck).toHaveBeenCalledWith("one")
  expect(first).toHaveLength(1)
  expect(first[0]).toMatchObject({ trigger: "firstMessage", on: false, isDefault: true, ...defaults() })
  expect(await automationsFor("one")).toEqual(first)
  const second = await automationsFor("two")
  expect(second[0].id).not.toBe(first[0].id)
  expect(await automationsFor("one")).toEqual(first)
})

test("run reads expose exactly the Contract fields and never another business's records", async () => {
  await seedAutomations()
  await addRun("own")
  await addRun("other", { businessId: "two" })
  expect(await automationRuns("one", {})).toEqual({ runs: [{
    id: "own", automationId: "one-welcome", customerPhone: "15551234567", customerName: "Customer",
    step: "welcome", state: "sent", reason: null, at: AT,
  }], next: null })
  expect((await automationRuns("two", {})).runs.map((row) => row.id)).toEqual(["other"])
})

test("state and automation filters combine without widening business scope", async () => {
  await seedAutomations()
  await db.insert(automations).values({ id: "one-extra", businessId: "one", key: "extra", trigger: "firstMessage", ...defaults() })
  await addRun("one-sent")
  await addRun("one-failed", { state: "failed" })
  await addRun("one-skipped", { state: "skipped" })
  await addRun("extra-failed", { automationId: "one-extra", state: "failed" })
  await addRun("other-failed", { businessId: "two", state: "failed" })
  expect((await automationRuns("one", { state: "failed" })).runs.map((row) => row.id)).toEqual(["one-failed", "extra-failed"])
  expect((await automationRuns("one", { automationId: "one-extra" })).runs.map((row) => row.id)).toEqual(["extra-failed"])
  expect((await automationRuns("one", { automationId: "one-welcome", state: "skipped" })).runs.map((row) => row.id)).toEqual(["one-skipped"])
  expect(await automationRuns("one", { automationId: "two-welcome" })).toEqual(EMPTY)
})

test("stored historySize controls pagination across tied timestamps without duplicates or missing runs", async () => {
  await seedAutomations()
  await setPageSize(2)
  for (let index = 1; index <= 7; index++) await addRun(`run-${index}`)
  await addRun("older", { at: "2026-10-30T20:00:00.000Z" })
  await addRun("newer", { at: "2026-11-01T20:00:00.000Z" })
  await addRun("foreign", { businessId: "two", at: "2026-11-02T20:00:00.000Z" })
  const seen: string[] = []
  let cursor: string | undefined
  do {
    const page = await automationRuns("one", cursor ? { cursor } : {})
    expect(page.runs.length).toBeLessThanOrEqual(2)
    seen.push(...page.runs.map((row) => row.id))
    cursor = page.next ?? undefined
  } while (cursor)
  expect(seen).toEqual(["newer", "run-7", "run-6", "run-5", "run-4", "run-3", "run-2", "run-1", "older"])
  expect(new Set(seen).size).toBe(seen.length)
})

test("a full last page has no next cursor and filtered pages keep their filter", async () => {
  await seedAutomations()
  await setPageSize(2)
  for (const id of ["a", "b", "c", "d"]) await addRun(id, { state: "failed" })
  await addRun("z", { state: "sent" })
  const first = await automationRuns("one", { automationId: "one-welcome", state: "failed" })
  expect(first.runs.map((row) => row.id)).toEqual(["d", "c"])
  expect(first.next).toEqual(expect.any(String))
  const second = await automationRuns("one", { automationId: "one-welcome", state: "failed", cursor: first.next! })
  expect(second.runs.map((row) => row.id)).toEqual(["b", "a"])
  expect(second.next).toBeNull()
})

test("a cursor cannot be reused for another business, state or automation filter", async () => {
  await seedAutomations()
  await setPageSize(1)
  await addRun("a")
  await addRun("b")
  await addRun("foreign", { businessId: "two" })
  const { next } = await automationRuns("one", {})
  expect(next).not.toBeNull()
  expect(await automationRuns("two", { cursor: next! })).toEqual(EMPTY)
  expect(await automationRuns("one", { cursor: next!, state: "sent" })).toEqual(EMPTY)
  expect(await automationRuns("one", { cursor: next!, automationId: "one-welcome" })).toEqual(EMPTY)
  const filtered = await automationRuns("one", { state: "sent", automationId: "one-welcome" })
  expect(filtered.next).not.toBeNull()
  expect(await automationRuns("one", { cursor: filtered.next! })).toEqual(EMPTY)
})

test.each(["", "%%%", "not-json", Buffer.from("[]").toString("base64url"), Buffer.from("{}").toString("base64url"),
  Buffer.from(JSON.stringify({ businessId: "one", automationId: null, state: null, id: "a", at: "bad-date" })).toString("base64url"),
])("malformed cursor %s returns no records", async (cursor) => {
  await seedAutomations()
  await addRun("a")
  expect(await automationRuns("one", { cursor })).toEqual(EMPTY)
  expect(ownerCheck).toHaveBeenCalledWith("one")
})

test.each([null, [], { state: "pending" }, { automationId: "" }, { automationId: 1 }, { cursor: 1 }, { unknown: "value" }])(
  "invalid filter %j returns no records after the owner check", async (filter) => {
    await seedAutomations()
    await addRun("a")
    expect(await automationRuns("one", filter as Parameters<typeof automationRuns>[1])).toEqual(EMPTY)
    expect(ownerCheck).toHaveBeenCalledWith("one")
  }
)


test("search trims text, matches customer names without case and stays within the business", async () => {
  await seedAutomations()
  await addRun("ana", { customerName: "Ana Rivera" })
  await addRun("other", { customerName: "Alex" })
  await addRun("foreign-ana", { businessId: "two", customerName: "ANA Rivera" })
  expect((await automationRuns("one", { search: "  aNA ri  " })).runs.map((run) => run.id)).toEqual(["ana"])
  expect((await automationRuns("two", { search: "ana" })).runs.map((run) => run.id)).toEqual(["foreign-ana"])
})

test("formatted phone searches use digits and find customers without a name", async () => {
  await seedAutomations()
  await addRun("phone", { customerName: null, customerPhone: "18095550123" })
  await addRun("other", { customerName: "Other", customerPhone: "18095550999" })
  expect((await automationRuns("one", { search: " +1 (809) 555-0123 " })).runs.map((run) => run.id)).toEqual(["phone"])
  expect((await automationRuns("one", { search: "555-0123" })).runs.map((run) => run.id)).toEqual(["phone"])
})

test.each([
  { search: "%", name: "Ana 50%", decoy: "Ana 50 percent" },
  { search: "_", name: "Ana_Rivera", decoy: "Ana Rivera" },
  { search: "\\", name: "Ana\\Rivera", decoy: "Ana Rivera" },
])("search treats LIKE special character $search literally", async ({ search, name, decoy }) => {
  await seedAutomations()
  await addRun("literal", { customerName: name })
  await addRun("decoy", { customerName: decoy })
  expect((await automationRuns("one", { search })).runs.map((run) => run.id)).toEqual(["literal"])
})

test("empty and whitespace-only searches leave the run list unchanged", async () => {
  await seedAutomations()
  await addRun("a", { customerName: "Ana" })
  await addRun("b", { customerName: null })
  const unfiltered = await automationRuns("one", {})
  expect(await automationRuns("one", { search: "" })).toEqual(unfiltered)
  expect(await automationRuns("one", { search: " \t \n " })).toEqual(unfiltered)
})

test("search combines with automation and state filters without widening tenant scope", async () => {
  await seedAutomations()
  await db.insert(automations).values({ id: "one-extra", businessId: "one", key: "extra", trigger: "firstMessage", ...defaults() })
  await addRun("match", { customerName: "Ana", state: "failed" })
  await addRun("wrong-state", { customerName: "Ana", state: "sent" })
  await addRun("wrong-automation", { customerName: "Ana", state: "failed", automationId: "one-extra" })
  await addRun("wrong-name", { customerName: "Alex", state: "failed" })
  await addRun("wrong-business", { businessId: "two", customerName: "Ana", state: "failed" })
  expect((await automationRuns("one", { search: "Ana", automationId: "one-welcome", state: "failed" })).runs.map((run) => run.id)).toEqual(["match"])
})

test("search pagination retains the trimmed search and rejects a cursor for another search", async () => {
  await seedAutomations()
  await setPageSize(1)
  await addRun("ana-a", { customerName: "Ana" })
  await addRun("ana-b", { customerName: "Ana" })
  await addRun("alex", { customerName: "Alex" })
  const first = await automationRuns("one", { search: " Ana " })
  expect(first.runs.map((run) => run.id)).toEqual(["ana-b"])
  expect(first.next).toEqual(expect.any(String))
  const second = await automationRuns("one", { search: "Ana", cursor: first.next! })
  expect(second.runs.map((run) => run.id)).toEqual(["ana-a"])
  expect(second.next).toBeNull()
  expect(await automationRuns("one", { search: "Alex", cursor: first.next! })).toEqual(EMPTY)
  expect(await automationRuns("one", { cursor: first.next! })).toEqual(EMPTY)
  const unfiltered = await automationRuns("one", {})
  expect(unfiltered.next).not.toBeNull()
  expect(await automationRuns("one", { search: "Ana", cursor: unfiltered.next! })).toEqual(EMPTY)
})

test("legacy owner cursors without a search scope are rejected", async () => {
  await seedAutomations()
  await addRun("a", { customerName: "Ana" })
  const cursor = Buffer.from(JSON.stringify({ businessId: "one", automationId: null, state: null, at: AT, id: "z" })).toString("base64url")
  expect(await automationRuns("one", { cursor })).toEqual(EMPTY)
  expect(await automationRuns("one", { cursor, search: "Ana" })).toEqual(EMPTY)
})

test.each([null, 42, true, [], {}])("invalid search type %j is rejected after checking ownership", async (search) => {
  await seedAutomations()
  await addRun("a")
  const filter = { search } as unknown as Parameters<typeof automationRuns>[1]
  expect(await automationRuns("one", filter)).toEqual(EMPTY)
  expect(ownerCheck).toHaveBeenCalledWith("one")
  ownerCheck.mockRejectedValueOnce(new Error("not owned"))
  await expect(automationRuns("two", filter)).rejects.toThrow("not owned")
})
