// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest"
import {
  addonGroups,
  addonOptions,
  businesses,
  serviceAddonGroups,
  serviceCategories,
  services,
  teamMembers,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireAccount: vi.fn(async () => ({ userId: "u1", name: "Owner", email: "owner@example.com" })),
}))

const { createMock, generateMock, savePhotoMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  generateMock: vi.fn(),
  savePhotoMock: vi.fn(),
}))

vi.mock("openai", () => ({
  default: vi.fn(function (this: unknown) {
    return { chat: { completions: { create: createMock } }, images: { generate: generateMock } }
  }),
}))
vi.mock("@/lib/uploads", () => ({ savePhoto: savePhotoMock, deletePhoto: vi.fn() }))

let closeDb: () => void
let dir: string
let counter = 0

const item = (name: string, price = 20) => ({ name, description: "Done well.", durationMinutes: 30, price })
const catalog = {
  services: [item("Haircut"), item("Beard trim"), item("Kids cut"), item("Shave", 25)],
  extras: { name: "Add-ons", prompt: "Anything else?", options: [item("Wash", 5), item("Brows", 4), item("Mask", 8)] },
  team: {
    role: "Barber",
    members: [
      { name: "Luis", description: "Skin fades." },
      { name: "Ana", description: "Classic cuts." },
      { name: "Marco", description: "Beards." },
    ],
  },
}
const reply = (payload: unknown) => ({ choices: [{ message: { content: JSON.stringify(payload) } }] })

async function seedBusiness(ownerId = "u1") {
  const { db } = await import("@/lib/db")
  counter += 1
  const id = `biz-starter-${counter}`
  await db.insert(businesses).values({
    id,
    slug: `starter-shop-${counter}`,
    name: `Starter Shop ${counter}`,
    category: "Barber shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId,
  })
  return id
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-starter-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

beforeEach(() => {
  vi.stubEnv("MODEL_API_KEY", "test-key")
  vi.spyOn(console, "error").mockImplementation(() => {})
  createMock.mockReset()
  generateMock.mockReset()
  savePhotoMock.mockReset()
})

test("writes services, extras, prices and team, all linked", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const businessId = await seedBusiness()
  createMock.mockResolvedValue(reply(catalog))

  const result = await startStarterCatalog(businessId)

  expect(result.ok && result.summary).toMatchObject({
    created: true,
    role: "Barber",
    currency: "DOP",
    extras: ["Wash", "Brows", "Mask"],
  })
  const rows = await db.select().from(services).where(eq(services.businessId, businessId))
  expect(rows.map((row) => row.priceMinor).sort()).toEqual([2000, 2000, 2000, 2500])
  expect(await db.select().from(addonGroups).where(eq(addonGroups.businessId, businessId))).toHaveLength(1)
  expect(await db.select().from(addonOptions).where(eq(addonOptions.businessId, businessId))).toHaveLength(3)
  expect(await db.select().from(serviceAddonGroups).where(eq(serviceAddonGroups.businessId, businessId))).toHaveLength(4)
  expect(await db.select().from(teamMembers).where(eq(teamMembers.businessId, businessId))).toHaveLength(3)
})

// The fixture with each service's category, in order.
const grouped = (...categories: string[]) => ({
  ...catalog,
  services: catalog.services.map((service, index) => ({ ...service, category: categories[index] })),
})

async function savedGroups(businessId: string) {
  const { db } = await import("@/lib/db")
  const { asc, eq } = await import("drizzle-orm")
  const categories = await db
    .select()
    .from(serviceCategories)
    .where(eq(serviceCategories.businessId, businessId))
    .orderBy(asc(serviceCategories.position))
  const rows = await db
    .select()
    .from(services)
    .where(eq(services.businessId, businessId))
    .orderBy(asc(services.position))
  const names = new Map(categories.map((category) => [category.id, category.name]))
  return {
    categories: categories.map((category) => category.name),
    services: rows.map((row) => [row.name, row.categoryId === null ? null : names.get(row.categoryId)]),
  }
}

test("saves the catalog's categories in first-seen order, with their services", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const businessId = await seedBusiness()
  createMock.mockResolvedValue(reply(grouped("Haircuts", "Beard", "haircuts", "Beard")))

  await startStarterCatalog(businessId)

  expect(await savedGroups(businessId)).toEqual({
    categories: ["Haircuts", "Beard"],
    services: [
      ["Haircut", "Haircuts"],
      ["Beard trim", "Beard"],
      ["Kids cut", "Haircuts"],
      ["Shave", "Beard"],
    ],
  })
  const schema = createMock.mock.calls[0][0].response_format.json_schema.schema
  expect(schema.properties.services.items.required).toContain("category")
})

test("a catalog of one kind is saved flat, with no category", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const businessId = await seedBusiness()
  createMock.mockResolvedValue(reply(grouped("Haircuts", "Haircuts", "Haircuts", "Haircuts")))

  await startStarterCatalog(businessId)

  const saved = await savedGroups(businessId)
  expect(saved.categories).toEqual([])
  expect(saved.services.every(([, category]) => category === null)).toBe(true)
})

test("sends failed checks back to the model once, then gives up", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const businessId = await seedBusiness()
  createMock.mockResolvedValue(reply({ ...catalog, services: [] }))

  expect(await startStarterCatalog(businessId)).toEqual({ ok: false, error: "failed" })
  expect(createMock).toHaveBeenCalledTimes(2)
  const retry = createMock.mock.calls[1][0].messages.at(-1).content
  expect(retry).toContain("Give 4 to 6 services, not 0.")
})

test("never touches a business that already has services, or someone else's", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const { db } = await import("@/lib/db")
  const businessId = await seedBusiness()
  await db.insert(services).values({ businessId, name: "Own cut", durationMinutes: 30 })

  const result = await startStarterCatalog(businessId)
  expect(result.ok && result.summary.created).toBe(true)
  expect(await startStarterCatalog(await seedBusiness("other"))).toEqual({ ok: false, error: "not_found" })
  expect(createMock).not.toHaveBeenCalled()
})

test("draws a team photo once, from saved facts", async () => {
  const { drawTeamPhoto } = await import("./prepare-actions")
  const { db } = await import("@/lib/db")
  const businessId = await seedBusiness()
  const [member] = await db
    .insert(teamMembers)
    .values({ businessId, name: "Ana", description: "Classic cuts.", position: 1 })
    .returning()
  generateMock.mockResolvedValue({ data: [{ b64_json: Buffer.from("img").toString("base64") }] })
  savePhotoMock.mockResolvedValue({ ok: true, url: "/uploads/ana.webp" })

  expect(await drawTeamPhoto(businessId, member.id)).toEqual({ ok: true, photoUrl: "/uploads/ana.webp" })
  expect(generateMock.mock.calls[0][0]).toMatchObject({ model: "muse-image-1.0", reasoning_strength: "low" })
  const { portraitLook } = await import("../utils/portrait-look")
  expect(generateMock.mock.calls[0][0].prompt).toContain(
    `Ana, ${portraitLook(1)}, who works at a barber shop (Classic cuts.)`
  )

  // The setup screen asking again gets the same photo, never a second one.
  expect(await drawTeamPhoto(businessId, member.id)).toEqual({ ok: true, photoUrl: "/uploads/ana.webp" })
  expect(generateMock).toHaveBeenCalledTimes(1)
})

test("the refill swaps the old catalog for the new one in one save", async () => {
  const { replaceCatalog } = await import("./fill-catalog")
  const { checkCatalog } = await import("../utils/check-catalog")
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const businessId = await seedBusiness()
  const [oldCategory] = await db
    .insert(serviceCategories)
    .values({ businessId, name: "Old cuts" })
    .returning()
  await db.insert(services).values({ businessId, name: "Old cut", durationMinutes: 30, categoryId: oldCategory.id })
  await db.insert(teamMembers).values({ businessId, name: "Old barber" })
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId))
  const check = checkCatalog(grouped("Haircuts", "Beard", "Haircuts", "Beard"))
  if (!check.ok) throw new Error("bad fixture")

  await replaceCatalog(business, check.catalog)

  const names = (await db.select().from(services).where(eq(services.businessId, businessId))).map((row) => row.name)
  expect(names).not.toContain("Old cut")
  expect(names).toHaveLength(4)
  expect((await savedGroups(businessId)).categories).toEqual(["Haircuts", "Beard"])
  const team = (await db.select().from(teamMembers).where(eq(teamMembers.businessId, businessId))).map((row) => row.name)
  expect(team).toEqual(["Luis", "Ana", "Marco"])
})

test("finishSetup saves once for the owner and refuses other owners and demos", async () => {
  const { finishSetup } = await import("./prepare-actions")
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const own = await seedBusiness()
  const other = await seedBusiness("other")
  const demo = await seedBusiness()
  await db.update(businesses).set({ isDemo: true }).where(eq(businesses.id, demo))
  const read = async (id: string) => (await db.select().from(businesses).where(eq(businesses.id, id)))[0]

  const before = Date.now()
  expect(await finishSetup(own)).toEqual({ ok: true })
  const finished = (await read(own)).setupFinishedAt
  expect(finished).toBeGreaterThanOrEqual(before)
  expect(finished).toBeLessThanOrEqual(Date.now())
  expect(await finishSetup(own)).toEqual({ ok: true })
  expect((await read(own)).setupFinishedAt).toBe(finished)
  expect(await finishSetup(other)).toEqual({ ok: false })
  expect(await finishSetup(demo)).toEqual({ ok: false })
  expect(await finishSetup("missing")).toEqual({ ok: false })
  expect((await read(other)).setupFinishedAt).toBeNull()
  expect((await read(demo)).setupFinishedAt).toBeNull()
})

test("finished setup starts no catalog, policies or photos", async () => {
  const { finishSetup, startStarterCatalog, startPolicies, drawTeamPhoto } = await import("./prepare-actions")
  const businessId = await seedBusiness()
  await finishSetup(businessId)
  const result = await startStarterCatalog(businessId)
  expect(result.ok && result.summary.created).toBe(false)
  expect(await startPolicies(businessId)).toEqual({ ok: false })
  expect(await drawTeamPhoto(businessId, "member")).toEqual({ ok: false })
  expect(createMock).not.toHaveBeenCalled()
  expect(generateMock).not.toHaveBeenCalled()
})

test("a saved catalog survives losing the job store without being written again", async () => {
  const { startStarterCatalog } = await import("./prepare-actions")
  const { startPreparing } = await import("./prepare-jobs")
  const { db } = await import("@/lib/db")
  const { eq } = await import("drizzle-orm")
  const businessId = await seedBusiness()
  createMock.mockResolvedValue(reply(catalog))
  await startStarterCatalog(businessId)
  ;(globalThis as typeof globalThis & { koblipPrepareJobs?: Map<string, Promise<unknown>> }).koblipPrepareJobs?.clear()
  const resumed = await startStarterCatalog(businessId)
  expect(resumed.ok && resumed.summary.created).toBe(true)
  expect(createMock).toHaveBeenCalledTimes(1)
  expect(await db.select().from(services).where(eq(services.businessId, businessId))).toHaveLength(4)
  const [business] = await db.select().from(businesses).where(eq(businesses.id, businessId))
  generateMock.mockResolvedValue({ data: [{ b64_json: Buffer.from("img").toString("base64") }] })
  savePhotoMock.mockResolvedValue({ ok: true, url: "/uploads/team.webp" })
  const translate = vi.fn(async () => {})
  await startPreparing(business, translate)
  expect(translate).toHaveBeenCalledTimes(1)
  const { drawTeamPhoto } = await import("./prepare-actions")
  if (resumed.ok) {
    await Promise.all(resumed.summary.team.map((member) => drawTeamPhoto(businessId, member.id)))
  }
  expect(generateMock).toHaveBeenCalledTimes(3)
})
