// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq, sql } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  automationEvents,
  automationPauses,
  automationRuns,
  automations,
  businesses,
  platformSettings,
  user,
} from "@/lib/db/schema"
import { AUTOMATION_RULES, automationRules, notificationRules } from "@/lib/platform-settings"
import { welcomeDefaults } from "../utils/automation-defaults"
import { automationProblem } from "../utils/automation-rules"

vi.mock("server-only", () => ({}))
// Book's words in Portuguese and French come from the app's words.
const { registerEnglishWords } = await import("@/lib/translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { welcomeWords } = await import("./message-words")
// Book's Welcome flow as the server reads it: Spanish from the migrated
// database, Portuguese and French in English until Google's arrive.
let words: Awaited<ReturnType<typeof welcomeWords>>
const defaults = () => welcomeDefaults(words)
const { readAutomations } = await import("./automation-data")
let dir: string
const NOW = "2026-10-31T20:00:00.000Z"
const LATER = "2026-11-01T20:00:00.000Z"

async function createBusinesses() {
  await db.insert(businesses).values([
    { id: "one", slug: "one", name: "First business", timezone: "America/New_York", currency: "USD" },
    { id: "two", slug: "two", name: "Second business", timezone: "America/New_York", currency: "USD" },
  ])
}

function run(businessId: string, automationId: string) {
  return {
    businessId, automationId, workspaceId: "workspace", phoneNumberId: "number",
    eventId: "event", customerPhone: "15551234567", customerName: "Customer",
    language: "en" as const, step: "welcome" as const, state: "sent" as const,
    chatRecordId: `record-${businessId}`, chatMessageId: `message-${businessId}`,
  }
}

function event(businessId: string, workspaceId = "workspace", eventId = "event") {
  return { businessId, workspaceId, phoneNumberId: "number", eventId, occurredAt: NOW }
}

function pause(businessId: string, phoneNumberId = "number", customerPhone = "15551234567") {
  return { businessId, workspaceId: "workspace", phoneNumberId, customerPhone, until: LATER }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "book-automation-data-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  words = await welcomeWords()
  await db.$client.execute("PRAGMA foreign_keys = ON")
  await db.insert(user).values({ id: "admin", name: "Admin", email: "automation-admin@example.com", emailVerified: true })
})

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOW)
  await db.delete(businesses)
  await db.delete(platformSettings)
  await createBusinesses()
})

afterAll(() => {
  vi.useRealTimers()
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a missing business has no automations and cannot create an orphaned welcome", async () => {
  expect(await readAutomations("missing")).toEqual([])
  expect(await db.select().from(automations)).toEqual([])
})

test("first read stores one disabled welcome with complete defaults in every language", async () => {
  const [welcome] = await readAutomations("one")
  // Portuguese and French are Google's; with none yet they read the English.
  const english = { body: "Thanks for writing to {business}! Choose an option to get help faster.", handoffReply: "Got it, someone will answer you soon.", servicesIntro: "Choose a service to book." }
  expect(welcome).toEqual({
    id: expect.any(String), trigger: "firstMessage", on: false,
    wording: {
      en: english,
      es: { body: "¡Gracias por escribir a {business}! Elige una opción para ayudarte más rápido.", handoffReply: "Entendido, alguien te responderá pronto.", servicesIntro: "Elige un servicio para reservar." },
      pt: english,
      fr: english,
    },
    buttons: [
      { id: "welcome-booking", label: { en: "Book now", es: "Reservar", pt: "Book now", fr: "Book now" }, action: { type: "bookingLink" } },
      { id: "welcome-services", label: { en: "Our services", es: "Nuestros servicios", pt: "Our services", fr: "Our services" }, action: { type: "servicesList" } },
      { id: "welcome-handoff", label: { en: "Talk to us", es: "Hablar con nosotros", pt: "Talk to us", fr: "Talk to us" }, action: { type: "handoff" } },
    ],
    isDefault: true, updatedAt: NOW,
  })
  expect(automationProblem(welcome, await automationRules())).toBeNull()
  expect(await db.select().from(automations)).toEqual([
    expect.objectContaining({ businessId: "one", key: "welcome", id: welcome.id, createdAt: NOW, updatedAt: NOW }),
  ])
})

test("simultaneous first reads create one welcome and preserve its identities and timestamp on later reads", async () => {
  const results = await Promise.all(Array.from({ length: 6 }, () => readAutomations("one")))
  const first = results[0]
  expect(results).toEqual(Array.from({ length: 6 }, () => first))
  expect(await db.select().from(automations)).toHaveLength(1)
  vi.setSystemTime(LATER)
  expect(await readAutomations("one")).toEqual(first)
  expect((await db.select().from(automations))[0]).toMatchObject({ createdAt: NOW, updatedAt: NOW })
})

test("later reads preserve saved wording, reordered button identities, on/off and custom status", async () => {
  const [first] = await readAutomations("one")
  vi.setSystemTime(LATER)
  const wording = structuredClone(first.wording)
  wording.en.body = "Hello from {business}, how can we help?"
  wording.es.handoffReply = "Nuestro equipo te responderá pronto."
  const buttons = [...first.buttons].reverse()
  buttons[0] = { ...buttons[0], label: { ...buttons[0].label, en: "Our team", es: "Nuestro equipo" } }
  await db.update(automations).set({ wording, buttons, on: true, isDefault: false }).where(eq(automations.id, first.id))
  const expected = { ...first, wording, buttons, on: true, isDefault: false, updatedAt: LATER }
  vi.setSystemTime("2026-11-02T20:00:00.000Z")
  expect(await readAutomations("one")).toEqual([expected])
  expect((await db.select().from(automations))[0].updatedAt).toBe(LATER)
})

test("businesses receive separate rows and edits never leak into another business", async () => {
  const [[one], [two]] = await Promise.all([readAutomations("one"), readAutomations("two")])
  expect(one.id).not.toBe(two.id)
  await db.update(automations).set({ on: true, isDefault: false }).where(eq(automations.id, one.id))
  expect(await readAutomations("two")).toEqual([two])
  expect((await readAutomations("one"))[0]).toMatchObject({ id: one.id, on: true, isDefault: false })
})

test("reads return additional stored automations without overwriting them or adding another welcome", async () => {
  const [welcome] = await readAutomations("one")
  const book = defaults()
  const wording = { ...book.wording, en: { ...book.wording.en, body: "More help from {business}." } }
  await db.insert(automations).values({ id: "future", businessId: "one", key: "future-flow", trigger: "firstMessage", ...book, wording, on: true, isDefault: false })
  const flows = await readAutomations("one")
  expect(flows).toHaveLength(2)
  expect(flows).toEqual(expect.arrayContaining([
    welcome,
    expect.objectContaining({ id: "future", wording, on: true, isDefault: false }),
  ]))
  expect((await db.select().from(automations)).filter((row) => row.key === "welcome")).toHaveLength(1)
})

test("deleting a business cascades through all four automation tables and preserves another business", async () => {
  for (const businessId of ["one", "two"]) {
    const [automation] = await readAutomations(businessId)
    await db.insert(automationRuns).values(run(businessId, automation.id))
    await db.insert(automationEvents).values(event(businessId))
    await db.insert(automationPauses).values(pause(businessId))
  }
  await db.delete(businesses).where(eq(businesses.id, "one"))
  for (const table of [automations, automationRuns, automationEvents, automationPauses]) {
    expect(await db.select({ businessId: table.businessId }).from(table)).toEqual([{ businessId: "two" }])
  }
})

test("a run cannot reference another business's automation and deleting an automation removes its runs", async () => {
  const [one] = await readAutomations("one")
  const [two] = await readAutomations("two")
  await expect(db.insert(automationRuns).values(run("one", two.id))).rejects.toThrow()
  expect(await db.select().from(automationRuns)).toEqual([])
  await db.insert(automationRuns).values(run("one", one.id))
  await db.delete(automations).where(eq(automations.id, one.id))
  expect(await db.select().from(automationRuns)).toEqual([])
  expect(await readAutomations("two")).toEqual([two])
})

test("event claims dedupe one business and workspace while allowing other businesses or workspaces", async () => {
  const claims = await Promise.all(Array.from({ length: 5 }, () => db.insert(automationEvents)
    .values(event("one")).onConflictDoNothing().returning({ eventId: automationEvents.eventId })))
  expect(claims.flat()).toEqual([{ eventId: "event" }])
  await expect(db.insert(automationEvents).values(event("one"))).rejects.toThrow()
  await db.insert(automationEvents).values([event("two"), event("one", "other-workspace"), event("one", "workspace", "other-event")])
  expect(await db.select().from(automationEvents)).toHaveLength(4)
})

test("handoff pauses are isolated by business, workspace, number and customer", async () => {
  await db.insert(automationPauses).values([
    pause("one"), pause("two"), pause("one", "other-number"), pause("one", "number", "15557654321"),
    { ...pause("one"), workspaceId: "other-workspace" },
  ])
  await expect(db.insert(automationPauses).values(pause("one"))).rejects.toThrow()
  expect(await db.select().from(automationPauses)).toHaveLength(5)
  await db.delete(businesses).where(eq(businesses.id, "one"))
  expect(await db.select().from(automationPauses)).toEqual([expect.objectContaining(pause("two"))])
})

test("automation rule defaults stay separate from booking template button limits", async () => {
  expect(await automationRules()).toEqual(AUTOMATION_RULES)
  expect((await notificationRules()).maxButtonLabel).toBe(25)
  expect((await automationRules()).maxButtonLabel).toBe(20)
})

test("automation rules load valid namespaced overrides without changing booking template limits", async () => {
  await db.insert(platformSettings).values([
    { key: "automation.maxButtonLabel", value: 12, updatedBy: "admin" },
    { key: "automation.maxListRows", value: 7, updatedBy: "admin" },
    { key: "automation.welcomeAgainDays", value: 0, updatedBy: "admin" },
    { key: "automation.handoffQuietHours", value: 48, updatedBy: "admin" },
    { key: "automation.unknownRule", value: 1, updatedBy: "admin" },
  ])
  expect(await automationRules()).toEqual({ ...AUTOMATION_RULES, maxButtonLabel: 12, maxListRows: 7, welcomeAgainDays: 0, handoffQuietHours: 48 })
  expect((await notificationRules()).maxButtonLabel).toBe(25)
})

const cappedRules = Object.entries(AUTOMATION_RULES).filter(([key]) => key !== "welcomeAgainDays" && key !== "handoffQuietHours")
test.each(cappedRules)("automation.%s cannot exceed its Meta cap of %s", async (key, maximum) => {
  await db.insert(platformSettings).values({ key: `automation.${key}`, value: maximum + 1, updatedBy: "admin" })
  expect(await automationRules()).toEqual(AUTOMATION_RULES)
})

test.each([0, -1, 1.5, "12", null])("invalid automation limit %s falls back to its default", async (value) => {
  await db.insert(platformSettings).values({ key: "automation.maxButtonLabel", value: value === null ? sql`'null'` : value, updatedBy: "admin" })
  expect((await automationRules()).maxButtonLabel).toBe(20)
})

test.each([-1, 1.5, "24", null])("invalid automation timing %s falls back to its default", async (value) => {
  await db.insert(platformSettings).values([
    { key: "automation.welcomeAgainDays", value: value === null ? sql`'null'` : value, updatedBy: "admin" },
    { key: "automation.handoffQuietHours", value: value === null ? sql`'null'` : value, updatedBy: "admin" },
  ])
  expect(await automationRules()).toEqual(AUTOMATION_RULES)
})
