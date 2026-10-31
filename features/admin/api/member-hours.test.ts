// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businesses, teamMembers, teamMemberHours } from "@/lib/db/schema"
vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))
const { getBusinesses } = await import("./queries")
let dir: string
let db: (typeof import("@/lib/db"))["db"]
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-member-hours-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db
    .insert(businesses)
    .values({
      id: "biz",
      slug: "shop",
      name: "Shop",
      timezone: "UTC",
      currency: "USD",
    })
  await db.insert(teamMembers).values([
    { id: "m1", businessId: "biz", name: "Custom" },
    { id: "m2", businessId: "biz", name: "Inherited" },
  ])
  await db.insert(teamMemberHours).values([
    {
      businessId: "biz",
      teamMemberId: "m1",
      weekday: 1,
      opensAt: "09:00",
      closesAt: "12:00",
    },
    {
      businessId: "biz",
      teamMemberId: "m1",
      weekday: 1,
      opensAt: "14:00",
      closesAt: "18:00",
    },
  ])
})
afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})
test("admin receives every stored hours row and members with inherited hours", async () => {
  const [business] = await getBusinesses()
  expect(business.team).toHaveLength(2)
  expect(business.team?.find((m) => m.id === "m1")?.hours).toHaveLength(2)
  expect(business.team?.find((m) => m.id === "m2")?.hours).toEqual([])
})
