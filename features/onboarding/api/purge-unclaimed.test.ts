// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { businessHours, businesses, teamMembers, teamMemberHours, user } from "@/lib/db/schema"
import { ONBOARDING_RULES } from "@/lib/onboarding-rules"

vi.mock("server-only", () => ({}))

const { purgeUnclaimedImports } = await import("./purge-unclaimed")

let closeDb: () => void
let dir: string

const HOUR = 3_600_000
const old = new Date(
  Date.now() - (ONBOARDING_RULES.unclaimedImportHours + 1) * HOUR
).toISOString()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-purge-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  const { db } = await import("@/lib/db")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()

  await db.insert(user).values([
    { id: "u1", name: "Owner", email: "owner@example.com", emailVerified: false },
  ])
  await db.insert(businesses).values([
    {
      id: "biz-stale",
      slug: "stale-shop",
      name: "Stale Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: null,
      detailsConfirmedAt: null,
      createdAt: old,
    },
    {
      id: "biz-owned",
      slug: "owned-shop",
      name: "Owned Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: "u1",
      detailsConfirmedAt: null,
      createdAt: old,
    },
    {
      id: "biz-confirmed",
      slug: "confirmed-shop",
      name: "Confirmed Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: null,
      detailsConfirmedAt: Date.now(),
      createdAt: old,
    },
    {
      id: "biz-fresh",
      slug: "fresh-shop",
      name: "Fresh Shop",
      timezone: "America/Santo_Domingo",
      currency: "DOP",
      ownerId: null,
      detailsConfirmedAt: null,
    },
  ])
  await db.insert(businessHours).values([
    {
      id: "h-stale",
      businessId: "biz-stale",
      weekday: 1,
      opensAt: "09:00",
      closesAt: "18:00",
    },
    {
      id: "h-owned",
      businessId: "biz-owned",
      weekday: 1,
      opensAt: "09:00",
      closesAt: "18:00",
    },
  ])
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("deletes only old unowned unconfirmed imports, with their hours", async () => {
  await purgeUnclaimedImports()

  const { db } = await import("@/lib/db")
  const rows = await db.select({ id: businesses.id }).from(businesses)
  expect(new Set(rows.map((row) => row.id))).toEqual(
    new Set(["biz-owned", "biz-confirmed", "biz-fresh"])
  )
  const hours = await db
    .select({ id: businessHours.id })
    .from(businessHours)
  expect(hours.map((row) => row.id)).toEqual(["h-owned"])
})

test("purge removes custom member hours for stale imports", async () => {
  const { db } = await import("@/lib/db")
  await db.insert(businesses).values({ id: "stale-hours", slug: "stale-hours", name: "Stale", timezone: "UTC", currency: "USD", createdAt: old })
  await db.insert(teamMembers).values({ id: "stale-member", businessId: "stale-hours", name: "Member" })
  await db.insert(teamMemberHours).values({ businessId: "stale-hours", teamMemberId: "stale-member", weekday: 1, opensAt: "09:00", closesAt: "17:00" })
  await purgeUnclaimedImports()
  expect(await db.select().from(teamMemberHours)).toEqual([])
})

test("never throws when the database is gone", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {})
  process.env.DATABASE_URL = "file:/no-such-dir/missing.db?mode=ro"
  vi.resetModules()
  const { purgeUnclaimedImports: purgeBroken } = await import(
    "./purge-unclaimed"
  )
  await expect(purgeBroken()).resolves.toBeUndefined()
  expect(error).toHaveBeenCalled()
  error.mockRestore()
})
