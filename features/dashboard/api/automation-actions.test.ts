// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { automations, businesses, chatConnections, koblipChatConnection, platformSettings, user } from "@/lib/db/schema"
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
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("Not found") } }))
vi.mock("@/lib/dal", () => ({ requireOwner: vi.fn() }))
const { saveAutomation, setAutomationOn } = await import("./automation-actions")
const owner = { userId: "owner", name: "Owner", email: "owner@example.test", phone: null, contact: "owner@example.test", image: null, emailVerified: true, isGuest: false }
let dir: string
const row = async (id = "welcome-a") => (await db.select().from(automations).where(eq(automations.id, id)))[0]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-automation-actions-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  words = await welcomeWords()
  await db.insert(user).values([
    { id: "owner", name: "Owner", email: "owner@example.test", emailVerified: true },
    { id: "other-owner", name: "Other", email: "other@example.test", emailVerified: true },
  ])
  await db.insert(businesses).values([
    { id: "a", slug: "a", name: "A", timezone: "UTC", currency: "USD", ownerId: "owner" },
    { id: "b", slug: "b", name: "B", timezone: "UTC", currency: "USD", ownerId: "other-owner" },
  ])
})

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(requireOwner).mockResolvedValue(owner)
  await db.delete(automations)
  await db.delete(chatConnections)
  await db.delete(koblipChatConnection)
  await db.delete(platformSettings)
  await db.insert(automations).values([
    { id: "welcome-a", businessId: "a", key: "welcome", trigger: "firstMessage", on: false, ...defaults(), isDefault: true },
    { id: "welcome-b", businessId: "b", key: "welcome", trigger: "firstMessage", on: false, ...defaults(), isDefault: true },
  ])
  await db.insert(chatConnections).values({ businessId: "a", workspaceId: "own", workspaceName: "Own", scopes: "contacts templates conversations automations", accessToken: "sealed-access", refreshToken: "sealed-refresh", accessExpiresAt: "2099-01-01T00:00:00.000Z", phoneNumberId: "own-number", wabaId: "own-waba" })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("an unauthenticated owner gets not_found without data changes or thrown UI errors", async () => {
  const before = await row()
  vi.mocked(requireOwner).mockRejectedValue(new Error("Sign in required"))
  expect(await saveAutomation("a", "welcome-a", defaults())).toEqual({ ok: false, error: "not_found" })
  expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: false, error: "not_found" })
  expect(await row()).toEqual(before)
  expect(revalidatePath).not.toHaveBeenCalled()
})

test("business ownership and the automation's business are both checked", async () => {
  const beforeA = await row()
  const beforeB = await row("welcome-b")
  expect(await saveAutomation("b", "welcome-b", defaults())).toEqual({ ok: false, error: "not_found" })
  expect(await setAutomationOn("b", "welcome-b", true)).toEqual({ ok: false, error: "not_found" })
  expect(await saveAutomation("a", "welcome-b", defaults())).toEqual({ ok: false, error: "not_found" })
  expect(await setAutomationOn("a", "welcome-b", true)).toEqual({ ok: false, error: "not_found" })
  expect(await row()).toEqual(beforeA)
  expect(await row("welcome-b")).toEqual(beforeB)
  expect(revalidatePath).not.toHaveBeenCalled()
})

test("unknown business and automation ids return not_found", async () => {
  expect(await saveAutomation("missing", "welcome-a", null)).toEqual({ ok: false, error: "not_found" })
  expect(await saveAutomation("a", "missing", null)).toEqual({ ok: false, error: "not_found" })
  expect(await setAutomationOn("a", "missing", true)).toEqual({ ok: false, error: "not_found" })
})

test("a custom save trims every language's words and labels while preserving button order, actions and ids", async () => {
  const input = defaults()
  input.wording.en.body = "  Welcome to {business}, we can help you today.  "
  input.wording.es.body = "  Bienvenido a {business}, podemos ayudarte hoy.  "
  input.wording.en.handoffReply = "  Someone will reply soon. "
  input.wording.es.servicesIntro = "  Elige un servicio. "
  input.buttons = [input.buttons[2], input.buttons[0]]
  input.buttons[0].label = { ...input.buttons[0].label, en: "  A person please  ", es: "  Una persona  " }
  expect(await saveAutomation("a", "welcome-a", input)).toEqual({ ok: true })
  const saved = await row()
  expect(saved).toMatchObject({ on: false, isDefault: false, wording: {
    en: { body: "Welcome to {business}, we can help you today.", handoffReply: "Someone will reply soon." },
    es: { body: "Bienvenido a {business}, podemos ayudarte hoy.", servicesIntro: "Elige un servicio." },
  } })
  expect(saved.buttons).toEqual([
    // Portuguese and French are Google's; with none yet they read the English.
    { id: "welcome-handoff", label: { en: "A person please", es: "Una persona", pt: "Talk to us", fr: "Talk to us" }, action: { type: "handoff" } },
    { id: "welcome-booking", label: { en: "Book now", es: "Reservar", pt: "Book now", fr: "Book now" }, action: { type: "bookingLink" } },
  ])
  expect((await row("welcome-b")).isDefault).toBe(true)
  expect(revalidatePath).toHaveBeenCalled()
})

test("Use default resets wording and buttons together while keeping on/off", async () => {
  const input = defaults()
  input.wording.en.body = "Custom greeting."
  input.buttons = [input.buttons[2]]
  await saveAutomation("a", "welcome-a", input)
  expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: true })
  expect(await saveAutomation("a", "welcome-a", null)).toEqual({ ok: true })
  expect(await row()).toMatchObject({ ...defaults(), on: true, isDefault: true })
})

test("validation returns the exact field and leaves persisted content unchanged", async () => {
  const before = await row()
  const unknownField = defaults()
  unknownField.wording.es.body = "Hola {customer}, podemos ayudarte hoy."
  expect(await saveAutomation("a", "welcome-a", unknownField)).toEqual({ ok: false, error: "badField", field: "wording.es.body" })
  const duplicateLabel = defaults()
  duplicateLabel.buttons[1].label.en = duplicateLabel.buttons[0].label.en
  expect(await saveAutomation("a", "welcome-a", duplicateLabel)).toEqual({ ok: false, error: "duplicateLabel", field: "buttons.1.label.en" })
  const paddedId = defaults()
  paddedId.buttons[0].id = " welcome-booking "
  expect(await saveAutomation("a", "welcome-a", paddedId)).toEqual({ ok: false, error: "badField", field: "buttons.0.id" })
  expect(await row()).toEqual(before)
  expect(revalidatePath).not.toHaveBeenCalled()
})

test("stored stricter rules apply to saves and enabling existing content", async () => {
  await db.insert(platformSettings).values({ key: "automation.maxButtonLabel", value: 5 })
  const before = await row()
  expect(await saveAutomation("a", "welcome-a", defaults())).toEqual({ ok: false, error: "tooLong", field: "buttons.0.label.en" })
  expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: false, error: "tooLong", field: "buttons.0.label.en" })
  expect(await row()).toEqual(before)
})

test.each([
  { name: "no phone", values: { phoneNumberId: null } },
  { name: "reconnect needed", values: { needsReconnect: true } },
  { name: "no access token", values: { accessToken: null } },
  { name: "no refresh token", values: { refreshToken: null } },
  { name: "no conversations scope", values: { scopes: "contacts templates automations" } },
  { name: "no templates scope", values: { scopes: "contacts conversations automations" } },
])("$name cannot use the shared number as an own connection", async ({ values }) => {
  await db.update(chatConnections).set(values).where(eq(chatConnections.businessId, "a"))
  const before = await row()
  expect(await saveAutomation("a", "welcome-a", defaults())).toEqual({ ok: true })
  expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: false, error: "noOwnNumber" })
  expect(await row()).toMatchObject({ wording: before.wording, buttons: before.buttons, on: before.on, isDefault: false })
})

test("Koblip's shared connection alone never qualifies as the business's own number", async () => {
  await db.delete(chatConnections)
  await db.insert(koblipChatConnection).values({ id: "koblip", workspaceId: "shared", workspaceName: "Shared", scopes: "templates conversations contacts automations", accessToken: "sealed-access", refreshToken: "sealed-refresh", phoneNumberId: "shared-number" })
  expect(await saveAutomation("a", "welcome-a", defaults())).toEqual({ ok: true })
  expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: false, error: "noOwnNumber" })
})

test.each([undefined, false, "wording", [], {}, { wording: null, buttons: [] }, { type: "button", body: "Hello", buttons: [{ id: "a", label: "Pick" }] }])("malformed saved input returns invalid without throwing: %#", async (input) => {
  const before = await row()
  expect(await saveAutomation("a", "welcome-a", input as unknown as Parameters<typeof saveAutomation>[2])).toMatchObject({ ok: false, error: "invalid" })
  expect(await row()).toEqual(before)
})

test.each([null, undefined, 1, "true", [], {}])("a nonboolean switch value is invalid: %#", async (input) => {
  const before = await row()
  expect(await setAutomationOn("a", "welcome-a", input as boolean)).toMatchObject({ ok: false, error: "invalid" })
  expect(await row()).toEqual(before)
})

test("failed database writes return invalid without exposing the error or changing data", async () => {
  const before = await row()
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
  await db.$client.execute("CREATE TRIGGER reject_automation_update BEFORE UPDATE ON automations BEGIN SELECT RAISE(ABORT, 'private database detail'); END")
  try {
    expect(await saveAutomation("a", "welcome-a", defaults())).toEqual({ ok: false, error: "invalid" })
    expect(await setAutomationOn("a", "welcome-a", true)).toEqual({ ok: false, error: "invalid" })
    expect(await row()).toEqual(before)
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(errorLog).not.toHaveBeenCalled()
  } finally {
    await db.$client.execute("DROP TRIGGER reject_automation_update")
    errorLog.mockRestore()
  }
})


test("a rendered-message discriminator cannot bypass saved wording validation", async () => {
  const input = defaults()
  input.wording.en.body = "Hello {customer}."
  const disguised = { ...input, type: "button", body: "A valid rendered body.",
    buttons: input.buttons }
  expect(await saveAutomation("a", "welcome-a", disguised)).toEqual({ ok: false, error: "badField", field: "wording.en.body" })
  expect((await row()).isDefault).toBe(true)
})


test("saving and resetting work without an own number and preserve the switch", async () => {
  await db.delete(chatConnections)
  await db.update(automations).set({ on: true }).where(eq(automations.id, "welcome-a"))
  const custom = defaults()
  custom.wording.en.body = "Welcome, we can help you today."
  custom.buttons = [custom.buttons[2]]
  expect(await saveAutomation("a", "welcome-a", custom)).toEqual({ ok: true })
  expect(await row()).toMatchObject({ ...custom, isDefault: false, on: true })
  expect(await saveAutomation("a", "welcome-a", null)).toEqual({ ok: true })
  expect(await row()).toMatchObject({ ...defaults(), isDefault: true, on: true })
})

test("turning off works after losing the connection and narrowing rules below saved content", async () => {
  await db.update(automations).set({ on: true }).where(eq(automations.id, "welcome-a"))
  await db.delete(chatConnections)
  await db.insert(platformSettings).values({ key: "automation.maxButtonLabel", value: 1 })
  expect(await setAutomationOn("a", "welcome-a", false)).toEqual({ ok: true })
  expect((await row()).on).toBe(false)
  expect(revalidatePath).toHaveBeenCalled()
  expect(await setAutomationOn("b", "welcome-b", false)).toEqual({ ok: false, error: "not_found" })
})
