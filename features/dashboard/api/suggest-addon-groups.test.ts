// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { addonGroups, businesses, services, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { createMock, OpenAiMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
  OpenAiMock: vi.fn(),
}))

vi.mock("openai", () => ({ default: OpenAiMock }))

const { createAddonGroup, suggestAddonGroups } = await import("./addon-actions")

let closeDb: () => void
let dir: string
let counter = 0

async function loadFresh() {
  vi.resetModules()
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
}

function reply(payload: unknown) {
  return { choices: [{ message: { content: JSON.stringify(payload) } }] }
}

async function seedBusiness(): Promise<{
  businessId: string
  serviceIds: string[]
}> {
  const { db } = await import("@/lib/db")
  counter += 1
  const businessId = `biz-suggest-${counter}`
  await db.insert(businesses).values({
    id: businessId,
    slug: `suggest-shop-${counter}`,
    name: `Suggest Shop ${counter}`,
    category: "Barber shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  const serviceIds: string[] = []
  for (const [index, name] of ["Cut", "Color"].entries()) {
    const id = `${businessId}-svc-${index}`
    await db.insert(services).values({
      id,
      businessId,
      name,
      durationMinutes: 30,
      priceMinor: 1000,
      position: index,
    })
    serviceIds.push(id)
  }
  return { businessId, serviceIds }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-suggest-addon-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values({
    id: "biz-theirs",
    slug: "their-shop",
    name: "Their Shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "other",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("returns ai_off when the key is missing", async () => {
  const { businessId } = await seedBusiness()
  await loadFresh()
  vi.stubEnv("MODEL_API_KEY", "")
  const result = await suggestAddonGroups(businessId, "en")
  expect(result).toEqual({ ok: false, error: "ai_off" })
  expect(createMock).not.toHaveBeenCalled()
})

test("returns not_found for someone else's business", async () => {
  await loadFresh()
  const result = await suggestAddonGroups("biz-theirs", "en")
  expect(result).toEqual({ ok: false, error: "not_found" })
  expect(createMock).not.toHaveBeenCalled()
})

test("maps a good reply, snapping durations and dropping unknown serviceIds", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const [svcA] = serviceIds
  await loadFresh()
  createMock.mockResolvedValue(
    reply({
      groups: [
        {
          name: "  Drinks  ",
          prompt: "Add anything?",
          minSelect: 0,
          maxSelect: 9,
          serviceIds: [svcA, "no-such-service", svcA],
          options: [
            { name: "Coffee", description: "  Hot.  ", durationMinutes: 50 },
            { name: "coffee", description: "Dup.", durationMinutes: 10 },
            { name: "Tea", durationMinutes: 7 },
            { name: "   ", durationMinutes: 5 },
          ],
        },
      ],
    })
  )
  const result = await suggestAddonGroups(businessId, "en")
  expect(result).toEqual({
    ok: true,
    groups: [
      {
        name: "Drinks",
        prompt: "Add anything?",
        minSelect: 0,
        maxSelect: 2,
        serviceIds: [svcA],
        options: [
          { name: "Coffee", description: "Hot.", durationMinutes: 45 },
          { name: "Tea", description: null, durationMinutes: 5 },
        ],
      },
    ],
  })
  const sent = createMock.mock.calls[0][0]
  expect(sent.messages[1].content).toContain(`${svcA}: Cut`)
  if (!result.ok) {
    return
  }
  const [group] = result.groups
  const saved = await createAddonGroup(businessId, {
    ...group,
    options: group.options.map((option) => ({
      ...option,
      id: null,
      priceMinor: null,
    })),
  })
  expect(saved.ok).toBe(true)
})

test("skips a group whose name already exists", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const created = await createAddonGroup(businessId, {
    name: "Extras",
    prompt: "Choose your extras",
    minSelect: 0,
    maxSelect: null,
    serviceIds,
    options: [
      {
        id: null,
        name: "Conditioner",
        description: null,
        priceMinor: null,
        durationMinutes: 15,
      },
    ],
  })
  expect(created.ok).toBe(true)
  await loadFresh()
  createMock.mockResolvedValue(
    reply({
      groups: [
        {
          name: "extras",
          prompt: "More?",
          minSelect: 0,
          maxSelect: null,
          serviceIds,
          options: [{ name: "Gel", durationMinutes: 10 }],
        },
        {
          name: "Drinks",
          prompt: "Add anything?",
          minSelect: 0,
          maxSelect: null,
          serviceIds,
          options: [{ name: "Coffee", durationMinutes: 10 }],
        },
      ],
    })
  )
  const result = await suggestAddonGroups(businessId, "en")
  expect(result).toEqual({
    ok: true,
    groups: [
      {
        name: "Drinks",
        prompt: "Add anything?",
        minSelect: 0,
        maxSelect: null,
        serviceIds,
        options: [{ name: "Coffee", description: null, durationMinutes: 10 }],
      },
    ],
  })
})

test("returns failed on bad JSON", async () => {
  const { businessId } = await seedBusiness()
  await loadFresh()
  createMock.mockResolvedValue({
    choices: [{ message: { content: "not json{{" } }],
  })
  const result = await suggestAddonGroups(businessId, "en")
  expect(result).toEqual({ ok: false, error: "failed" })
})

test("sends the Spanish line when language is es", async () => {
  const { businessId } = await seedBusiness()
  await loadFresh()
  createMock.mockResolvedValue(reply({ groups: [] }))
  const result = await suggestAddonGroups(businessId, "es")
  expect(result).toEqual({ ok: true, groups: [] })
  const sent = createMock.mock.calls[0][0]
  expect(sent.messages[0].content).toContain("Spanish")
})

test("returns no groups when the business already has the max", async () => {
  const { businessId } = await seedBusiness()
  const { db } = await import("@/lib/db")
  const { BOOKING_RULES } = await import("@/lib/booking-rules")
  await db
    .insert(addonGroups)
    .values(
      Array.from({ length: BOOKING_RULES.maxAddonGroups }, (_, index) => ({
        businessId,
        name: `Group ${index}`,
        prompt: "Pick?",
      }))
    )
  await loadFresh()
  const result = await suggestAddonGroups(businessId, "en")
  expect(result).toEqual({ ok: true, groups: [] })
  expect(createMock).not.toHaveBeenCalled()
})
