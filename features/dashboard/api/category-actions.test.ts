// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { asc, eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import type { GoogleEventColor } from "@/lib/google-calendar-colors"
import { businesses, serviceCategories, services, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
// Saves send their changed texts to Google after the answer (tested in
// lib/translations); here only that they ask to.
const { translateBusinessSoon } = vi.hoisted(() => ({
  translateBusinessSoon: vi.fn(),
}))
vi.mock("@/lib/translations/business-texts", () => ({ translateBusinessSoon }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const { requestGoogleSync } = vi.hoisted(() => ({ requestGoogleSync: vi.fn() }))
vi.mock("@/lib/google-calendar-sync", () => ({ requestGoogleSync }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const {
  createServiceCategory,
  deleteServiceCategory,
  findOrAddServiceCategory,
  updateServiceCategory,
  reorderServiceCategories,
} = await import("./category-actions")
const { createService, updateService } = await import("./actions")

let closeDb: () => void
let dir: string
let db: Awaited<typeof import("@/lib/db")>["db"]

const service = {
  description: null,
  durationMinutes: 30,
  priceMinor: null,
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-categories-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  db = (await import("@/lib/db")).db
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    {
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    },
    {
      id: "other",
      name: "Other",
      email: "other@example.com",
      emailVerified: false,
    },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-mine",
      slug: "my-shop",
      name: "My Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    },
    {
      id: "biz-theirs",
      slug: "their-shop",
      name: "Their Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "other",
    },
  ])
  await db.insert(serviceCategories).values({
    id: "cat-theirs",
    businessId: "biz-theirs",
    name: "Theirs",
  })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

async function myCategories() {
  return db
    .select({ id: serviceCategories.id, name: serviceCategories.name })
    .from(serviceCategories)
    .where(eq(serviceCategories.businessId, "biz-mine"))
    .orderBy(asc(serviceCategories.position))
}

test("adds categories in order, tidies names and refuses the same name", async () => {
  translateBusinessSoon.mockClear()
  const hair = await createServiceCategory("biz-mine", {
    name: "  Hair   cuts ",
  })
  const nails = await createServiceCategory("biz-mine", { name: "Nails" })
  expect(hair.ok && nails.ok).toBe(true)
  // Each new name goes to Google; a refused one never does.
  expect(translateBusinessSoon).toHaveBeenCalledTimes(2)
  expect(await myCategories()).toMatchObject([
    { name: "Hair cuts" },
    { name: "Nails" },
  ])
  expect(await createServiceCategory("biz-mine", { name: "NAILS" })).toEqual({
    ok: false,
    error: "taken",
  })
  expect(await createServiceCategory("biz-mine", { name: "   " })).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(
    await createServiceCategory("biz-mine", {
      name: "x".repeat(BOOKING_RULES.maxServiceCategoryName + 1),
    })
  ).toEqual({ ok: false, error: "invalid" })
  // Another owner's business.
  expect(
    await createServiceCategory("biz-theirs", { name: "Mine now" })
  ).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("finds a category by name or adds it", async () => {
  const [hair] = await myCategories()
  expect(await findOrAddServiceCategory("biz-mine", "hair CUTS")).toEqual({
    ok: true,
    id: hair.id,
  })
  const added = await findOrAddServiceCategory("biz-mine", "Face")
  expect(added.ok).toBe(true)
  expect((await myCategories()).map((category) => category.name)).toEqual([
    "Hair cuts",
    "Nails",
    "Face",
  ])
})

test("changes the name, but never to a name in use or in another business", async () => {
  const [hair, nails] = await myCategories()
  expect(
    await updateServiceCategory("biz-mine", hair.id, { name: "Hair" })
  ).toEqual({
    ok: true,
  })
  // Its own name in other capitals is fine.
  expect(
    await updateServiceCategory("biz-mine", hair.id, { name: "HAIR" })
  ).toEqual({
    ok: true,
  })
  expect(
    await updateServiceCategory("biz-mine", nails.id, { name: "hair" })
  ).toEqual({
    ok: false,
    error: "taken",
  })
  expect(
    await updateServiceCategory("biz-mine", "cat-theirs", {
      name: "Taken over",
    })
  ).toEqual({ ok: false, error: "not_found" })
})

test("a colour is a Google one or none, kept when left out", async () => {
  const [, nails] = await myCategories()
  const colorOf = async (id: string) => {
    const [row] = await db
      .select({ color: serviceCategories.calendarColor })
      .from(serviceCategories)
      .where(eq(serviceCategories.id, id))
    return row?.color
  }
  const change = (calendarColor?: GoogleEventColor | null) =>
    updateServiceCategory("biz-mine", nails.id, {
      name: "Nails",
      ...(calendarColor !== undefined ? { calendarColor } : {}),
    })
  requestGoogleSync.mockClear()

  expect(await change("5")).toEqual({ ok: true })
  expect(await colorOf(nails.id)).toBe("5")
  // Its services' events get it.
  expect(requestGoogleSync).toHaveBeenCalledTimes(1)
  expect(await change()).toEqual({ ok: true })
  expect(await colorOf(nails.id)).toBe("5")
  expect(requestGoogleSync).toHaveBeenCalledTimes(1)
  expect(await change(null)).toEqual({ ok: true })
  expect(await colorOf(nails.id)).toBeNull()
  // Not a Google colour.
  expect(await change("red" as GoogleEventColor)).toEqual({
    ok: false,
    error: "invalid",
  })

  const lashes = await createServiceCategory("biz-mine", {
    name: "Lashes",
    calendarColor: "11",
  })
  expect(lashes.ok).toBe(true)
  if (!lashes.ok) return
  expect(await colorOf(lashes.id)).toBe("11")
  // Removing it takes its colour off its services' events; the tests after
  // count three categories.
  requestGoogleSync.mockClear()
  expect(await deleteServiceCategory("biz-mine", lashes.id)).toEqual({
    ok: true,
  })
  expect(requestGoogleSync).toHaveBeenCalledTimes(1)
})

test("reorders only with every category of the business, once each", async () => {
  const [hair, nails, face] = await myCategories()
  expect(
    await reorderServiceCategories("biz-mine", [face.id, hair.id, nails.id])
  ).toEqual({ ok: true })
  expect((await myCategories()).map((category) => category.id)).toEqual([
    face.id,
    hair.id,
    nails.id,
  ])
  for (const ids of [
    [face.id, hair.id],
    [face.id, hair.id, hair.id],
    [face.id, hair.id, "cat-theirs"],
  ]) {
    expect(await reorderServiceCategories("biz-mine", ids)).toEqual({
      ok: false,
      error: "invalid",
    })
  }
})

test("a service goes only in the business's own category, last in it", async () => {
  const [face, hair] = await myCategories()
  const cut = await createService("biz-mine", {
    ...service,
    name: "Cut",
    categoryId: hair.id,
  })
  const facial = await createService("biz-mine", {
    ...service,
    name: "Facial",
    categoryId: face.id,
  })
  expect(cut.ok && facial.ok).toBe(true)
  expect(
    await createService("biz-mine", {
      ...service,
      name: "Sneaky",
      categoryId: "cat-theirs",
    })
  ).toEqual({ ok: false, error: "invalid" })
  if (!cut.ok || !facial.ok) return

  // Moved to Face, it goes after Facial.
  expect(
    await updateService("biz-mine", cut.id, {
      ...service,
      name: "Cut",
      categoryId: face.id,
    })
  ).toEqual({ ok: true })
  const rows = await db
    .select({
      id: services.id,
      categoryId: services.categoryId,
      position: services.position,
    })
    .from(services)
    .where(eq(services.businessId, "biz-mine"))
  const moved = rows.find((row) => row.id === cut.id)
  const other = rows.find((row) => row.id === facial.id)
  expect(moved?.categoryId).toBe(face.id)
  expect(moved!.position).toBeGreaterThan(other!.position)

  // Left out, the category stays; another business's is refused.
  await updateService("biz-mine", cut.id, { ...service, name: "Cut 2" })
  const [kept] = await db
    .select({ categoryId: services.categoryId })
    .from(services)
    .where(eq(services.id, cut.id))
  expect(kept.categoryId).toBe(face.id)
  expect(
    await updateService("biz-mine", cut.id, {
      ...service,
      name: "Cut",
      categoryId: "cat-theirs",
    })
  ).toEqual({ ok: false, error: "invalid" })
})

test("removing a category moves its services to Other, never removes them", async () => {
  const [face] = await myCategories()
  expect(await deleteServiceCategory("biz-mine", "cat-theirs")).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await deleteServiceCategory("biz-mine", face.id)).toEqual({ ok: true })
  const rows = await db
    .select({ name: services.name, categoryId: services.categoryId })
    .from(services)
    .where(eq(services.businessId, "biz-mine"))
  expect(rows.map((row) => row.name).sort()).toEqual(["Cut 2", "Facial"])
  expect(rows.every((row) => row.categoryId === null)).toBe(true)
  expect(
    (await myCategories()).some((category) => category.id === face.id)
  ).toBe(false)
})

test("stops at the most categories a business may have", async () => {
  const count = (await myCategories()).length
  for (let n = count; n < BOOKING_RULES.maxServiceCategories; n++) {
    expect(
      (await createServiceCategory("biz-mine", { name: `Group ${n}` })).ok
    ).toBe(true)
  }
  expect(
    await createServiceCategory("biz-mine", { name: "One too many" })
  ).toEqual({
    ok: false,
    error: "invalid",
  })
})
