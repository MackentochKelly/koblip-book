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
  services,
  teamMembers,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({ userId: "u1", name: "Owner", email: "owner@example.com" })),
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
  expect(result.ok && result.summary.created).toBe(false)
  expect(await startStarterCatalog(await seedBusiness("other"))).toEqual({ ok: false, error: "not_found" })
  expect(createMock).not.toHaveBeenCalled()
})

test("draws a team photo once, from saved facts", async () => {
  const { drawTeamPhoto } = await import("./prepare-actions")
  const { db } = await import("@/lib/db")
  const businessId = await seedBusiness()
  const [member] = await db
    .insert(teamMembers)
    .values({ businessId, name: "Ana", description: "Classic cuts." })
    .returning()
  generateMock.mockResolvedValue({ data: [{ b64_json: Buffer.from("img").toString("base64") }] })
  savePhotoMock.mockResolvedValue({ ok: true, url: "/uploads/ana.webp" })

  expect(await drawTeamPhoto(businessId, member.id)).toEqual({ ok: true, photoUrl: "/uploads/ana.webp" })
  expect(generateMock.mock.calls[0][0]).toMatchObject({ model: "muse-image-1.0", reasoning_strength: "low" })
  expect(generateMock.mock.calls[0][0].prompt).toContain("Ana, who works at a barber shop (Classic cuts.)")

  expect(await drawTeamPhoto(businessId, member.id)).toEqual({ ok: false })
  expect(generateMock).toHaveBeenCalledTimes(1)
})
