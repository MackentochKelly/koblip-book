// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, user } from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

const {
  importPlaceByIdMock,
  importPlaceMock,
  getBusinessPageMock,
  getSessionMock,
} = vi.hoisted(() => ({
  importPlaceByIdMock: vi.fn(),
  importPlaceMock: vi.fn(),
  getBusinessPageMock: vi.fn(),
  getSessionMock: vi.fn(),
}))

vi.mock("@/features/place-import/api/import-place", () => ({
  importPlaceById: importPlaceByIdMock,
  importPlace: importPlaceMock,
}))
vi.mock("@/features/business-page/api/get-business-page", () => ({
  getBusinessPage: getBusinessPageMock,
}))
vi.mock("@/lib/dal", () => ({ getSession: getSessionMock }))

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

test("prepareBusiness reports a shop owned by someone else", async () => {
  importPlaceByIdMock.mockResolvedValueOnce("claimed-shop")
  getBusinessPageMock.mockResolvedValueOnce(pageWithPhoto())
  getSessionMock.mockResolvedValueOnce({
    userId: "u1",
    name: "Me",
    email: "me@example.com",
  })

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
    owned: true,
  })
  expect(importPlaceByIdMock).toHaveBeenCalledWith(
    "ChIJclaimedplace",
    "123e4567-e89b-42d3-a456-426614174000"
  )
})

test("prepareBusiness reports my own shop as unowned", async () => {
  importPlaceByIdMock.mockResolvedValueOnce("my-shop")
  getBusinessPageMock.mockResolvedValueOnce({ photos: [] })
  getSessionMock.mockResolvedValueOnce({
    userId: "u1",
    name: "Me",
    email: "me@example.com",
  })

  await expect(prepareBusiness({ placeId: "ChIJmyownplace" })).resolves.toEqual(
    {
      ok: true,
      slug: "my-shop",
      name: "My Shop",
      address: null,
      photoUrl: null,
      owned: false,
    }
  )
})

test("prepareBusiness without a session treats any owner as owned", async () => {
  importPlaceByIdMock.mockResolvedValueOnce("claimed-shop")
  getBusinessPageMock.mockResolvedValueOnce({ photos: [] })
  getSessionMock.mockResolvedValueOnce(null)

  await expect(
    prepareBusiness({ placeId: "ChIJclaimedplace" })
  ).resolves.toMatchObject({ ok: true, owned: true })

  importPlaceByIdMock.mockResolvedValueOnce("free-shop")
  getBusinessPageMock.mockResolvedValueOnce({ photos: [] })
  getSessionMock.mockResolvedValueOnce(null)

  await expect(
    prepareBusiness({ placeId: "ChIJfreeplace12" })
  ).resolves.toMatchObject({ ok: true, owned: false })
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
  getSessionMock.mockResolvedValueOnce(null)
  await expect(
    prepareBusinessFromLink({ link: "  https://maps.app.goo.gl/free  " })
  ).resolves.toMatchObject({ ok: true, slug: "free-shop", owned: false })
  expect(importPlaceMock).toHaveBeenCalledWith("https://maps.app.goo.gl/free")
})
