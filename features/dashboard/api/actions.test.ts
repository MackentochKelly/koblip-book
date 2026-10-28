// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { businesses, services, user } from "@/lib/db/schema"
import type { BusinessDetailsInput } from "../types"

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
  })
  expect(result.services[1]).toEqual({
    name: "Deluxe",
    description: null,
    durationMinutes: 90,
  })
  expect(
    result.services.every((service) => service.name !== "classic cut")
  ).toBe(true)
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

test("confirmBusinessDetails stamps the owner's business only", async () => {
  const { actions, db } = await freshActions()
  const before = Date.now()

  await expect(confirmedValue(db, "biz-mine")).resolves.toBeNull()
  await expect(actions.confirmBusinessDetails("biz-mine")).resolves.toEqual({
    ok: true,
  })
  const stamped = await confirmedValue(db, "biz-mine")
  expect(typeof stamped).toBe("number")
  expect(stamped as number).toBeGreaterThanOrEqual(before)

  await expect(actions.confirmBusinessDetails("biz-theirs")).resolves.toEqual(
    { ok: false, error: "not_found" }
  )
  await expect(confirmedValue(db, "biz-theirs")).resolves.toBeNull()
  await expect(actions.confirmBusinessDetails("no-such-biz")).resolves.toEqual(
    { ok: false, error: "not_found" }
  )
})

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
