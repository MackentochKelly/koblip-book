// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { and, eq } from "drizzle-orm"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  addonGroups,
  addonOptions,
  businesses,
  businessPolicies,
  businessPolicyPoints,
  serviceCategories,
  services,
  teamMembers,
  translationEntries,
  translationHistory,
  user,
} from "@/lib/db/schema"
import type { Translator } from "./provider"

vi.mock("server-only", () => ({}))

const {
  collectBusinessTexts,
  getBusinessTranslations,
  getServiceNameTranslations,
  syncBusinessTexts,
} = await import("./business-texts")
const { runTranslationQueue } = await import("./queue")

let dir: string
let closeDb: () => void
let db: (typeof import("@/lib/db"))["db"]

// Google stand-in: "ES:" before the text.
const google: Translator = {
  name: "google",
  async translate(htmls) {
    return htmls.map((html) => `ES:${html}`)
  },
}

async function entries(businessId: string) {
  return db
    .select({
      key: translationEntries.key,
      module: translationEntries.module,
      status: translationEntries.status,
      text: translationEntries.text,
    })
    .from(translationEntries)
    .where(eq(translationEntries.businessId, businessId))
    .orderBy(translationEntries.key)
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-business-texts-test-"))
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
})

beforeEach(async () => {
  await db.delete(translationHistory)
  await db.delete(translationEntries)
  await db.delete(businesses)
  await db.insert(businesses).values([
    {
      id: "biz",
      slug: "biz",
      name: "Shop",
      description: "A cozy shop",
      category: "Barber shop",
      timezone: "America/New_York",
      currency: "USD",
      ownerId: "u1",
    },
    {
      id: "demo",
      slug: "demo",
      name: "Demo",
      description: "A demo shop",
      timezone: "America/New_York",
      currency: "USD",
      isDemo: true,
    },
  ])
  await db.insert(services).values([
    { id: "s1", businessId: "biz", name: "Haircut", description: null, durationMinutes: 30, priceMinor: 2000, position: 0 },
    { id: "s9", businessId: "demo", name: "Shave", durationMinutes: 30, priceMinor: 1000, position: 0 },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("every kind of business text with words is collected, empty ones skipped", () => {
  const all = collectBusinessTexts({
    business: { id: "b", description: "About us", category: "  " },
    services: [{ id: "s", name: "Cut", description: "" }],
    serviceCategories: [{ id: "c", name: "Hair" }],
    addonGroups: [{ id: "g", prompt: "Add one?" }],
    addonOptions: [{ id: "o", name: "Wash", description: "Warm water" }],
    team: [{ id: "t", description: "Barber", about: null }],
    policies: [
      { id: "p1", title: null, body: "Cancel a day ahead." },
      { id: "p2", title: "House rules", body: "Be kind." },
    ],
    policyPoints: [{ id: "k", title: "On time", body: "Come early." }],
  })
  expect(all.map((item) => `${item.entityId}:${item.field}`)).toEqual([
    "b:business.description",
    "s:service.name",
    "c:service_category.name",
    "g:addon_group.prompt",
    "o:addon.name",
    "o:addon.description",
    "t:team_member.description",
    "p1:policy.body",
    "p2:policy.title",
    "p2:policy.body",
    "k:policy_point.title",
    "k:policy_point.body",
  ])
})

test("a save records every text of the business once, waiting for Google", async () => {
  await db.insert(serviceCategories).values({ id: "c1", businessId: "biz", name: "Hair", position: 0 })
  await db.insert(addonGroups).values({ id: "g1", businessId: "biz", name: "Extras", prompt: "Add one?", minSelect: 0, maxSelect: 1, position: 0 })
  await db.insert(addonOptions).values({ id: "o1", businessId: "biz", groupId: "g1", name: "Wash", priceMinor: 500, durationMinutes: 5, position: 0 })
  await db.insert(teamMembers).values({ id: "t1", businessId: "biz", name: "Ana", description: "Barber", about: "Ten years cutting hair.", position: 0 })
  await db.insert(businessPolicies).values({ id: "p1", businessId: "biz", kind: "booking", body: "Cancel a day ahead." })
  await db.insert(businessPolicyPoints).values({ id: "k1", businessId: "biz", icon: "clock", title: "On time", body: "Come early.", position: 0 })
  expect(await syncBusinessTexts("biz")).toEqual({ added: 11, changed: 0, removed: 0 })
  expect((await entries("biz")).map((row) => [row.key, row.status])).toEqual([
    ["biz:business.category", "pending"],
    ["biz:business.description", "pending"],
    ["c1:service_category.name", "pending"],
    ["g1:addon_group.prompt", "pending"],
    ["k1:policy_point.body", "pending"],
    ["k1:policy_point.title", "pending"],
    ["o1:addon.name", "pending"],
    ["p1:policy.body", "pending"],
    ["s1:service.name", "pending"],
    ["t1:team_member.about", "pending"],
    ["t1:team_member.description", "pending"],
  ])
  // Saving again with nothing changed sends nothing.
  expect(await syncBusinessTexts("biz")).toEqual({ added: 0, changed: 0, removed: 0 })
})

test("demo copies and missing businesses are never translated", async () => {
  expect(await syncBusinessTexts("demo")).toBeNull()
  expect(await syncBusinessTexts("gone")).toBeNull()
  expect(await entries("demo")).toEqual([])
})

test("a removed service's translations go at the next save", async () => {
  await syncBusinessTexts("biz")
  await db.delete(services).where(eq(services.id, "s1"))
  expect(await syncBusinessTexts("biz")).toMatchObject({ removed: 1 })
  expect((await entries("biz")).map((row) => row.key)).not.toContain("s1:service.name")
})

test("the page shows a translation only once made from the current English", async () => {
  await syncBusinessTexts("biz")
  // Before Google answers: English.
  let translated = await getBusinessTranslations("biz", "es")
  expect(translated("s1", "service.name", "Haircut")).toBe("Haircut")
  await runTranslationQueue({ translator: google })
  translated = await getBusinessTranslations("biz", "es")
  expect(translated("s1", "service.name", "Haircut")).toBe("ES:Haircut")
  // English changed, Google not done yet: English.
  expect(translated("s1", "service.name", "Long haircut")).toBe("Long haircut")
  // English pages never look.
  expect((await getBusinessTranslations("biz", "en"))("s1", "service.name", "Haircut")).toBe("Haircut")
})

test("an edited translation that needs review still shows", async () => {
  await syncBusinessTexts("biz")
  await runTranslationQueue({ translator: google })
  await db
    .update(translationEntries)
    .set({ status: "edited", origin: "manual", text: "Corte" })
    .where(eq(translationEntries.key, "s1:service.name"))
  await db.update(services).set({ name: "Long haircut" }).where(eq(services.id, "s1"))
  await syncBusinessTexts("biz")
  const [row] = await db
    .select()
    .from(translationEntries)
    .where(and(eq(translationEntries.key, "s1:service.name"), eq(translationEntries.language, "es")))
  expect(row).toMatchObject({ status: "needs_review", text: "Corte" })
  const translated = await getBusinessTranslations("biz", "es")
  expect(translated("s1", "service.name", "Long haircut")).toBe("Corte")
})

test("the assistant finds a service by its shown translated name", async () => {
  await syncBusinessTexts("biz")
  expect(await getServiceNameTranslations("biz")).toEqual([])
  await runTranslationQueue({ translator: google })
  expect(await getServiceNameTranslations("biz")).toEqual([
    { serviceId: "s1", sourceText: "Haircut", text: "ES:Haircut" },
  ])
})
