// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  platformSettingChanges,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import { TRANSLATION_ADMIN_PAGE_ROWS } from "@/lib/translations/rules"

const { requireAdmin } = vi.hoisted(() => ({
  requireAdmin: vi.fn(async () => ({
    userId: "admin",
    name: "Admin",
    email: "admin@example.com",
  })),
}))

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({ requireAdmin }))

const {
  getTranslationChanges,
  getTranslationDetail,
  getTranslationGroups,
  getTranslationList,
  getTranslationOverview,
} = await import("./translations")
const { setTranslationRule } = await import("@/lib/translations/settings")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

const row = (
  id: string,
  values: Partial<typeof translationEntries.$inferInsert> = {}
): typeof translationEntries.$inferInsert => ({
  id,
  scope: "business",
  businessId: "biz",
  module: "service.name",
  key: `${id}:service.name`,
  language: "es",
  sourceText: `English ${id}`,
  sourceHash: id,
  text: `Spanish ${id}`,
  status: "automatic",
  origin: "google",
  ...values,
})

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-admin-translations-test-"))
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
  await db.insert(businesses).values([
    { id: "biz", slug: "biz", name: "Barber", timezone: "UTC", currency: "USD", ownerId: "admin" },
    { id: "spa", slug: "spa", name: "Spa", timezone: "UTC", currency: "USD", ownerId: "admin" },
  ])
})

beforeEach(async () => {
  vi.clearAllMocks()
  await db.delete(platformSettingChanges)
  await db.delete(translationHistory)
  await db.delete(translationEntries)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("every query checks the admin first", async () => {
  requireAdmin.mockRejectedValueOnce(new Error("not found"))
  await expect(getTranslationList("business", { page: 1 })).rejects.toThrow()
})

test("a list shows what needs an admin first and filters by state, business and words", async () => {
  await db.insert(translationEntries).values([
    row("a"),
    row("b", { status: "failed", text: null }),
    row("c", { status: "needs_review", businessId: "spa", sourceText: "50% off_today" }),
    row("d", { scope: "interface", businessId: null, module: "dashboard.bookings", key: "title" }),
  ])
  const all = await getTranslationList("business", { page: 1 })
  expect(all.rows.map((item) => item.id)).toEqual(["b", "c", "a"])
  expect(all).toMatchObject({ total: 3, page: 1, pages: 1 })
  expect(all.rows[1].businessName).toBe("Spa")

  const ids = async (filter: Parameters<typeof getTranslationList>[1]) =>
    (await getTranslationList("business", filter)).rows.map((item) => item.id)
  expect(await ids({ page: 1, state: "failed" })).toEqual(["b"])
  expect(await ids({ page: 1, group: "spa" })).toEqual(["c"])
  // % and _ are words, not wildcards.
  expect(await ids({ page: 1, search: "50%" })).toEqual(["c"])
  expect(await ids({ page: 1, search: "of_" })).toEqual([])
  expect(await ids({ page: 1, search: "spanish a" })).toEqual(["a"])
  expect((await getTranslationList("interface", { page: 1 })).rows.map((item) => item.id)).toEqual(["d"])
})

test("results come a page at a time; a page past the end shows the last", async () => {
  const many = Array.from({ length: TRANSLATION_ADMIN_PAGE_ROWS + 3 }, (_, index) =>
    row(`r${String(index).padStart(3, "0")}`)
  )
  await db.insert(translationEntries).values(many)
  const second = await getTranslationList("business", { page: 9 })
  expect(second).toMatchObject({ page: 2, pages: 2, total: TRANSLATION_ADMIN_PAGE_ROWS + 3 })
  expect(second.rows).toHaveLength(3)
})

test("the filter lists the businesses or pages that have texts", async () => {
  await db.insert(translationEntries).values([
    row("a"),
    row("b", { businessId: "spa" }),
    row("d", { scope: "interface", businessId: null, module: "dashboard.bookings", key: "title" }),
  ])
  expect(await getTranslationGroups("business")).toEqual([
    { id: "biz", label: "Barber" },
    { id: "spa", label: "Spa" },
  ])
  expect(await getTranslationGroups("interface")).toEqual([
    { id: "dashboard.bookings", label: "dashboard.bookings" },
  ])
})

test("the overview counts each state and this month's characters only", async () => {
  await db.insert(translationEntries).values([
    row("a"),
    row("b", { status: "pending", text: null }),
    row("d", { scope: "interface", businessId: null, key: "title", status: "failed" }),
  ])
  await db.insert(translationHistory).values([
    { scope: "business", businessId: "biz", key: "a", language: "es", action: "google", sourceText: "x", characters: 120, changedAt: "2026-11-02T10:00:00.000Z" },
    { scope: "business", businessId: "biz", key: "a", language: "es", action: "google", sourceText: "x", characters: 999, changedAt: "2026-10-31T23:59:00.000Z" },
  ])
  const overview = await getTranslationOverview(new Date("2026-11-06T12:00:00.000Z"))
  expect(overview.monthCharacters).toBe(120)
  expect(overview.freeCharacters).toBe(500_000)
  expect(overview.counts.business).toMatchObject({ automatic: 1, pending: 1, failed: 0 })
  expect(overview.counts.interface).toMatchObject({ failed: 1 })
})

test("one text comes with its history, and only in its own list", async () => {
  await db.insert(translationEntries).values(row("a"))
  await db.insert(translationHistory).values([
    { entryId: "a", scope: "business", businessId: "biz", key: "a:service.name", language: "es", action: "google", sourceText: "English a", after: "Spanish a", characters: 9 },
    { entryId: "a", scope: "business", businessId: "biz", key: "a:service.name", language: "es", action: "edited", sourceText: "English a", after: "Mine", changedBy: "admin" },
  ])
  const detail = await getTranslationDetail("business", "a")
  expect(detail?.entry).toMatchObject({ id: "a", businessName: "Barber" })
  expect(detail?.history.map((item) => [item.action, item.changedBy])).toEqual([
    ["edited", "Admin"],
    ["google", null],
  ])
  expect(await getTranslationDetail("interface", "a")).toBeNull()
  expect(await getTranslationDetail("business", "gone")).toBeNull()
})

test("History has every text's changes and the rules' changes, newest first", async () => {
  await db.insert(translationEntries).values(row("a"))
  await db.insert(translationHistory).values({
    entryId: "a", scope: "business", businessId: "biz", key: "a:service.name", language: "es",
    action: "google", sourceText: "English a", after: "Spanish a", characters: 9,
    changedAt: "2026-11-01T00:00:00.000Z",
  })
  await setTranslationRule({ key: "runTexts", value: 100, userId: "admin" })
  // Other rules' changes belong to WhatsApp's change log.
  await db.insert(platformSettingChanges).values({ key: "sendBatch", before: null, after: 5, changedBy: "admin" })
  const changes = await getTranslationChanges()
  expect(changes.map((item) => item.kind)).toEqual(["rule", "text"])
  expect(changes[0]).toMatchObject({ rule: "runTexts", after: 100, changedBy: "Admin" })
  expect(changes[1]).toMatchObject({ entryId: "a", businessName: "Barber", characters: 9 })
})
