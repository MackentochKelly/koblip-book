// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  businesses,
  platformSettingChanges,
  platformSettings,
  services,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import { sourceHash, toGoogleHtml } from "./markup"
import type { Translator } from "./provider"

vi.mock("server-only", () => ({}))

const { backfillPlan, runBackfill } = await import("./backfill")
const { getBusinessTranslations, syncBusinessTexts } =
  await import("./business-texts")
const { editTranslation } = await import("./edits")
const { googleTexts, runTranslationQueue } = await import("./queue")
const { setTranslationRule } = await import("./settings")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

const NOW = new Date("2026-11-06T12:00:00.000Z")

// Google stand-in: "ES:" before the text, kept parts untouched. `during`
// runs while Google "works", before it answers.
function google(
  during?: () => Promise<void>
): Translator & { calls: string[][] } {
  const calls: string[][] = []
  return {
    name: "google",
    calls,
    async translate(htmls) {
      calls.push(htmls)
      await during?.()
      return htmls.map((html) => `ES:${html}`)
    },
  }
}

type NewEntry = typeof translationEntries.$inferInsert

// A text as it stands in the database (Meta's: as the move from the old
// table left it).
async function put(
  key: string,
  english: string,
  rest: Partial<NewEntry> & Pick<NewEntry, "status">,
  businessId: string | null = "biz"
) {
  await db.insert(translationEntries).values({
    scope: businessId === null ? "interface" : "business",
    businessId,
    module:
      businessId === null
        ? key.split(".").slice(0, 2).join(".")
        : key.split(":")[1],
    key,
    language: "es",
    sourceText: english,
    sourceHash: sourceHash(english),
    ...rest,
  })
}

const meta = (text: string) => ({
  status: "automatic" as const,
  origin: "meta" as const,
  text,
})

async function service(
  id: string,
  name: string,
  businessId = "biz",
  description: string | null = null
) {
  await db.insert(services).values({
    id,
    businessId,
    name,
    description,
    durationMinutes: 30,
    priceMinor: 2000,
    position: 0,
  })
}

async function entry(key: string, businessId: string | null = "biz") {
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.key, key),
        eq(translationEntries.language, "es"),
        businessId === null
          ? eq(translationEntries.scope, "interface")
          : eq(translationEntries.businessId, businessId)
      )
    )
  return row
}

async function snapshot() {
  return {
    entries: await db
      .select()
      .from(translationEntries)
      .orderBy(translationEntries.id),
    history: await db
      .select()
      .from(translationHistory)
      .orderBy(translationHistory.id),
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-translation-backfill-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  ;({ db } = await import("@/lib/db"))
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "u1",
    name: "Admin",
    email: "admin@example.com",
    emailVerified: false,
  })
})

beforeEach(async () => {
  await db.delete(platformSettingChanges)
  await db.delete(platformSettings)
  await db.delete(translationHistory)
  await db.delete(translationEntries)
  await db.delete(services)
  await db.delete(businesses)
  await db.insert(businesses).values([
    {
      id: "biz",
      slug: "biz",
      name: "Shop",
      timezone: "America/New_York",
      currency: "USD",
      ownerId: "u1",
    },
    {
      id: "other",
      slug: "other",
      name: "Other",
      timezone: "America/New_York",
      currency: "USD",
      ownerId: "u1",
    },
    {
      id: "demo",
      slug: "demo",
      name: "Demo",
      timezone: "America/New_York",
      currency: "USD",
      isDemo: true,
    },
  ])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("the dry run counts each kind as the queue bills it, and changes nothing", async () => {
  await db
    .update(businesses)
    .set({ description: "Book at https://shop.example" })
    .where(eq(businesses.id, "biz"))
  await put(
    "biz:business.description",
    "Book at https://shop.example",
    meta("Reserva en https://shop.example")
  )
  await service("s1", "Haircut")
  await put("s1:service.name", "Haircut", meta("Corte"))
  // Not in the queue yet.
  await service("s2", "Beard trim")
  // Meta's from English since changed: it waits for Google again.
  await service("s3", "Shave")
  await put("s3:service.name", "Old shave", meta("Afeitado viejo"))
  await service("s4", "Wash")
  await put("s4:service.name", "Wash", {
    status: "automatic",
    origin: "fake",
    text: "[es] Wash",
  })
  await service("s5", "Color")
  await put("s5:service.name", "Color", { status: "failed", attempts: 5 })
  // An admin's own translation stays as it is.
  await service("s6", "Styling")
  await put("s6:service.name", "Styling", {
    status: "edited",
    origin: "manual",
    text: "Peinado",
  })
  // A removed service's text goes at the next save.
  await put("gone:service.name", "Gone", meta("Ido"))
  // Demo copies are never translated.
  await service("d1", "Trim", "demo")
  await put("d1:service.name", "Trim", meta("Recorte"), "demo")
  // The app's own words.
  await put("owner.bookings.title", "Bookings", { status: "pending" }, null)
  await put(
    "owner.bookings.hello",
    "Hello {name}",
    { status: "automatic", origin: "fake", text: "[es] Hello {name}" },
    null
  )
  // Billed this month and last month.
  await db.insert(translationHistory).values([
    {
      scope: "business",
      businessId: "biz",
      key: "x",
      language: "es",
      action: "google",
      sourceText: "x",
      characters: 499_990,
      changedAt: "2026-11-02T08:00:00.000Z",
    },
    {
      scope: "business",
      businessId: "biz",
      key: "x",
      language: "es",
      action: "google",
      sourceText: "x",
      characters: 5_000,
      changedAt: "2026-10-30T08:00:00.000Z",
    },
  ])

  const before = await snapshot()
  const plan = await backfillPlan(NOW)
  expect(await snapshot()).toEqual(before)

  const link = toGoogleHtml("Book at https://shop.example").html.length
  const hello = googleTexts("interface", "Hello {name}")!.characters
  expect(link).toBe(
    'Book at <span translate="no">https://shop.example</span>'.length
  )
  expect(plan.rows).toEqual([
    {
      scope: "business",
      language: "es",
      meta: { texts: 2, characters: link + "Haircut".length },
      fake: { texts: 1, characters: "Wash".length },
      gaps: {
        texts: 3,
        characters: "Beard trim".length + "Shave".length + "Color".length,
      },
      reused: 0,
      skipped: 0,
    },
    {
      scope: "interface",
      language: "es",
      meta: { texts: 0, characters: 0 },
      fake: { texts: 1, characters: hello },
      gaps: { texts: 1, characters: "Bookings".length },
      reused: 0,
      skipped: 0,
    },
  ])
  const characters = link + 7 + 4 + 20 + hello + 8
  expect(plan).toMatchObject({
    texts: 8,
    characters,
    monthCharacters: 499_990,
    freeCharacters: 500_000,
    freeLeft: 10,
    paidCharacters: characters - 10,
    usdPerMillion: 20,
    dailyBusinessCharacters: 50_000,
    days: 1,
  })
  expect(plan.estimatedUsd).toBeCloseTo(
    ((characters - 10) / 1_000_000) * 20,
    10
  )
})

test("Google's earlier translation of the same English is reused, in the same scope only; Meta's same English goes once", async () => {
  await service("s1", "Haircut")
  await put("s1:service.name", "Haircut", meta("Corte"))
  await service("o1", "Haircut", "other")
  await put(
    "o1:service.name",
    "Haircut",
    { status: "automatic", origin: "google", text: "Corte G" },
    "other"
  )
  // Two businesses, Meta's same English.
  await service("s2", "Shave")
  await put("s2:service.name", "Shave", meta("Afeitado"))
  await service("o2", "Shave", "other")
  await put("o2:service.name", "Shave", meta("Afeitado"), "other")
  // Google translated "Beard trim" as one of the app's words: not reused for a business text.
  await service("s3", "Beard trim")
  await put(
    "app.beard",
    "Beard trim",
    { status: "automatic", origin: "google", text: "Barba" },
    null
  )

  const plan = await backfillPlan(NOW)
  expect(plan.rows.find((row) => row.scope === "business")).toMatchObject({
    meta: { texts: 1, characters: "Shave".length },
    gaps: { texts: 1, characters: "Beard trim".length },
    reused: 2,
  })

  const translator = google()
  const result = await runBackfill({
    translator,
    confirm: true,
    now: () => NOW,
  })
  expect(translator.calls).toEqual([["Shave"]])
  expect(result).toMatchObject({
    replaced: 3,
    reused: 2,
    characters: 5,
    queued: 1,
  })
  expect(await entry("s1:service.name")).toMatchObject({
    status: "automatic",
    origin: "google",
    text: "Corte G",
  })
  expect(await entry("s2:service.name")).toMatchObject({
    origin: "google",
    text: "ES:Shave",
  })
  expect(await entry("o2:service.name", "other")).toMatchObject({
    origin: "google",
    text: "ES:Shave",
  })
  const billed = await db
    .select()
    .from(translationHistory)
    .where(eq(translationHistory.action, "google"))
  expect(billed.map((row) => row.characters)).toEqual([5])
})

test("Meta's text stays on the page until Google's arrives", async () => {
  await service("s1", "Haircut")
  await put("s1:service.name", "Haircut", meta("Corte"))
  const shown = async () =>
    (await getBusinessTranslations("biz", "es"))(
      "s1",
      "service.name",
      "Haircut"
    )
  const seen: unknown[] = []
  const translator = google(async () => {
    seen.push(await shown(), (await entry("s1:service.name")).status)
  })
  const result = await runBackfill({
    translator,
    confirm: true,
    now: () => NOW,
  })
  expect(seen).toEqual(["Corte", "automatic"])
  expect(result).toMatchObject({ replaced: 1, kept: 0, characters: 7 })
  expect(await shown()).toBe("ES:Haircut")
  expect(await entry("s1:service.name")).toMatchObject({
    status: "automatic",
    origin: "google",
    text: "ES:Haircut",
    machineText: "ES:Haircut",
    machineSourceHash: sourceHash("Haircut"),
  })
  const history = await db.select().from(translationHistory)
  expect(history).toMatchObject([
    { action: "google", before: "Corte", after: "ES:Haircut", characters: 7 },
  ])
})

test("an admin's edit or a newer English made while Google works wins; Google's characters are still recorded", async () => {
  await service("s1", "Haircut")
  await put("s1:service.name", "Haircut", meta("Corte"))
  await service("s2", "Shave")
  await put("s2:service.name", "Shave", meta("Afeitado"))
  const translator = google(async () => {
    const { id } = await entry("s1:service.name")
    await editTranslation({ id, text: "Corte a mano", userId: "u1" })
    await db
      .update(services)
      .set({ name: "Long shave" })
      .where(eq(services.id, "s2"))
    await syncBusinessTexts("biz")
  })
  const result = await runBackfill({
    translator,
    confirm: true,
    now: () => NOW,
  })
  expect(result).toMatchObject({ replaced: 0, kept: 2, characters: 7 + 5 })
  expect(await entry("s1:service.name")).toMatchObject({
    status: "edited",
    origin: "manual",
    text: "Corte a mano",
  })
  expect(await entry("s2:service.name")).toMatchObject({
    status: "pending",
    sourceText: "Long shave",
  })
  const billed = await db
    .select()
    .from(translationHistory)
    .where(eq(translationHistory.action, "google"))
  expect(billed.map((row) => row.characters).sort()).toEqual([5, 7])
})

test("a Google answer that loses a link isn't used: Meta's stays, the characters are recorded", async () => {
  await db
    .update(businesses)
    .set({ description: "Book at https://shop.example" })
    .where(eq(businesses.id, "biz"))
  await put(
    "biz:business.description",
    "Book at https://shop.example",
    meta("Reserva en https://shop.example")
  )
  const translator: Translator = {
    name: "google",
    async translate(htmls) {
      return htmls.map(() => "Reserva")
    },
  }
  const result = await runBackfill({
    translator,
    confirm: true,
    now: () => NOW,
  })
  expect(result).toMatchObject({ replaced: 0, failed: 1 })
  expect(await entry("biz:business.description")).toMatchObject({
    origin: "meta",
    text: "Reserva en https://shop.example",
  })
  const [billed] = await db.select().from(translationHistory)
  expect(billed).toMatchObject({
    action: "google",
    characters: toGoogleHtml("Book at https://shop.example").html.length,
  })
})

test("each business keeps its daily limit and the run its most; the rest stays Meta's for the next run", async () => {
  await setTranslationRule({
    key: "dailyBusinessCharacters",
    value: 1_000,
    userId: "u1",
  })
  for (const index of [1, 2, 3]) {
    const text = `${index} ${"x".repeat(448)}`
    await service(`s${index}`, `Service ${index}`, "biz", text)
    await put(`s${index}:service.description`, text, meta(`ES ${index}`))
    await put(`s${index}:service.name`, `Service ${index}`, {
      status: "edited",
      origin: "manual",
      text: `Servicio ${index}`,
    })
  }
  // Already sent today.
  await db.insert(translationHistory).values({
    scope: "business",
    businessId: "biz",
    key: "x",
    language: "es",
    action: "google",
    sourceText: "x",
    characters: 100,
  })
  const today = new Date()
  const first = await runBackfill({
    translator: google(),
    confirm: true,
    now: () => today,
  })
  // 100 + 450 + 450 fit in 1,000; the third waits.
  expect(first).toMatchObject({ replaced: 2, deferred: 1, characters: 900 })
  expect(await entry("s3:service.description")).toMatchObject({
    origin: "meta",
    text: "ES 3",
  })

  const tomorrow = () => new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const capped = await runBackfill({
    translator: google(),
    confirm: true,
    now: tomorrow,
    maxCharacters: 400,
  })
  expect(capped).toMatchObject({ replaced: 0, deferred: 1, characters: 0 })
  const next = await runBackfill({
    translator: google(),
    confirm: true,
    now: tomorrow,
  })
  expect(next).toMatchObject({ replaced: 1, deferred: 0, characters: 450 })
  expect(await entry("s3:service.description")).toMatchObject({
    origin: "google",
  })
})

test("gaps and the test translator's texts simply wait in the normal queue", async () => {
  await service("s1", "Haircut")
  await service("s2", "Shave")
  await put("s2:service.name", "Shave", {
    status: "failed",
    attempts: 5,
    lastError: "Google is down",
  })
  await service("s3", "Wash")
  await put("s3:service.name", "Wash", {
    status: "automatic",
    origin: "fake",
    text: "[es] Wash",
  })
  const translator = google()
  const result = await runBackfill({
    translator,
    confirm: true,
    now: () => NOW,
  })
  expect(translator.calls).toEqual([])
  expect(result).toMatchObject({
    synced: { added: 1 },
    queued: 3,
    replaced: 0,
    characters: 0,
  })
  for (const key of ["s1:service.name", "s2:service.name", "s3:service.name"]) {
    expect(await entry(key)).toMatchObject({
      status: "pending",
      attempts: 0,
      lastError: null,
    })
  }
  expect(
    (await db.select().from(translationHistory))
      .map((row) => [row.key, row.action])
      .sort()
  ).toEqual([
    ["s2:service.name", "retry"],
    ["s3:service.name", "reset"],
  ])
  expect(
    await runTranslationQueue({ translator, now: () => NOW })
  ).toMatchObject({ translated: 3 })
  expect(await entry("s3:service.name")).toMatchObject({
    status: "automatic",
    origin: "google",
    text: "ES:Wash",
  })
})

test("the real run needs the go and Google itself", async () => {
  await service("s1", "Haircut")
  await put("s1:service.name", "Haircut", meta("Corte"))
  const before = await snapshot()
  const fake: Translator = {
    name: "fake",
    async translate(htmls) {
      return htmls
    },
  }
  await expect(
    runBackfill({ translator: fake, confirm: true })
  ).rejects.toThrow("Google only")
  await expect(
    runBackfill({ translator: google(), confirm: false as unknown as true })
  ).rejects.toThrow("confirmed")
  expect(await snapshot()).toEqual(before)
})
