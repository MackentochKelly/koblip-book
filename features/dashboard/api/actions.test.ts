// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { businesses, serviceCategories, services, user } from "@/lib/db/schema"
import type { BusinessDetailsInput } from "../types"

vi.mock("server-only", () => ({}))
// Saves send their changed texts to Google after the answer (tested in
// lib/translations); here only that they ask to.
const { translateBusinessSoon } = vi.hoisted(() => ({
  translateBusinessSoon: vi.fn(),
}))
vi.mock("@/lib/translations/business-texts", () => ({ translateBusinessSoon }))
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

const { suggestServices } = await import("./actions")

let closeDb: () => void
let dir: string

async function loadFresh() {
  vi.resetModules()
  createMock.mockReset()
  OpenAiMock.mockClear()
  OpenAiMock.mockImplementation(function (this: unknown) {
    return { chat: { completions: { create: createMock } } }
  })
  vi.stubEnv("MODEL_API_KEY", "test-key")
}

function reply(services: unknown[]) {
  return { choices: [{ message: { content: JSON.stringify({ services }) } }] }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-suggest-test-"))
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
    id: "biz-mine",
    slug: "my-shop",
    name: "My Shop",
    category: "Barber shop",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  await db.insert(services).values({
    id: "svc-existing",
    businessId: "biz-mine",
    name: "Classic Cut",
    durationMinutes: 30,
    position: 0,
  })
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

test("snaps durations, drops duplicates and long names, caps at 8", async () => {
  await loadFresh()
  createMock.mockResolvedValue(
    reply([
      { name: "Beard Trim", description: "  Tidy up.  ", durationMinutes: 50 },
      { name: "classic cut", durationMinutes: 30 },
      { name: "x".repeat(81), durationMinutes: 30 },
      { name: "   ", durationMinutes: 30 },
      { name: "Deluxe", durationMinutes: 100 },
      ...Array.from({ length: 8 }, (_, i) => ({
        name: `Extra ${i}`,
        durationMinutes: 30,
      })),
    ])
  )
  const result = await suggestServices("biz-mine", "en")
  expect(result.ok).toBe(true)
  if (!result.ok) {
    return
  }
  expect(result.services).toHaveLength(8)
  expect(result.services[0]).toEqual({
    name: "Beard Trim",
    description: "Tidy up.",
    durationMinutes: 45,
    category: null,
  })
  expect(result.services[1]).toEqual({
    name: "Deluxe",
    description: null,
    durationMinutes: 90,
    category: null,
  })
  expect(
    result.services.every((service) => service.name !== "classic cut")
  ).toBe(true)
})

test("gives each suggestion an existing category's spelling, a new short one, or none", async () => {
  await loadFresh()
  const { db } = await import("@/lib/db")
  await db.insert(serviceCategories).values([
    { id: "cat-cuts", businessId: "biz-mine", name: "Haircuts", position: 0 },
    { id: "cat-beard", businessId: "biz-mine", name: "Beard", position: 1 },
  ])
  createMock.mockResolvedValue(
    reply([
      { name: "Skin Fade", durationMinutes: 30, category: " haircuts " },
      { name: "Beard Oil", durationMinutes: 15, category: "BEARD" },
      { name: "Hot Towel Shave", durationMinutes: 30, category: "  Shaves  " },
      { name: "Kids Cut", durationMinutes: 30, category: "x".repeat(41) },
      { name: "Hair Wash", durationMinutes: 15, category: "   " },
      { name: "Eyebrows", durationMinutes: 15 },
      { name: "Scalp Massage", durationMinutes: 15, category: 7 },
    ])
  )
  try {
    const result = await suggestServices("biz-mine", "en")
    expect(result.ok && result.services.map((service) => service.category)).toEqual([
      "Haircuts",
      "Beard",
      "Shaves",
      null,
      null,
      null,
      null,
    ])
    const request = createMock.mock.calls[0][0]
    expect(request.messages[1].content).toContain(
      "Existing service categories: Haircuts, Beard"
    )
    expect(request.messages[1].content).toContain("Business type: Barber shop")
    const item =
      request.response_format.json_schema.schema.properties.services.items
    expect(item.properties.category).toEqual({ type: "string" })
    expect(item.required).toContain("category")
  } finally {
    await db
      .delete(serviceCategories)
      .where(eq(serviceCategories.businessId, "biz-mine"))
  }
})

test("leaves the categories line out for a business with none", async () => {
  await loadFresh()
  createMock.mockResolvedValue(
    reply([{ name: "Skin Fade", durationMinutes: 30, category: "Haircuts" }])
  )
  const result = await suggestServices("biz-mine", "en")
  expect(result.ok && result.services[0].category).toBe("Haircuts")
  expect(createMock.mock.calls[0][0].messages[1].content).not.toContain(
    "service categories"
  )
})

test("returns ai_off when the key is missing", async () => {
  await loadFresh()
  vi.stubEnv("MODEL_API_KEY", "")
  const result = await suggestServices("biz-mine", "en")
  expect(result).toEqual({ ok: false, error: "ai_off" })
  expect(createMock).not.toHaveBeenCalled()
})

test("returns failed when the AI errors", async () => {
  await loadFresh()
  createMock.mockRejectedValueOnce(new Error("boom"))
  const result = await suggestServices("biz-mine", "en")
  expect(result).toEqual({ ok: false, error: "failed" })
})

test("returns not_found for someone else's business", async () => {
  await loadFresh()
  const result = await suggestServices("biz-theirs", "en")
  expect(result).toEqual({ ok: false, error: "not_found" })
  expect(createMock).not.toHaveBeenCalled()
})

async function freshActions() {
  await loadFresh()
  return {
    actions: await import("./actions"),
    db: (await import("@/lib/db")).db,
  }
}

async function confirmedValue(
  db: import("@/lib/db").Database,
  id: string
): Promise<number | null> {
  const [row] = await db
    .select({ detailsConfirmedAt: businesses.detailsConfirmedAt })
    .from(businesses)
    .where(eq(businesses.id, id))
  return row?.detailsConfirmedAt ?? null
}

test("saving details or hours also confirms them", async () => {
  const { actions, db } = await freshActions()
  const before = Date.now()

  await expect(
    actions.updateBusinessDetails("biz-mine", {
      name: "My Shop",
      address: null,
      description: "About us",
      phone: null,
      website: null,
      seats: 1,
    })
  ).resolves.toEqual({ ok: true })
  expect(await confirmedValue(db, "biz-mine")).toBeGreaterThanOrEqual(before)

  await db
    .update(businesses)
    .set({ detailsConfirmedAt: null })
    .where(eq(businesses.id, "biz-mine"))
  await expect(
    actions.saveHours("biz-mine", [
      { weekday: 1, opensAt: "09:00", closesAt: "18:00" },
    ])
  ).resolves.toEqual({ ok: true })
  expect(await confirmedValue(db, "biz-mine")).toBeGreaterThanOrEqual(before)
})

async function businessRow(
  db: import("@/lib/db").Database,
  id: string
) {
  const [row] = await db
    .select({
      slug: businesses.slug,
      name: businesses.name,
      address: businesses.address,
    })
    .from(businesses)
    .where(eq(businesses.id, id))
  return row
}

function details(
  overrides: Partial<BusinessDetailsInput> = {}
): BusinessDetailsInput {
  return {
    name: "My Shop",
    address: "1 Main St",
    description: null,
    phone: null,
    website: null,
    seats: 1,
    ...overrides,
  }
}

test("updateBusinessDetails saves a new name and address, slug unchanged", async () => {
  const { actions, db } = await freshActions()

  await expect(
    actions.updateBusinessDetails(
      "biz-mine",
      details({ name: "  New Name  ", address: "  2 Other St  " })
    )
  ).resolves.toEqual({ ok: true })
  expect(await businessRow(db, "biz-mine")).toMatchObject({
    slug: "my-shop",
    name: "New Name",
    address: "2 Other St",
  })
  // Its About goes to Google if it changed.
  expect(translateBusinessSoon).toHaveBeenCalledWith("biz-mine")
})

test("updateBusinessDetails changes the currency, and keeps it when left out", async () => {
  const { actions, db } = await freshActions()
  const currencyOf = async () =>
    (
      await db
        .select({ currency: businesses.currency })
        .from(businesses)
        .where(eq(businesses.id, "biz-mine"))
    )[0]?.currency

  await expect(
    actions.updateBusinessDetails("biz-mine", details({ currency: "DOP" }))
  ).resolves.toEqual({ ok: true })
  expect(await currencyOf()).toBe("DOP")
  await expect(
    actions.updateBusinessDetails("biz-mine", details())
  ).resolves.toEqual({ ok: true })
  expect(await currencyOf()).toBe("DOP")
  for (const currency of ["", "dop", "XYZ1", "NOTACODE"]) {
    await expect(
      actions.updateBusinessDetails("biz-mine", details({ currency }))
    ).resolves.toEqual({ ok: false, error: "invalid" })
  }
  expect(await currencyOf()).toBe("DOP")
})

test("updateBusinessDetails refuses a bad name and saves nothing", async () => {
  const { actions, db } = await freshActions()
  const before = await businessRow(db, "biz-mine")

  for (const name of ["", "   ", "x".repeat(BOOKING_RULES.maxBusinessName + 1)]) {
    await expect(
      actions.updateBusinessDetails("biz-mine", details({ name }))
    ).resolves.toEqual({ ok: false, error: "invalid" })
  }
  expect(await businessRow(db, "biz-mine")).toEqual(before)
})

test("updateBusinessDetails refuses an address over the max", async () => {
  const { actions, db } = await freshActions()
  const before = await businessRow(db, "biz-mine")

  await expect(
    actions.updateBusinessDetails(
      "biz-mine",
      details({ address: "x".repeat(BOOKING_RULES.maxBusinessAddress + 1) })
    )
  ).resolves.toEqual({ ok: false, error: "invalid" })
  expect(await businessRow(db, "biz-mine")).toEqual(before)
})

test("updateBusinessDetails saves an empty address as null", async () => {
  const { actions, db } = await freshActions()

  await expect(
    actions.updateBusinessDetails("biz-mine", details({ address: "   " }))
  ).resolves.toEqual({ ok: true })
  expect((await businessRow(db, "biz-mine"))?.address).toBeNull()
})

test("updateBusinessDetails refuses someone else's business", async () => {
  const { actions, db } = await freshActions()
  const before = await businessRow(db, "biz-theirs")

  await expect(
    actions.updateBusinessDetails("biz-theirs", details())
  ).resolves.toEqual({ ok: false, error: "not_found" })
  expect(await businessRow(db, "biz-theirs")).toEqual(before)
})
