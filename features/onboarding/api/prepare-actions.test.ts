// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businessHours, businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const { importPlaceByIdMock, importPlaceMock, getBusinessPageMock } =
  vi.hoisted(() => ({
    importPlaceByIdMock: vi.fn(),
    importPlaceMock: vi.fn(),
    getBusinessPageMock: vi.fn(),
  }))

vi.mock("@/features/place-import/api/import-place", () => ({
  importPlaceById: importPlaceByIdMock,
  importPlace: importPlaceMock,
}))
vi.mock("@/features/business-page/api/get-business-page", () => ({
  getBusinessPage: getBusinessPageMock,
}))

const { prepareBusiness, prepareBusinessFromLink } =
  await import("./prepare-actions")

let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-prepare-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })

  await db.insert(user).values([
    { id: "u1", name: "Me", email: "me@example.com", emailVerified: false },
    {
      id: "other",
      name: "Other",
      email: "other@example.com",
      emailVerified: false,
    },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-claimed",
      slug: "claimed-shop",
      name: "Claimed Shop",
      address: "1 Main St",
      category: "Barber shop",
      phone: "+18095550100",
      website: "https://claimed.example",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "other",
    },
    {
      id: "biz-mine",
      slug: "my-shop",
      name: "My Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
    },
    {
      id: "biz-free",
      slug: "free-shop",
      name: "Free Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: null,
    },
  ])
  await db.insert(businessHours).values([
    {
      businessId: "biz-claimed",
      weekday: 1,
      opensAt: "09:00",
      closesAt: "18:00",
    },
    {
      businessId: "biz-claimed",
      weekday: 3,
      opensAt: "09:00",
      closesAt: "18:00",
    },
  ])
})

afterAll(() => {
  vi.unstubAllEnvs()
  rmSync(dir, { recursive: true, force: true })
})

function pageWithPhoto() {
  return { photos: [{ id: "p1", url: "https://photo/1", credit: null }] }
}

test("prepareBusiness rejects invalid place IDs", async () => {
  for (const placeId of ["", "short", "has space!", "x".repeat(301)]) {
    await expect(prepareBusiness({ placeId })).resolves.toEqual({
      ok: false,
      error: "invalid",
    })
  }
  expect(importPlaceByIdMock).not.toHaveBeenCalled()
})

test("prepareBusiness maps a missing business to not_found", async () => {
  importPlaceByIdMock.mockRejectedValueOnce(new Error("No business found"))
  await expect(
    prepareBusiness({ placeId: "ChIJmissingplace" })
  ).resolves.toEqual({ ok: false, error: "not_found" })
})

test("prepareBusiness maps other errors to failed and logs once", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  importPlaceByIdMock.mockRejectedValueOnce(new Error("quota exploded"))
  await expect(prepareBusiness({ placeId: "ChIJboomplace1" })).resolves.toEqual(
    { ok: false, error: "failed" }
  )
  expect(error).toHaveBeenCalledTimes(1)
  expect(error).toHaveBeenCalledWith("quota exploded")
  error.mockRestore()
})

test("prepareBusiness returns the prepared shop", async () => {
  importPlaceByIdMock.mockResolvedValueOnce("claimed-shop")
  getBusinessPageMock.mockResolvedValueOnce(pageWithPhoto())

  await expect(
    prepareBusiness({
      placeId: "ChIJclaimedplace",
      sessionToken: "123e4567-e89b-42d3-a456-426614174000",
    })
  ).resolves.toEqual({
    ok: true,
    slug: "claimed-shop",
    name: "Claimed Shop",
    address: "1 Main St",
    photoUrl: "https://photo/1",
    category: "Barber shop",
    phone: "+18095550100",
    website: "https://claimed.example",
    openDays: 2,
  })
  expect(importPlaceByIdMock).toHaveBeenCalledWith(
    "ChIJclaimedplace",
    "123e4567-e89b-42d3-a456-426614174000"
  )
})

test("prepareBusinessFromLink validates, imports and maps errors", async () => {
  await expect(prepareBusinessFromLink({ link: "   " })).resolves.toEqual({
    ok: false,
    error: "invalid",
  })
  await expect(
    prepareBusinessFromLink({ link: "x".repeat(2001) })
  ).resolves.toEqual({ ok: false, error: "invalid" })
  expect(importPlaceMock).not.toHaveBeenCalled()

  importPlaceMock.mockRejectedValueOnce(new Error("No business found"))
  await expect(
    prepareBusinessFromLink({ link: "https://maps.app.goo.gl/missing" })
  ).resolves.toEqual({ ok: false, error: "not_found" })

  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  importPlaceMock.mockRejectedValueOnce(new Error("network down"))
  await expect(
    prepareBusinessFromLink({ link: "https://maps.app.goo.gl/boom" })
  ).resolves.toEqual({ ok: false, error: "failed" })
  expect(error).toHaveBeenCalledWith("network down")
  error.mockRestore()

  importPlaceMock.mockResolvedValueOnce("free-shop")
  getBusinessPageMock.mockResolvedValueOnce({ photos: [] })
  await expect(
    prepareBusinessFromLink({ link: "  https://maps.app.goo.gl/free  " })
  ).resolves.toMatchObject({
    ok: true,
    slug: "free-shop",
    category: null,
    phone: null,
    website: null,
    openDays: 0,
  })
  expect(importPlaceMock).toHaveBeenCalledWith("https://maps.app.goo.gl/free")
})
