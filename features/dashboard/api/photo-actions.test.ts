// @vitest-environment node
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { asc, eq } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businesses,
  businessPhotos,
  services,
  teamMembers,
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

const { readPhoto } = await import("@/lib/uploads")
const { db } = await import("@/lib/db")
const {
  deleteBusinessPhoto,
  removeServicePhoto,
  removeTeamMemberPhoto,
  reorderBusinessPhotos,
  setServicePhoto,
  setTeamMemberPhoto,
  uploadBusinessPhoto,
} = await import("./photo-actions")

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
])
const TEXT = new TextEncoder().encode("not an image")

function pngForm(name = "p.png"): FormData {
  const form = new FormData()
  form.set("file", new File([PNG], name, { type: "image/png" }))
  return form
}

function textForm(): FormData {
  const form = new FormData()
  form.set("file", new File([TEXT], "x.jpg", { type: "image/jpeg" }))
  return form
}

let dir: string
let uploads: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-photo-test-"))
  uploads = join(dir, "uploads")
  vi.stubEnv("UPLOADS_DIR", uploads)
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
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
      id: "biz-full",
      slug: "full-shop",
      name: "Full Shop",
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
  await db.insert(services).values({
    id: "svc1",
    businessId: "biz-mine",
    name: "Cut",
    durationMinutes: 30,
    position: 0,
  })
  await db.insert(teamMembers).values({
    id: "m1",
    businessId: "biz-mine",
    name: "Ana",
    position: 0,
  })
  await db.insert(businessPhotos).values(
    Array.from({ length: 12 }, (_, i) => ({
      id: `full-${i}`,
      businessId: "biz-full",
      url: `/uploads/${"0".repeat(32)}${String(i).padStart(4, "0")}.jpg`,
      position: i,
    }))
  )
})

afterAll(() => {
  closeDb()
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

test("uploadBusinessPhoto saves the file and a last-position row", async () => {
  const result = await uploadBusinessPhoto("biz-mine", pngForm())
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.photo.url).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/)
  const name = result.photo.url.slice("/uploads/".length)
  expect((await readPhoto(name))?.type).toBe("image/png")
})

test("uploadBusinessPhoto rejects non-images and strangers", async () => {
  expect(await uploadBusinessPhoto("biz-mine", textForm())).toEqual({
    ok: false,
    error: "wrong_type",
  })
  expect(await uploadBusinessPhoto("biz-theirs", pngForm())).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("uploadBusinessPhoto enforces the limit before saving any file", async () => {
  const before = readdirSync(uploads).length
  expect(await uploadBusinessPhoto("biz-full", pngForm())).toEqual({
    ok: false,
    error: "limit",
  })
  expect(readdirSync(uploads).length).toBe(before)
})

test("deleteBusinessPhoto removes the row and the file", async () => {
  const uploaded = await uploadBusinessPhoto("biz-mine", pngForm())
  expect(uploaded.ok).toBe(true)
  if (!uploaded.ok) return
  const name = uploaded.photo.url.slice("/uploads/".length)
  const deleted = await deleteBusinessPhoto("biz-mine", uploaded.photo.id)
  expect(deleted).toEqual({ ok: true })
  expect(await readPhoto(name)).toBeNull()
  expect(await deleteBusinessPhoto("biz-mine", uploaded.photo.id)).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("reorderBusinessPhotos needs exactly the business photos", async () => {
  const first = await uploadBusinessPhoto("biz-mine", pngForm("1.png"))
  const second = await uploadBusinessPhoto("biz-mine", pngForm("2.png"))
  expect(first.ok && second.ok).toBe(true)
  if (!first.ok || !second.ok) return
  const before = await db
    .select({ id: businessPhotos.id })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, "biz-mine"))
    .orderBy(asc(businessPhotos.position))
  const ids = before.map((row) => row.id)
  expect(ids).toContain(first.photo.id)
  expect(ids).toContain(second.photo.id)
  expect(await reorderBusinessPhotos("biz-mine", [first.photo.id])).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(
    await reorderBusinessPhotos("biz-mine", [...ids.slice(0, -1), "nope"])
  ).toEqual({ ok: false, error: "not_found" })
  const reversed = [...ids].reverse()
  expect(await reorderBusinessPhotos("biz-mine", reversed)).toEqual({
    ok: true,
  })
  const rows = await db
    .select({ id: businessPhotos.id, position: businessPhotos.position })
    .from(businessPhotos)
    .where(eq(businessPhotos.businessId, "biz-mine"))
    .orderBy(asc(businessPhotos.position))
  expect(rows.map((row) => row.id)).toEqual(reversed)
})

test("setServicePhoto replaces the old file, removeServicePhoto clears it", async () => {
  const first = await setServicePhoto("biz-mine", "svc1", pngForm())
  expect(first.ok).toBe(true)
  if (!first.ok) return
  const oldName = first.photoUrl.slice("/uploads/".length)
  const second = await setServicePhoto("biz-mine", "svc1", pngForm())
  expect(second.ok).toBe(true)
  if (!second.ok) return
  expect(await readPhoto(oldName)).toBeNull()
  const removed = await removeServicePhoto("biz-mine", "svc1")
  expect(removed).toEqual({ ok: true })
  const [row] = await db
    .select({ photoUrl: services.photoUrl })
    .from(services)
    .where(eq(services.id, "svc1"))
  expect(row?.photoUrl).toBeNull()
  expect(await setServicePhoto("biz-theirs", "svc1", pngForm())).toEqual({
    ok: false,
    error: "not_found",
  })
})

test("team member photos follow the same set/remove rules", async () => {
  const set = await setTeamMemberPhoto("biz-mine", "m1", pngForm())
  expect(set.ok).toBe(true)
  if (!set.ok) return
  const name = set.photoUrl.slice("/uploads/".length)
  expect((await readPhoto(name))?.type).toBe("image/png")
  expect(await removeTeamMemberPhoto("biz-mine", "m1")).toEqual({ ok: true })
  expect(await readPhoto(name)).toBeNull()
  expect(await removeTeamMemberPhoto("biz-mine", "missing")).toEqual({
    ok: false,
    error: "not_found",
  })
})
