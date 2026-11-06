// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import type { Translator } from "./provider"

vi.mock("server-only", () => ({}))

const { editTranslation, resetTranslation, retryTranslation } = await import(
  "./edits"
)
const { runTranslationQueue, syncTexts } = await import("./queue")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

// Google stand-in: "ES:" before the text.
const google: Translator = {
  name: "google",
  async translate(htmls) {
    return htmls.map((html) => `ES:${html}`)
  },
}

async function entry() {
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(eq(translationEntries.key, "s1:service.name"))
  return row
}

async function history() {
  return db
    .select({
      action: translationHistory.action,
      before: translationHistory.before,
      after: translationHistory.after,
      changedBy: translationHistory.changedBy,
    })
    .from(translationHistory)
    .orderBy(translationHistory.id)
}

async function english(text: string) {
  await syncTexts({
    scope: "business",
    businessId: "biz",
    items: [{ key: "s1:service.name", module: "service.name", text }],
  })
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translation-edits-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  ;({ db } = await import("@/lib/db"))
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "admin",
    name: "Admin",
    email: "admin@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz",
    slug: "biz",
    name: "Shop",
    timezone: "America/New_York",
    currency: "USD",
    ownerId: "admin",
  })
})

beforeEach(async () => {
  await db.delete(translationHistory)
  await db.delete(translationEntries)
  await english("Haircut for {name}")
  await runTranslationQueue({ translator: google })
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("an admin's translation shows from now on, logged with who made it", async () => {
  const { id } = await entry()
  const result = await editTranslation({ id, text: " Corte para {name} ", userId: "admin" })
  expect(result.ok).toBe(true)
  expect(await entry()).toMatchObject({
    text: "Corte para {name}",
    status: "edited",
    origin: "manual",
  })
  expect((await history()).at(-1)).toEqual({
    action: "edited",
    before: "ES:Haircut for {name}",
    after: "Corte para {name}",
    changedBy: "admin",
  })
})

test("a translation must keep the English's fields", async () => {
  const { id } = await entry()
  expect(await editTranslation({ id, text: "Corte para {nombre}", userId: "admin" })).toEqual({
    ok: false,
    error: "fields",
  })
  expect(await editTranslation({ id, text: "   ", userId: "admin" })).toEqual({
    ok: false,
    error: "empty",
  })
  expect(await editTranslation({ id: "gone", text: "x", userId: "admin" })).toEqual({
    ok: false,
    error: "not_found",
  })
  expect((await entry()).status).toBe("automatic")
})

test("an edit stays when the English changes, and saving it again marks it reviewed", async () => {
  const { id } = await entry()
  await editTranslation({ id, text: "Corte para {name}", userId: "admin" })
  await english("Long haircut for {name}")
  expect(await entry()).toMatchObject({ status: "needs_review", text: "Corte para {name}" })
  await editTranslation({ id, text: "Corte para {name}", userId: "admin" })
  expect((await entry()).status).toBe("edited")
})

test("Google's answer never overwrites an admin's edit made while it worked", async () => {
  await english("Beard trim for {name}")
  const { id } = await entry()
  let release: (() => void) | null = null
  const slow: Translator = {
    name: "google",
    translate: (htmls) =>
      new Promise((resolve) => {
        release = () => resolve(htmls.map((html) => `ES:${html}`))
      }),
  }
  const run = runTranslationQueue({ translator: slow })
  // Google has the text; the admin saves meanwhile.
  await vi.waitFor(() => expect(release).not.toBeNull())
  await editTranslation({ id, text: "Barba para {name}", userId: "admin" })
  release!()
  await run
  expect(await entry()).toMatchObject({ status: "edited", text: "Barba para {name}" })
})

test("Reset to Google sends the text again and logs it", async () => {
  const { id } = await entry()
  await editTranslation({ id, text: "Corte para {name}", userId: "admin" })
  expect((await resetTranslation({ id, userId: "admin" })).ok).toBe(true)
  expect(await entry()).toMatchObject({ status: "pending", attempts: 0 })
  expect((await history()).at(-1)).toMatchObject({ action: "reset", changedBy: "admin" })
  await runTranslationQueue({ translator: google })
  expect(await entry()).toMatchObject({ status: "automatic", origin: "google" })
})

test("Retry works only on a failed text", async () => {
  const { id } = await entry()
  expect(await retryTranslation({ id, userId: "admin" })).toEqual({
    ok: false,
    error: "not_failed",
  })
  await db
    .update(translationEntries)
    .set({ status: "failed", attempts: 5, lastError: "Google is down" })
    .where(eq(translationEntries.id, id))
  expect((await retryTranslation({ id, userId: "admin" })).ok).toBe(true)
  expect(await entry()).toMatchObject({
    status: "pending",
    attempts: 0,
    lastError: null,
    nextAttemptAt: null,
  })
  expect((await history()).at(-1)).toMatchObject({ action: "retry", changedBy: "admin" })
})
