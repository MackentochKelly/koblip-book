// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { koblipNotificationTexts, platformSettingChanges, user } from "@/lib/db/schema"
import type { MessageButton } from "../types/notifications"
import { defaultWording, type BookingMessage, type TemplateLanguage } from "../utils/booking-templates"
import { ChatApiError } from "./chat-oauth"
import { submitKoblipTemplate } from "./chat-templates"

vi.mock("server-only", () => ({}))
// Book's words in Portuguese and French come from the app's words.
const { registerEnglishWords } = await import("@/lib/translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { allBookWords } = await import("./message-words")
// Book's words as the server reads them: Spanish from the migrated
// database, Portuguese and French in English until Google's arrive.
let book: Awaited<ReturnType<typeof allBookWords>>
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({ requireAdmin: vi.fn() }))
vi.mock("./chat-templates", () => ({ submitKoblipTemplate: vi.fn() }))

const { saveKoblipMessage, submitKoblipMessage } = await import("./koblip-template-actions")
const admin = { userId: "admin", name: "Admin", email: "admin@example.com", phone: null, contact: "admin@example.com", image: null, emailVerified: true, isGuest: false }
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-message-actions-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  book = await allBookWords()
  await db.$client.execute("PRAGMA foreign_keys = ON")
  await db.insert(user).values({ id: admin.userId, name: admin.name, email: admin.email, emailVerified: false })
})

beforeEach(async () => {
  vi.clearAllMocks()
  vi.mocked(requireAdmin).mockResolvedValue(admin)
  vi.mocked(submitKoblipTemplate).mockResolvedValue(null)
  await db.delete(koblipNotificationTexts)
  await db.delete(platformSettingChanges)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("saving and submitting require admin authorization before changing anything", async () => {
  const denied = new Error("Access denied")
  vi.mocked(requireAdmin).mockRejectedValue(denied)
  await expect(saveKoblipMessage("reminder", "en", defaultWording("reminder", book.en), null)).rejects.toThrow(denied)
  await expect(submitKoblipMessage("reminder", "en")).rejects.toThrow(denied)
  expect(await db.select().from(koblipNotificationTexts)).toEqual([])
  expect(await db.select().from(platformSettingChanges)).toEqual([])
  expect(submitKoblipTemplate).not.toHaveBeenCalled()
})

test("a save trims wording and buttons, records before and after, and never submits", async () => {
  const wording = defaultWording("reminder", book.en)
  const buttons: MessageButton[] = [{ action: "confirm", label: "Count me in" }]
  expect(await saveKoblipMessage("reminder", "en", {
    header: `  ${wording.header}  `,
    body: `\n ${wording.body} \n`,
    footer: ` ${wording.footer} `,
  }, [{ action: "confirm", label: "  Count me in  " }])).toEqual({ ok: true })
  expect(await db.select().from(koblipNotificationTexts)).toEqual([
    expect.objectContaining({ message: "reminder", language: "en", ...wording, buttons }),
  ])
  const next = { ...wording, header: "Your appointment is coming" }
  expect(await saveKoblipMessage("reminder", "en", next, null)).toEqual({ ok: true })
  const changes = await db.select().from(platformSettingChanges)
  expect(changes).toEqual([
    expect.objectContaining({ key: "whatsapp.koblipWording.reminder.en", before: null, after: { ...wording, buttons }, changedBy: "admin" }),
    expect.objectContaining({ key: "whatsapp.koblipWording.reminder.en", before: { ...wording, buttons }, after: { ...next, buttons: null }, changedBy: "admin" }),
  ])
  expect(submitKoblipTemplate).not.toHaveBeenCalled()
  expect(revalidatePath).toHaveBeenCalledWith("/admin/whatsapp/koblip-messages")
})

test("Use default removes both wording and buttons in one language and logs its former saved value", async () => {
  const en = defaultWording("reminder", book.en)
  const es = defaultWording("reminder", book.es)
  const buttons: MessageButton[] = [{ action: "ok", label: "Understood" }]
  await saveKoblipMessage("reminder", "en", en, buttons)
  await saveKoblipMessage("reminder", "es", es, [])
  expect(await saveKoblipMessage("reminder", "en", null, [{ action: "confirm", label: "Ignored" }])).toEqual({ ok: true })
  expect(await db.select().from(koblipNotificationTexts)).toEqual([
    expect.objectContaining({ message: "reminder", language: "es", ...es, buttons: [] }),
  ])
  const changes = await db.select().from(platformSettingChanges)
  expect(changes.at(-1)).toMatchObject({ before: { ...en, buttons }, after: null, changedBy: "admin" })
})

test("invalid wording and buttons cannot overwrite the saved message or add a change-log entry", async () => {
  const wording = defaultWording("reminder", book.en)
  await saveKoblipMessage("reminder", "en", wording, null)
  expect(await saveKoblipMessage("reminder", "en", { ...wording, body: " " }, null)).toEqual({ ok: false, error: "empty" })
  expect(await saveKoblipMessage("reminder", "en", { ...wording, body: "Hello {unknown}, your appointment awaits you here." }, null)).toEqual({ ok: false, error: "unknownField" })
  expect(await saveKoblipMessage("reminder", "en", wording, [{ action: "confirm", label: "*Yes*" }])).toEqual({ ok: false, error: "badButton" })
  expect(await saveKoblipMessage("reminder", "en", wording, [{ action: "confirm", label: "Yes" }, { action: "confirm", label: "Sure" }])).toEqual({ ok: false, error: "sameButton" })
  expect(await db.select().from(koblipNotificationTexts)).toEqual([expect.objectContaining({ ...wording, buttons: null })])
  expect(await db.select().from(platformSettingChanges)).toHaveLength(1)
  expect(submitKoblipTemplate).not.toHaveBeenCalled()
})

test("unknown messages and languages are refused without persisting a record", async () => {
  const wording = defaultWording("reminder", book.en)
  const badMessage = await saveKoblipMessage("missing" as BookingMessage, "en", wording, null)
  const badLanguage = await saveKoblipMessage("reminder", "de" as TemplateLanguage, wording, null)
  expect(badMessage.ok).toBe(false)
  expect(badLanguage.ok).toBe(false)
  expect(await db.select().from(koblipNotificationTexts)).toEqual([])
  expect(await db.select().from(platformSettingChanges)).toEqual([])
})

test("a failed change-log write rolls the saved wording back", async () => {
  const wording = defaultWording("reminder", book.en)
  await saveKoblipMessage("reminder", "en", wording, null)
  vi.mocked(requireAdmin).mockResolvedValue({ ...admin, userId: "missing-admin" })
  await expect(saveKoblipMessage("reminder", "en", { ...wording, header: "Must not persist" }, [])).rejects.toThrow()
  expect(await db.select().from(koblipNotificationTexts)).toEqual([expect.objectContaining({ ...wording, buttons: null })])
  expect(await db.select().from(platformSettingChanges)).toHaveLength(1)
})

test.each(["Meta refuses this wording", null])("submit returns Chat's reason unchanged: %s", async (reason) => {
  vi.mocked(submitKoblipTemplate).mockRejectedValueOnce(new ChatApiError(400, "rejected", reason))
  const errorLog = vi.spyOn(console, "error").mockImplementation(() => {})
  try {
    expect(await submitKoblipMessage("reminder", "es")).toEqual({ ok: false, error: "chat", reason })
    expect(submitKoblipTemplate).toHaveBeenCalledWith("reminder", "es", "admin")
    expect(revalidatePath).not.toHaveBeenCalled()
  } finally {
    errorLog.mockRestore()
  }
})
