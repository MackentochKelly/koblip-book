// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businessHours,
  businessPhotos,
  businesses,
  services,
  teamMembers,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))

let getBusinessPage: typeof import("./get-business-page").getBusinessPage
let closeDb: () => void
let dir: string

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`

  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(businesses).values({
    id: "biz-1",
    slug: "demo-salon",
    name: "Demo Salon",
    description: "A salon for tests",
    phone: "+18095550134",
    address: "Calle Test 123, Santo Domingo",
    timezone: "America/Santo_Domingo",
    currency: "DOP",
  })
  await db.insert(services).values([
    {
      id: "svc-1",
      businessId: "biz-1",
      name: "Third",
      durationMinutes: 30,
      priceMinor: 1000,
      position: 2,
    },
    {
      id: "svc-2",
      businessId: "biz-1",
      name: "First",
      durationMinutes: 45,
      priceMinor: null,
      position: 0,
    },
    {
      id: "svc-3",
      businessId: "biz-1",
      name: "Second",
      durationMinutes: 60,
      priceMinor: 2500,
      position: 1,
    },
  ])
  await db.insert(teamMembers).values([
    { id: "tm-1", businessId: "biz-1", name: "Second Member", position: 1 },
    {
      id: "tm-2",
      businessId: "biz-1",
      name: "First Member",
      photoUrl: "https://example.com/a.png",
      position: 0,
    },
  ])
  await db.insert(businessPhotos).values([
    {
      id: "ph-1",
      businessId: "biz-1",
      url: "https://example.com/2.png",
      position: 1,
    },
    {
      id: "ph-2",
      businessId: "biz-1",
      url: "https://example.com/1.png",
      position: 0,
    },
  ])
  await db.insert(businessHours).values([
    {
      id: "h-1",
      businessId: "biz-1",
      weekday: 1,
      opensAt: "14:00",
      closesAt: "18:00",
    },
    {
      id: "h-2",
      businessId: "biz-1",
      weekday: 1,
      opensAt: "09:00",
      closesAt: "12:00",
    },
    {
      id: "h-3",
      businessId: "biz-1",
      weekday: 0,
      opensAt: "10:00",
      closesAt: "14:00",
    },
  ])

  ;({ getBusinessPage } = await import("./get-business-page"))
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("returns null for an unknown slug", async () => {
  await expect(getBusinessPage("no-such-business")).resolves.toBeNull()
})

test("live Google fields are null without a place ID", async () => {
  const data = await getBusinessPage("demo-salon")
  expect(data?.business.rating).toBeNull()
  expect(data?.business.reviewCount).toBeNull()
  expect(data?.business.mapsUrl).toBeNull()
  expect(data?.business.latitude).toBeNull()
  expect(data?.business.longitude).toBeNull()
})

test("returns the business with children in order", async () => {
  const data = await getBusinessPage("demo-salon")
  expect(data?.business.name).toBe("Demo Salon")
  expect(data?.services.map((service) => service.name)).toEqual([
    "First",
    "Second",
    "Third",
  ])
  expect(data?.services[0].priceMinor).toBeNull()
  expect(data?.team.map((member) => member.name)).toEqual([
    "First Member",
    "Second Member",
  ])
  expect(data?.photos.map((photo) => photo.url)).toEqual([
    "https://example.com/1.png",
    "https://example.com/2.png",
  ])
  expect(
    data?.hours.map((hour) => [hour.weekday, hour.opensAt, hour.closesAt])
  ).toEqual([
    [0, "10:00", "14:00"],
    [1, "09:00", "12:00"],
    [1, "14:00", "18:00"],
  ])
})
