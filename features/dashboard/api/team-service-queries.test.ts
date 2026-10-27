// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businesses,
  businessPhotos,
  services,
  teamMembers,
  teamMemberServices,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND")
  },
}))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: "u1",
    name: "Owner",
    email: "owner@example.com",
  })),
}))

const { db } = await import("@/lib/db")
const { getBusinessPhotos, getServiceTeams } = await import("./team-service-queries")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-teams-test-"))
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
      id: "biz-theirs",
      slug: "their-shop",
      name: "Their Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "other",
    },
  ])
  await db.insert(businessPhotos).values([
    { id: "p1", businessId: "biz-mine", url: "/uploads/a.jpg", position: 1 },
    { id: "p2", businessId: "biz-mine", url: "/uploads/b.jpg", position: 0 },
  ])
  await db.insert(services).values([
    { id: "s1", businessId: "biz-mine", name: "Cut", durationMinutes: 30, position: 0 },
    { id: "s2", businessId: "biz-mine", name: "Shave", durationMinutes: 30, position: 1 },
  ])
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz-mine", name: "Ana", position: 1 },
    { id: "m2", businessId: "biz-mine", name: "Ben", position: 0 },
  ])
  await db.insert(teamMemberServices).values([
    { businessId: "biz-mine", teamMemberId: "m1", serviceId: "s1" },
    { businessId: "biz-mine", teamMemberId: "m2", serviceId: "s1" },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("getBusinessPhotos returns this business photos by position", async () => {
  expect(await getBusinessPhotos("biz-mine")).toEqual([
    { id: "p2", url: "/uploads/b.jpg" },
    { id: "p1", url: "/uploads/a.jpg" },
  ])
})

test("getServiceTeams maps services in team order, skipping everyone", async () => {
  // s1 lists both members in team position order (m2 first); s2 has no rows
  // (everyone) and is left out.
  expect(await getServiceTeams("biz-mine")).toEqual({ s1: ["m2", "m1"] })
})

test("strangers hit notFound for both queries", async () => {
  await expect(getBusinessPhotos("biz-theirs")).rejects.toThrow("NOT_FOUND")
  await expect(getServiceTeams("biz-theirs")).rejects.toThrow("NOT_FOUND")
})
