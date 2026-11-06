// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import { TRANSLATION_LANGUAGES } from "./languages"
import type { Translator } from "./provider"
import { TRANSLATION_RULES } from "./rules"

vi.mock("server-only", () => ({}))

const { requestBatches, runTranslationQueue, syncTexts } = await import(
  "./queue"
)

let dir: string
let closeDb: () => void
let db: (typeof import("@/lib/db"))["db"]

const NOW = new Date("2026-11-06T12:00:00.000Z")
const at = (minutes: number) => () => new Date(NOW.getTime() + minutes * 60_000)

// Google stand-in: "ES:" before the text, kept parts untouched.
function google(answer?: (html: string) => string): Translator & {
  calls: string[][]
} {
  const calls: string[][] = []
  return {
    name: "google",
    calls,
    async translate(htmls) {
      calls.push(htmls)
      return htmls.map(answer ?? ((html) => `ES:${html}`))
    },
  }
}

function broken(): Translator & { calls: number } {
  const translator = {
    name: "google" as const,
    calls: 0,
    async translate(): Promise<string[]> {
      translator.calls += 1
      throw new Error("Google is down")
    },
  }
  return translator
}

async function entry(businessId: string, key: string) {
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.businessId, businessId),
        eq(translationEntries.key, key),
        eq(translationEntries.language, "es")
      )
    )
  return row
}

// The queue's work on one language, Spanish; every language goes the same
// way (the last tests save in all of them).
function sync(businessId: string, texts: Record<string, string>, removeMissing = false) {
  return syncTexts({
    scope: "business",
    businessId,
    removeMissing,
    languages: ["es"],
    items: Object.entries(texts).map(([key, text]) => ({
      key,
      module: "service.name",
      text,
    })),
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translation-queue-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  ;({ db } = await import("@/lib/db"))
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  for (const id of ["biz-a", "biz-b"]) {
    await db.insert(businesses).values({
      id,
      slug: id,
      name: id,
      timezone: "America/New_York",
      currency: "USD",
      ownerId: "u1",
    })
  }
})

beforeEach(async () => {
  await db.delete(translationHistory)
  await db.delete(translationEntries)
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a new text waits, then Google's translation is shown", async () => {
  expect(await sync("biz-a", { "s1:service.name": "Haircut" })).toEqual({
    added: 1,
    changed: 0,
    removed: 0,
  })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "pending",
    text: null,
  })
  const translator = google()
  const result = await runTranslationQueue({ now: at(0), translator })
  expect(result).toMatchObject({ translated: 1, characters: "Haircut".length })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "automatic",
    origin: "google",
    text: "ES:Haircut",
    machineText: "ES:Haircut",
    attempts: 0,
  })
  const history = await db.select().from(translationHistory)
  expect(history).toMatchObject([
    { action: "google", characters: 7, after: "ES:Haircut" },
  ])
})

test("without Google set up, texts keep waiting", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  expect(
    await runTranslationQueue({ now: at(0), translator: null })
  ).toMatchObject({ status: "not_set_up", translated: 0 })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "pending",
  })
})

test("changed English is translated again; unchanged English is not", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  await runTranslationQueue({ now: at(0), translator: google() })
  expect(await sync("biz-a", { "s1:service.name": "Haircut" })).toEqual({
    added: 0,
    changed: 0,
    removed: 0,
  })
  expect(await sync("biz-a", { "s1:service.name": "Long haircut" })).toEqual({
    added: 0,
    changed: 1,
    removed: 0,
  })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "pending",
    text: "ES:Haircut",
  })
  await runTranslationQueue({ now: at(0), translator: google() })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "automatic",
    text: "ES:Long haircut",
  })
})

test("an edited translation is never overwritten; changed English needs review", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  await runTranslationQueue({ now: at(0), translator: google() })
  await db
    .update(translationEntries)
    .set({ status: "edited", origin: "manual", text: "Corte de pelo" })
  await sync("biz-a", { "s1:service.name": "Long haircut" })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "needs_review",
    text: "Corte de pelo",
    sourceText: "Long haircut",
  })
  const translator = google()
  await runTranslationQueue({ now: at(0), translator })
  expect(translator.calls).toEqual([])
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "needs_review",
    text: "Corte de pelo",
  })
})

test("Google's earlier translation of the same English is reused, free", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  await runTranslationQueue({ now: at(0), translator: google() })
  await sync("biz-b", { "s2:service.name": "Haircut" })
  const translator = google()
  const result = await runTranslationQueue({ now: at(0), translator })
  expect(translator.calls).toEqual([])
  expect(result).toMatchObject({ reused: 1, translated: 0, characters: 0 })
  expect(await entry("biz-b", "s2:service.name")).toMatchObject({
    status: "automatic",
    text: "ES:Haircut",
  })
})

test("a failed try waits 1, 5, 30 and 120 minutes, then shows Failed", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  const translator = broken()
  let minutes = 0
  for (const wait of TRANSLATION_RULES.retryMinutes) {
    const result = await runTranslationQueue({ now: at(minutes), translator })
    expect(result).toMatchObject({ retrying: 1, failed: 0 })
    // Not due again before its wait.
    await runTranslationQueue({ now: at(minutes + wait - 0.5), translator })
    minutes += wait
  }
  expect(translator.calls).toBe(TRANSLATION_RULES.retryMinutes.length)
  const last = await runTranslationQueue({ now: at(minutes), translator })
  expect(last).toMatchObject({ retrying: 0, failed: 1 })
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "failed",
    attempts: TRANSLATION_RULES.retryMinutes.length + 1,
    lastError: "Google is down",
    nextAttemptAt: null,
  })
  const history = await db.select().from(translationHistory)
  expect(history.map((row) => row.action)).toEqual(["failed"])
})

test("a translation that loses a field is not used and is tried again", async () => {
  await sync("biz-a", { "p1:policy.body": "Cancel by {time}" })
  const result = await runTranslationQueue({
    now: at(0),
    translator: google(() => "Cancela antes"),
  })
  expect(result).toMatchObject({ translated: 0, retrying: 1 })
  expect(await entry("biz-a", "p1:policy.body")).toMatchObject({
    status: "pending",
    text: null,
    lastError: "Google changed a field, link or email",
  })
  // Billed all the same.
  const [billed] = await db.select().from(translationHistory)
  expect(billed).toMatchObject({
    action: "google",
    characters: 'Cancel by <span translate="no">{time}</span>'.length,
  })
})

test("English changed while Google worked: the old translation is not saved", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut" })
  const translator: Translator = {
    name: "google",
    async translate(htmls) {
      await sync("biz-a", { "s1:service.name": "Beard trim" })
      return htmls.map((html) => `ES:${html}`)
    },
  }
  const result = await runTranslationQueue({ now: at(0), translator })
  expect(result.translated).toBe(0)
  expect(await entry("biz-a", "s1:service.name")).toMatchObject({
    status: "pending",
    sourceText: "Beard trim",
    text: null,
  })
})

test("past a business's daily limit, the rest waits for the next day", async () => {
  const text = "x".repeat(4_500)
  const texts = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [`s${index}:service.description`, `${index} ${text}`])
  )
  await sync("biz-a", texts)
  // 11 texts of about 4,500 fit in 50,000 characters; the 12th does not.
  expect(TRANSLATION_RULES.dailyBusinessCharacters).toBe(50_000)
  const result = await runTranslationQueue({ now: at(0), translator: google() })
  expect(result).toMatchObject({ translated: 11, deferred: 1 })
  const waiting = await db
    .select()
    .from(translationEntries)
    .where(eq(translationEntries.status, "pending"))
  expect(waiting).toHaveLength(1)
  expect(waiting[0].nextAttemptAt).toBe("2026-11-07T00:00:00.000Z")
})

test("removed texts go; their history stays", async () => {
  await sync("biz-a", { "s1:service.name": "Haircut", "s2:service.name": "Shave" })
  await runTranslationQueue({ now: at(0), translator: google() })
  expect(await sync("biz-a", { "s1:service.name": "Haircut" }, true)).toEqual({
    added: 0,
    changed: 0,
    removed: 1,
  })
  expect(await entry("biz-a", "s2:service.name")).toBeUndefined()
  const history = await db.select().from(translationHistory)
  expect(history).toHaveLength(2)
  expect(history.filter((row) => row.entryId === null)).toHaveLength(1)
})

test("requests stay within Google's recommended size", () => {
  const texts = [
    ...Array.from({ length: 150 }, () => ({ characters: 10 })),
    { characters: 4_000 },
    { characters: 4_000 },
    { characters: 9_000 },
  ]
  const batches = requestBatches(texts)
  // 100 texts at most; then 50 short ones and a 4,000 one share a request.
  expect(batches.map((batch) => batch.length)).toEqual([100, 51, 1, 1])
})

test("a save waits in every language, each sent to Google in its own code", async () => {
  expect(
    await syncTexts({
      scope: "business",
      businessId: "biz-a",
      items: [{ key: "s1:service.name", module: "service.name", text: "Haircut" }],
    })
  ).toEqual({ added: TRANSLATION_LANGUAGES.length, changed: 0, removed: 0 })
  const codes: string[] = []
  const translator: Translator = {
    name: "google",
    async translate(htmls, googleLanguage) {
      codes.push(googleLanguage)
      return htmls.map((html) => `${googleLanguage}:${html}`)
    },
  }
  expect(await runTranslationQueue({ now: at(0), translator })).toMatchObject({
    translated: TRANSLATION_LANGUAGES.length,
  })
  expect(codes.sort()).toEqual(["es", "fr-FR", "pt-BR"])
  const rows = await db
    .select({ language: translationEntries.language, text: translationEntries.text })
    .from(translationEntries)
    .orderBy(translationEntries.language)
  expect(rows).toEqual([
    { language: "es", text: "es:Haircut" },
    { language: "fr", text: "fr-FR:Haircut" },
    { language: "pt", text: "pt-BR:Haircut" },
  ])
})
