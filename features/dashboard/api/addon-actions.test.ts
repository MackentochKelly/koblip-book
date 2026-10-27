// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import {
  addonOptions,
  businesses,
  services,
  user,
} from "@/lib/db/schema"
import type { AddonGroupInput } from "../types"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { createAddonGroup, updateAddonGroup, deleteAddonGroup, reorderAddonGroups } =
  await import("./addon-actions")
const { getAddonGroups } = await import("./addon-queries")

let closeDb: () => void
let dir: string
let counter = 0

async function seedBusiness(withServices = true): Promise<{ businessId: string; serviceIds: string[] }> {
  const { db } = await import("@/lib/db")
  counter += 1
  const businessId = `biz-addon-${counter}`
  await db.insert(businesses).values({
    id: businessId,
    slug: `addon-shop-${counter}`,
    name: `Addon Shop ${counter}`,
    timezone: "America/Santo_Domingo",
    currency: "DOP",
    ownerId: "u1",
  })
  const serviceIds: string[] = []
  if (withServices) {
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
  }
  return { businessId, serviceIds }
}

function validGroup(serviceIds: string[], overrides: Partial<AddonGroupInput> = {}): AddonGroupInput {
  return {
    name: "Extras",
    prompt: "Choose your extras",
    minSelect: 0,
    maxSelect: null,
    serviceIds,
    options: [
      { id: null, name: "Conditioner", description: "Nice", priceMinor: 500, durationMinutes: 15 },
    ],
    ...overrides,
  }
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-addon-actions-test-"))
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

beforeEach(() => {})

afterEach(() => {
  vi.restoreAllMocks()
})

test("creates a group and reads it back with options and services", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const created = await createAddonGroup(businessId, validGroup(serviceIds))
  expect(created.ok).toBe(true)
  if (!created.ok) {
    return
  }
  const groups = await getAddonGroups(businessId)
  expect(groups).toEqual([
    {
      id: created.groupId,
      name: "Extras",
      prompt: "Choose your extras",
      minSelect: 0,
      maxSelect: null,
      serviceIds,
      options: [
        {
          id: groups[0].options[0].id,
          name: "Conditioner",
          description: "Nice",
          priceMinor: 500,
          durationMinutes: 15,
        },
      ],
    },
  ])
})

test("rejects every invalid input", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const cases: Partial<AddonGroupInput>[] = [
    { name: "   " },
    { name: "x".repeat(BOOKING_RULES.maxAddonName + 1) },
    { prompt: "" },
    { prompt: "x".repeat(BOOKING_RULES.maxAddonPrompt + 1) },
    { options: [] },
    {
      options: Array.from({ length: BOOKING_RULES.maxAddonOptions + 1 }, (_, i) => ({
        id: null,
        name: `Option ${i}`,
        description: null,
        priceMinor: null,
        durationMinutes: 0,
      })),
    },
    { options: [{ id: null, name: "", description: null, priceMinor: null, durationMinutes: 0 }] },
    { options: [{ id: null, name: "x".repeat(BOOKING_RULES.maxAddonName + 1), description: null, priceMinor: null, durationMinutes: 0 }] },
    { options: [{ id: null, name: "Ok", description: "x".repeat(BOOKING_RULES.maxAddonDescription + 1), priceMinor: null, durationMinutes: 0 }] },
    { options: [{ id: null, name: "Ok", description: null, priceMinor: -1, durationMinutes: 0 }] },
    { options: [{ id: null, name: "Ok", description: null, priceMinor: BOOKING_RULES.maxPriceMinor + 1, durationMinutes: 0 }] },
    { options: [{ id: null, name: "Ok", description: null, priceMinor: 1.5, durationMinutes: 0 }] },
    { options: [{ id: null, name: "Ok", description: null, priceMinor: null, durationMinutes: 7 }] },
    { minSelect: -1 },
    { minSelect: 2 },
    { minSelect: 1, maxSelect: 0 },
    { minSelect: 0, maxSelect: 0 },
    { minSelect: 0, maxSelect: 2 },
    { serviceIds: ["nope"] },
    { serviceIds: [serviceIds[0], serviceIds[0]] },
  ]
  for (const patch of cases) {
    await expect(
      createAddonGroup(businessId, validGroup(serviceIds, patch))
    ).resolves.toEqual({ ok: false, error: "invalid" })
  }
  // Empty description becomes null; empty service list is allowed.
  const empty = await createAddonGroup(
    businessId,
    validGroup([], {
      options: [{ id: null, name: "Free", description: "   ", priceMinor: null, durationMinutes: 0 }],
    })
  )
  expect(empty.ok).toBe(true)
})

test("caps the number of groups", async () => {
  const { businessId } = await seedBusiness(false)
  for (let i = 0; i < BOOKING_RULES.maxAddonGroups; i += 1) {
    const created = await createAddonGroup(
      businessId,
      validGroup([], { name: `Group ${i}` })
    )
    expect(created.ok).toBe(true)
  }
  await expect(
    createAddonGroup(businessId, validGroup([], { name: "One more" }))
  ).resolves.toEqual({ ok: false, error: "invalid" })
})

test("update keeps, adds and deletes options and replaces services", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const created = await createAddonGroup(
    businessId,
    validGroup([serviceIds[0]], {
      options: [
        { id: null, name: "Keep", description: null, priceMinor: 100, durationMinutes: 5 },
        { id: null, name: "Drop", description: null, priceMinor: null, durationMinutes: 0 },
      ],
    })
  )
  expect(created.ok).toBe(true)
  if (!created.ok) {
    return
  }
  const [before] = await getAddonGroups(businessId)
  const keepId = before.options[0].id
  const updated = await updateAddonGroup(businessId, created.groupId, {
    name: "Extras 2",
    prompt: "Pick",
    minSelect: 1,
    maxSelect: 2,
    serviceIds: [serviceIds[1]],
    options: [
      { id: keepId, name: "Kept", description: "Now with text", priceMinor: 200, durationMinutes: 10 },
      { id: null, name: "New", description: null, priceMinor: null, durationMinutes: 0 },
    ],
  })
  expect(updated).toEqual({ ok: true })
  const [after] = await getAddonGroups(businessId)
  expect(after).toMatchObject({
    name: "Extras 2",
    prompt: "Pick",
    minSelect: 1,
    maxSelect: 2,
    serviceIds: [serviceIds[1]],
  })
  expect(after.options.map((option) => option.name)).toEqual(["Kept", "New"])
  expect(after.options[0]).toMatchObject({
    id: keepId,
    description: "Now with text",
    priceMinor: 200,
    durationMinutes: 10,
  })
  // The dropped option row is gone.
  const { db } = await import("@/lib/db")
  const leftover = await db
    .select({ id: addonOptions.id })
    .from(addonOptions)
    .where(eq(addonOptions.id, before.options[1].id))
  expect(leftover).toEqual([])
})

test("update rejects foreign option ids and unknown groups", async () => {
  const first = await seedBusiness()
  const second = await seedBusiness()
  const createdA = await createAddonGroup(first.businessId, validGroup(first.serviceIds))
  const createdB = await createAddonGroup(second.businessId, validGroup(second.serviceIds))
  expect(createdA.ok && createdB.ok).toBe(true)
  if (!createdA.ok || !createdB.ok) {
    return
  }
  const [groupB] = await getAddonGroups(second.businessId)
  await expect(
    updateAddonGroup(first.businessId, createdA.groupId, validGroup(first.serviceIds, {
      options: [{ id: groupB.options[0].id, name: "Hijack", description: null, priceMinor: null, durationMinutes: 0 }],
    }))
  ).resolves.toEqual({ ok: false, error: "invalid" })
  await expect(
    updateAddonGroup(first.businessId, "nope", validGroup(first.serviceIds))
  ).resolves.toEqual({ ok: false, error: "not_found" })
  await expect(
    updateAddonGroup(first.businessId, createdB.groupId, validGroup(first.serviceIds))
  ).resolves.toEqual({ ok: false, error: "not_found" })
})

test("delete removes the group and reorder needs the exact set", async () => {
  const { businessId, serviceIds } = await seedBusiness()
  const ids: string[] = []
  for (const name of ["One", "Two", "Three"]) {
    const created = await createAddonGroup(
      businessId,
      validGroup(serviceIds, { name })
    )
    expect(created.ok).toBe(true)
    if (created.ok) {
      ids.push(created.groupId)
    }
  }
  await expect(reorderAddonGroups(businessId, [ids[0]])).resolves.toEqual({
    ok: false,
    error: "invalid",
  })
  await expect(
    reorderAddonGroups(businessId, [...ids, "nope"])
  ).resolves.toEqual({ ok: false, error: "invalid" })
  expect(await reorderAddonGroups(businessId, [...ids].reverse())).toEqual({
    ok: true,
  })
  const groups = await getAddonGroups(businessId)
  expect(groups.map((group) => group.name)).toEqual(["Three", "Two", "One"])
  expect(await deleteAddonGroup(businessId, ids[1])).toEqual({ ok: true })
  const rest = await getAddonGroups(businessId)
  expect(rest.map((group) => group.name).sort()).toEqual(["One", "Three"])
  expect(await deleteAddonGroup(businessId, ids[1])).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("someone else's business is not found", async () => {
  const { serviceIds } = await seedBusiness()
  await expect(
    createAddonGroup("biz-theirs", validGroup(serviceIds))
  ).resolves.toEqual({ ok: false, error: "not_found" })
})
