// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  platformSettingChanges,
  platformSettings,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import type { Translator } from "./provider"
import { TRANSLATION_RULES } from "./rules"

vi.mock("server-only", () => ({}))

const {
  setTranslationRule,
  translationRuleSettings,
  translationRules,
  TranslationRuleError,
} = await import("./settings")
const { runTranslationQueue, syncTexts } = await import("./queue")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translation-settings-test-"))
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
  await db.delete(platformSettingChanges)
  await db.delete(platformSettings)
  await db.delete(translationHistory)
  await db.delete(translationEntries)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("the defaults stand until an admin changes a rule; each change is logged", async () => {
  expect(await translationRules()).toEqual(TRANSLATION_RULES)
  await setTranslationRule({ key: "retryMinutes", value: [2, 10], userId: "admin" })
  expect((await translationRules()).retryMinutes).toEqual([2, 10])
  expect(
    (await translationRuleSettings()).find((rule) => rule.key === "retryMinutes")
  ).toEqual({ key: "retryMinutes", defaultValue: [1, 5, 30, 120], value: [2, 10] })
  await setTranslationRule({ key: "retryMinutes", value: null, userId: "admin" })
  expect((await translationRules()).retryMinutes).toEqual([1, 5, 30, 120])
  const log = await db
    .select({
      key: platformSettingChanges.key,
      before: platformSettingChanges.before,
      after: platformSettingChanges.after,
      changedBy: platformSettingChanges.changedBy,
    })
    .from(platformSettingChanges)
    .orderBy(platformSettingChanges.id)
  expect(log).toEqual([
    { key: "translation.retryMinutes", before: null, after: [2, 10], changedBy: "admin" },
    { key: "translation.retryMinutes", before: [2, 10], after: null, changedBy: "admin" },
  ])
})

test("a value a rule does not allow is refused and nothing is saved", async () => {
  for (const [key, value] of [
    ["retryMinutes", []],
    ["retryMinutes", [0]],
    ["requestCharacters", 40_000],
    ["requestTexts", 1.5],
    ["dailyBusinessCharacters", "50000"],
  ] as const) {
    await expect(
      setTranslationRule({ key, value, userId: "admin" })
    ).rejects.toBeInstanceOf(TranslationRuleError)
  }
  await expect(
    setTranslationRule({ key: "timerSeconds" as "runTexts", value: 5, userId: "admin" })
  ).rejects.toBeInstanceOf(TranslationRuleError)
  expect(await db.select().from(platformSettings)).toEqual([])
})

test("a stored value a rule no longer allows keeps the default", async () => {
  await db
    .insert(platformSettings)
    .values({ key: "translation.requestTexts", value: 5_000 })
  expect((await translationRules()).requestTexts).toBe(TRANSLATION_RULES.requestTexts)
})

test("the queue retries after the admin's waits", async () => {
  await setTranslationRule({ key: "retryMinutes", value: [7], userId: "admin" })
  await syncTexts({
    scope: "business",
    businessId: "biz",
    items: [{ key: "s1:service.name", module: "service.name", text: "Haircut" }],
    languages: ["es"],
  })
  const down: Translator = {
    name: "google",
    async translate() {
      throw new Error("Google is down")
    },
  }
  const now = new Date("2026-11-06T12:00:00.000Z")
  await runTranslationQueue({ translator: down, now: () => now })
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(eq(translationEntries.key, "s1:service.name"))
  expect(row).toMatchObject({
    status: "pending",
    attempts: 1,
    nextAttemptAt: "2026-11-06T12:07:00.000Z",
  })
  // One wait only: the next failure is final.
  await runTranslationQueue({
    translator: down,
    now: () => new Date("2026-11-06T12:08:00.000Z"),
  })
  const [after] = await db
    .select({ status: translationEntries.status })
    .from(translationEntries)
    .where(eq(translationEntries.key, "s1:service.name"))
  expect(after.status).toBe("failed")
})

test("the queue keeps to the admin's daily limit per business", async () => {
  await setTranslationRule({ key: "dailyBusinessCharacters", value: 1_000, userId: "admin" })
  await syncTexts({
    scope: "business",
    businessId: "biz",
    items: [{ key: "s1:service.description", module: "service.description", text: "x".repeat(1_200) }],
    languages: ["es"],
  })
  const google: Translator = {
    name: "google",
    async translate(htmls) {
      return htmls.map((html) => `ES:${html}`)
    },
  }
  expect(await runTranslationQueue({ translator: google })).toMatchObject({
    translated: 0,
    deferred: 1,
  })
})

test("a new daily limit counts today: texts held for tomorrow are due again", async () => {
  await setTranslationRule({ key: "dailyBusinessCharacters", value: 1_000, userId: "admin" })
  await syncTexts({
    scope: "business",
    businessId: "biz",
    items: [{ key: "s1:service.description", module: "service.description", text: "x".repeat(1_200) }],
    languages: ["es"],
  })
  const google: Translator = {
    name: "google",
    async translate(htmls) {
      return htmls.map((html) => `ES:${html}`)
    },
  }
  expect(await runTranslationQueue({ translator: google })).toMatchObject({ deferred: 1 })
  await setTranslationRule({ key: "dailyBusinessCharacters", value: 2_000, userId: "admin" })
  const [entry] = await db.select().from(translationEntries)
  expect(entry.nextAttemptAt).toBeNull()
  expect(await runTranslationQueue({ translator: google })).toMatchObject({
    translated: 1,
    deferred: 0,
  })
})
