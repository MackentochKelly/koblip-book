// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { asc } from "drizzle-orm"
import { businesses, serviceCategories, services } from "@/lib/db/schema"

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }))
vi.mock("server-only", () => ({}))
// Saves send their changed texts to Google after the answer (tested in
// lib/translations); here only that they ask to.
const { translateBusinessSoon } = vi.hoisted(() => ({
  translateBusinessSoon: vi.fn(),
}))
vi.mock("@/lib/translations/business-texts", () => ({ translateBusinessSoon }))
vi.mock("next/cache", () => ({ revalidatePath }))
vi.mock("next/headers", () => ({ headers: async () => new Headers() }))
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }))
vi.mock("@/lib/account-voices", () => ({ getAccountVoices: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))

const { getServiceCategories } = await import("./queries")
const { adminDeleteServiceCategory } = await import("./actions")
const { requireAdmin } = await import("@/lib/dal")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-service-categories-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(businesses).values(
    [
      { id: "salon", name: "Salon" },
      { id: "barber", name: "Barber" },
      { id: "plain", name: "Plain" },
      { id: "demo", name: "Demo", isDemo: true },
    ].map((business) => ({
      ...business,
      slug: business.id,
      timezone: "UTC",
      currency: "USD",
    }))
  )
  await db.insert(serviceCategories).values([
    { id: "nails", businessId: "salon", name: "Nails", position: 1 },
    { id: "hair", businessId: "salon", name: "Hair", position: 0 },
    { id: "beard", businessId: "barber", name: "Beard", position: 0 },
    { id: "demo-hair", businessId: "demo", name: "Hair", position: 0 },
  ])
  await db.insert(services).values(
    [
      { id: "cut", businessId: "salon", categoryId: "hair" },
      { id: "color", businessId: "salon", categoryId: "hair" },
      { id: "manicure", businessId: "salon", categoryId: "nails" },
      { id: "consult", businessId: "salon", categoryId: null },
      { id: "trim", businessId: "barber", categoryId: null },
      { id: "plain-cut", businessId: "plain", categoryId: null },
    ].map((service) => ({ ...service, name: service.id, durationMinutes: 30 }))
  )
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.clearAllMocks()
})

test("each business with categories, by name, its categories in order with their services", async () => {
  expect(await getServiceCategories()).toEqual([
    {
      id: "barber",
      name: "Barber",
      categories: [{ id: "beard", name: "Beard", services: 0 }],
    },
    {
      id: "salon",
      name: "Salon",
      categories: [
        { id: "hair", name: "Hair", services: 2 },
        { id: "nails", name: "Nails", services: 1 },
      ],
    },
  ])
  expect(requireAdmin).toHaveBeenCalledOnce()
})

test("removing a category moves its services to Other, never removes them", async () => {
  expect(await adminDeleteServiceCategory("hair")).toEqual({ ok: true })
  expect(requireAdmin).toHaveBeenCalledOnce()
  const rows = await db
    .select({ id: services.id, categoryId: services.categoryId })
    .from(services)
    .orderBy(asc(services.id))
  expect(rows).toEqual([
    { id: "color", categoryId: null },
    { id: "consult", categoryId: null },
    { id: "cut", categoryId: null },
    { id: "manicure", categoryId: "nails" },
    { id: "plain-cut", categoryId: null },
    { id: "trim", categoryId: null },
  ])
  expect(
    (await getServiceCategories()).find((business) => business.id === "salon")
      ?.categories
  ).toEqual([{ id: "nails", name: "Nails", services: 1 }])
  // The admin page, the business's page and the owner area show it.
  expect(revalidatePath).toHaveBeenCalledWith("/admin/service-categories")
  expect(revalidatePath).toHaveBeenCalledWith("/b/salon")
  expect(revalidatePath).toHaveBeenCalledWith("/dashboard", "layout")
})

test("one already gone is done; a bad id is refused", async () => {
  expect(await adminDeleteServiceCategory("hair")).toEqual({ ok: true })
  expect(revalidatePath).not.toHaveBeenCalledWith("/b/salon")
  expect(await adminDeleteServiceCategory(1 as never)).toEqual({ ok: false })
  expect(await db.select().from(serviceCategories)).toHaveLength(3)
})
