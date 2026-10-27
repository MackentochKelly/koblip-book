// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businesses,
  services,
  teamMemberServices,
  teamMembers,
  translations,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.stubEnv("GOOGLE_MAPS_PLATFORM_KEY", "test-key")

let getBusinessPage: typeof import("./get-business-page").getBusinessPage
let closeDb: () => void
let dir: string
const seenUrls: string[] = []

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-lang-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(businesses).values({
    id: "biz-lang",
    slug: "lang-shop",
    name: "Lang Shop",
    description: "Cozy family barbershop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    googlePlaceId: "ChIJ-lang",
  })
  await db.insert(services).values([
    {
      id: "svc-a",
      businessId: "biz-lang",
      name: "Classic Cut",
      description: "A tidy haircut",
      durationMinutes: 30,
      position: 0,
    },
    {
      id: "svc-b",
      businessId: "biz-lang",
      name: "Beard Trim",
      description: null,
      durationMinutes: 20,
      position: 1,
    },
  ])
  await db.insert(teamMembers).values([
    { id: "tm-1", businessId: "biz-lang", name: "Ana", position: 0 },
    { id: "tm-2", businessId: "biz-lang", name: "Luis", position: 1 },
  ])
  // svc-a is done only by tm-1; svc-b has no rows, so everyone does it.
  await db.insert(teamMemberServices).values({
    businessId: "biz-lang",
    teamMemberId: "tm-1",
    serviceId: "svc-a",
  })
  await db.insert(translations).values([
    {
      businessId: "biz-lang",
      entityId: "biz-lang",
      field: "business.description",
      language: "es",
      sourceText: "Cozy family barbershop",
      text: "Barbería familiar acogedora",
    },
    {
      businessId: "biz-lang",
      entityId: "svc-a",
      field: "service.name",
      language: "es",
      sourceText: "Classic Cut",
      text: "Corte Clásico",
    },
    {
      // Out of date: the English text changed since.
      businessId: "biz-lang",
      entityId: "svc-a",
      field: "service.description",
      language: "es",
      sourceText: "An old description",
      text: "Una descripción vieja",
    },
    {
      businessId: "biz-lang",
      entityId: "svc-b",
      field: "service.name",
      language: "es",
      sourceText: "Beard Trim",
      text: "Arreglo de Barba",
    },
  ])

  globalThis.fetch = (async (url: string) => {
    seenUrls.push(String(url))
    return new Response(JSON.stringify({}), { status: 200 })
  }) as typeof fetch

  ;({ getBusinessPage } = await import("./get-business-page"))
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("es shows up-to-date translations and English for the stale one", async () => {
  const data = await getBusinessPage("lang-shop", "es")
  expect(data?.language).toBe("es")
  expect(data?.business.description).toBe("Barbería familiar acogedora")
  expect(data?.services.map((service) => service.name)).toEqual([
    "Corte Clásico",
    "Arreglo de Barba",
  ])
  // The svc-a description translation is out of date, so English shows.
  expect(data?.services[0].description).toBe("A tidy haircut")
})

test("en never shows translations", async () => {
  const data = await getBusinessPage("lang-shop", "en")
  expect(data?.language).toBe("en")
  expect(data?.business.description).toBe("Cozy family barbershop")
  expect(data?.services.map((service) => service.name)).toEqual([
    "Classic Cut",
    "Beard Trim",
  ])
})

test("the default call is English", async () => {
  const data = await getBusinessPage("lang-shop")
  expect(data?.language).toBe("en")
  expect(data?.business.description).toBe("Cozy family barbershop")
})

test("serviceTeams maps only services with assignments", async () => {
  const data = await getBusinessPage("lang-shop", "es")
  expect(data?.serviceTeams).toEqual({ "svc-a": ["tm-1"] })
})

// React cache() skips the fetch on repeat calls with the same arguments,
// so this reads the URLs the earlier calls above already asked for.
test("Google Details is asked in the page language", async () => {
  expect(seenUrls.some((url) => url.includes("languageCode=es"))).toBe(true)
  expect(seenUrls.some((url) => url.includes("languageCode=en"))).toBe(true)
  expect(seenUrls.some((url) => url.includes("languageCode=fr"))).toBe(false)
})
