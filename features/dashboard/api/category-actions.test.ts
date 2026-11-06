// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { asc, eq } from "drizzle-orm"
import { BOOKING_RULES } from "@/lib/booking-rules"
import {
  businesses,
  serviceCategories,
  services,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
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
  renameServiceCategory,
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
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
    { id: "other", name: "Other", email: "other@example.com", emailVerified: false },
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
  const hair = await createServiceCategory("biz-mine", "  Hair   cuts ")
  const nails = await createServiceCategory("biz-mine", "Nails")
  expect(hair.ok && nails.ok).toBe(true)
  expect(await myCategories()).toMatchObject([
    { name: "Hair cuts" },
    { name: "Nails" },
  ])
  expect(await createServiceCategory("biz-mine", "NAILS")).toEqual({
    ok: false,
    error: "taken",
  })
  expect(await createServiceCategory("biz-mine", "   ")).toEqual({
    ok: false,
    error: "invalid",
  })
  expect(
    await createServiceCategory(
      "biz-mine",
      "x".repeat(BOOKING_RULES.maxServiceCategoryName + 1)
    )
  ).toEqual({ ok: false, error: "invalid" })
  // Another owner's business.
  expect(await createServiceCategory("biz-theirs", "Mine now")).toEqual({
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

test("renames, but never to a name in use or in another business", async () => {
  const [hair, nails] = await myCategories()
  expect(await renameServiceCategory("biz-mine", hair.id, "Hair")).toEqual({
    ok: true,
  })
  // Its own name in other capitals is fine.
  expect(await renameServiceCategory("biz-mine", hair.id, "HAIR")).toEqual({
    ok: true,
  })
  expect(await renameServiceCategory("biz-mine", nails.id, "hair")).toEqual({
    ok: false,
    error: "taken",
  })
  expect(
    await renameServiceCategory("biz-mine", "cat-theirs", "Taken over")
  ).toEqual({ ok: false, error: "not_found" })
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
    .select({ id: services.id, categoryId: services.categoryId, position: services.position })
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
  expect((await myCategories()).some((category) => category.id === face.id)).toBe(
    false
  )
})

test("stops at the most categories a business may have", async () => {
  const count = (await myCategories()).length
  for (let n = count; n < BOOKING_RULES.maxServiceCategories; n++) {
    expect((await createServiceCategory("biz-mine", `Group ${n}`)).ok).toBe(true)
  }
  expect(await createServiceCategory("biz-mine", "One too many")).toEqual({
    ok: false,
    error: "invalid",
  })
})
