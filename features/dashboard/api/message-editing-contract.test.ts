// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  chatConnections,
  chatTemplates,
  koblipChatTemplates,
  koblipNotificationTexts,
  notificationTexts,
} from "@/lib/db/schema"
import type { MessageButton } from "../types/notifications"
import { defaultButtons, defaultWording, withExamples, type TemplateLanguage } from "../utils/booking-templates"

vi.mock("server-only", () => ({}))
const { registerEnglishWords } = await import("@/lib/translations/interface-words")
registerEnglishWords((await import("@/i18n/messages")).default)
const { allBookWords } = await import("./message-words")
// Book's words as the server reads them: Spanish from the migrated
// database, Portuguese and French in English until Google's arrive.
let book: Awaited<ReturnType<typeof allBookWords>>
const { koblipMessages, koblipSendableTemplate } = await import("./chat-templates")
const { notificationMessagesFor } = await import("./notifications")
let dir: string

const languages = ["en", "es"] as const
function submitted(language: TemplateLanguage) {
  return {
    header: language === "en" ? "Approved reminder" : "Recordatorio aprobado",
    body: language === "en" ? "Approved message for {name}: your appointment is at {business}." : "Mensaje aprobado para {name}: tu cita es en {business}.",
    footer: language === "en" ? "See you soon" : "Hasta pronto",
    buttons: [{ action: "confirm", label: language === "en" ? "Yes, coming" : "Sí, asistiré" }] as MessageButton[],
  }
}
function latest(language: TemplateLanguage) {
  return { ...submitted(language), header: language === "en" ? "Latest reminder" : "Último recordatorio", body: language === "en" ? "Latest saved message for {name} at {business}." : "Último mensaje guardado para {name} en {business}." }
}
function approvedView(language: (typeof languages)[number]) {
  const { buttons, ...wording } = submitted(language)
  return { wording, buttons, preview: withExamples(wording.body, book[language]) }
}
async function koblipText(language: TemplateLanguage) {
  return (await koblipMessages()).find((row) => row.message === "reminder")!.texts[language]
}
async function businessText(language: TemplateLanguage) {
  return (await notificationMessagesFor("biz")).find((row) => row.message === "reminder")!.texts[language]
}
async function connectOwn() {
  await db.insert(chatConnections).values({
    businessId: "biz",
    workspaceId: "own-workspace",
    workspaceName: "Shop",
    scopes: "contacts templates automations conversations",
    accessToken: "unused",
    refreshToken: "unused",
    accessExpiresAt: "2099-01-01T00:00:00.000Z",
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-message-contract-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  book = await allBookWords()
  await db.insert(businesses).values({ id: "biz", slug: "shop", name: "Shop", timezone: "America/Santo_Domingo", currency: "DOP" })
})

beforeEach(async () => {
  await db.delete(chatConnections)
  await db.delete(chatTemplates)
  await db.delete(notificationTexts)
  await db.delete(koblipChatTemplates)
  await db.delete(koblipNotificationTexts)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("unsaved Koblip messages expose defaults and no approved words in either language", async () => {
  for (const language of languages) {
    expect(await koblipText(language)).toMatchObject({ isDefault: true, wording: defaultWording("reminder", book[language]), buttons: defaultButtons("reminder", book[language]), approved: null })
    expect(await businessText(language)).toMatchObject({ isDefault: true, approved: null })
  }
})

test.each(["pending", "rejected"])("Koblip's %s next version preserves each language's approved v3 wording for admin and business", async (status) => {
  for (const language of languages) {
    const current = latest(language)
    await db.insert(koblipNotificationTexts).values({ message: "reminder", language, ...current })
    await db.insert(koblipChatTemplates).values({
      message: "reminder",
      language,
      version: 4,
      chatTemplateId: `review-${language}`,
      status,
      submitted: current,
      live: { chatTemplateId: `approved-${language}`, name: "koblip_booking_reminder_v3", submitted: submitted(language) },
    })
  }
  for (const language of languages) {
    const { buttons, ...wording } = latest(language)
    const expected = { wording, buttons, isDefault: false, approved: approvedView(language) }
    expect(await koblipText(language)).toMatchObject(expected)
    expect(await businessText(language)).toMatchObject(expected)
    expect((await notificationMessagesFor("biz")).find((row) => row.message === "reminder")!.editable).toBe(false)
  }
})

test("Use default changes the current words while custom approved words remain visible", async () => {
  for (const language of languages) {
    await db.insert(koblipNotificationTexts).values({ message: "reminder", language, ...submitted(language) })
    await db.insert(koblipChatTemplates).values({ message: "reminder", language, chatTemplateId: `approved-${language}`, status: "approved", version: 3, submitted: submitted(language) })
    expect((await koblipText(language)).isDefault).toBe(false)
  }
  await db.delete(koblipNotificationTexts)
  for (const language of languages) {
    const expected = { isDefault: true, wording: defaultWording("reminder", book[language]), buttons: defaultButtons("reminder", book[language]), approved: approvedView(language), review: "draft" }
    expect(await koblipText(language)).toMatchObject(expected)
    expect(await businessText(language)).toMatchObject(expected)
  }
})

test("a pending or refused first Koblip submission exposes no approved words", async () => {
  for (const [index, language] of languages.entries()) {
    await db.insert(koblipChatTemplates).values({ message: "reminder", language, chatTemplateId: `first-${language}`, status: index ? "rejected" : "pending", submitted: submitted(language) })
    expect((await koblipText(language)).approved).toBeNull()
    expect((await businessText(language)).approved).toBeNull()
  }
})

test("an editable business gets its own approved submitted words and sample values despite a newer draft", async () => {
  await connectOwn()
  for (const language of languages) {
    await db.insert(notificationTexts).values({ businessId: "biz", message: "reminder", language, ...latest(language) })
    await db.insert(chatTemplates).values({ businessId: "biz", message: "reminder", language, chatTemplateId: `own-${language}`, status: "approved", submitted: submitted(language) })
    const { buttons, ...wording } = latest(language)
    expect(await businessText(language)).toMatchObject({ wording, buttons, isDefault: false, review: "draft", approved: approvedView(language) })
  }
})

test("a business's own template under in-place review has no approved copy, independently in each language", async () => {
  await connectOwn()
  for (const [index, language] of languages.entries()) {
    await db.insert(chatTemplates).values({ businessId: "biz", message: "reminder", language, chatTemplateId: `own-${language}`, status: index ? "rejected" : "pending", submitted: submitted(language) })
    expect((await businessText(language)).approved).toBeNull()
  }
})


test("legacy templates without a recorded submission do not present reconstructed words as approved", async () => {
  await db.insert(koblipChatTemplates).values({
    message: "reminder", language: "en", chatTemplateId: "legacy", status: "approved",
  })
  expect((await koblipText("en")).approved).toBeNull()
  expect((await businessText("en")).approved).toBeNull()
  // Keep the sender's existing fallback while withholding unverified preview words.
  expect((await koblipSendableTemplate("reminder", "en")).approved?.template)
    .toMatchObject(defaultWording("reminder", book.en))
  await connectOwn()
  await db.insert(chatTemplates).values({ businessId: "biz", message: "reminder", language: "en", chatTemplateId: "legacy-own", status: "approved" })
  expect((await businessText("en")).approved).toBeNull()
})

test("an unrecorded legacy live snapshot remains unknown while a recorded replacement waits", async () => {
  await db.insert(koblipChatTemplates).values({
    message: "reminder", language: "en", chatTemplateId: "next", version: 3,
    status: "pending", submitted: latest("en"),
    live: { chatTemplateId: "legacy", name: "koblip_booking_reminder_v2", snapshotKnown: false,
      submitted: { ...defaultWording("reminder", book.en), buttons: defaultButtons("reminder", book.en) } },
  })
  expect((await koblipText("en")).approved).toBeNull()
  expect((await businessText("en")).approved).toBeNull()
})
