// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  addonGroups,
  addonOptions,
  businesses,
  serviceAddonGroups,
  services,
  translations,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "")

let getBusinessPage: typeof import("./get-business-page").getBusinessPage
let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-page-addons-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(businesses).values({
    id: "biz-pa",
    slug: "pa-shop",
    name: "PA Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
  })
  await db.insert(services).values({
    id: "svc-1",
    businessId: "biz-pa",
    name: "Cut",
    durationMinutes: 30,
    position: 0,
  })
  await db.insert(addonGroups).values([
    { id: "g1", businessId: "biz-pa", name: "Extras", prompt: "Choose extras", minSelect: 0, maxSelect: null, position: 0 },
    // Linked but option-less: hidden.
    { id: "g2", businessId: "biz-pa", name: "Empty", prompt: "Nothing here", minSelect: 0, maxSelect: null, position: 1 },
    // With options but unlinked: hidden.
    { id: "g3", businessId: "biz-pa", name: "Orphan", prompt: "Nowhere", minSelect: 0, maxSelect: null, position: 2 },
  ])
  await db.insert(addonOptions).values([
    { id: "o1", businessId: "biz-pa", groupId: "g1", name: "Conditioner", description: "Nice smell", priceMinor: 500, durationMinutes: 15, position: 0 },
    { id: "o2", businessId: "biz-pa", groupId: "g1", name: "Rinse", description: null, priceMinor: null, durationMinutes: 0, position: 1 },
    { id: "o3", businessId: "biz-pa", groupId: "g3", name: "Lost", description: null, priceMinor: null, durationMinutes: 0, position: 0 },
  ])
  await db.insert(serviceAddonGroups).values([
    { businessId: "biz-pa", serviceId: "svc-1", groupId: "g1", position: 0 },
    { businessId: "biz-pa", serviceId: "svc-1", groupId: "g2", position: 1 },
  ])
  await db.insert(translations).values([
    {
      businessId: "biz-pa",
      entityId: "g1",
      field: "addon_group.prompt",
      language: "es",
      sourceText: "Choose extras",
      text: "Elige extras",
    },
    {
      businessId: "biz-pa",
      entityId: "o1",
      field: "addon.name",
      language: "es",
      sourceText: "Conditioner",
      text: "Acondicionador",
    },
    {
      // Out of date: the English text changed since.
      businessId: "biz-pa",
      entityId: "o1",
      field: "addon.description",
      language: "es",
      sourceText: "An old description",
      text: "Una descripción vieja",
    },
  ])

  ;({ getBusinessPage } = await import("./get-business-page"))
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("only linked groups with options show, in English", async () => {
  const data = await getBusinessPage("pa-shop", "en")
  expect(data?.addonGroups).toEqual([
    {
      id: "g1",
      prompt: "Choose extras",
      minSelect: 0,
      maxSelect: null,
      serviceIds: ["svc-1"],
      options: [
        { id: "o1", name: "Conditioner", description: "Nice smell", priceMinor: 500, durationMinutes: 15 },
        { id: "o2", name: "Rinse", description: null, priceMinor: null, durationMinutes: 0 },
      ],
    },
  ])
})

test("es shows up-to-date add-on translations and English for the stale one", async () => {
  const data = await getBusinessPage("pa-shop", "es")
  expect(data?.addonGroups).toEqual([
    {
      id: "g1",
      prompt: "Elige extras",
      minSelect: 0,
      maxSelect: null,
      serviceIds: ["svc-1"],
      options: [
        { id: "o1", name: "Acondicionador", description: "Nice smell", priceMinor: 500, durationMinutes: 15 },
        { id: "o2", name: "Rinse", description: null, priceMinor: null, durationMinutes: 0 },
      ],
    },
  ])
})
