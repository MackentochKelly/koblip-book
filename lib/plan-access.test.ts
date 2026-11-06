// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { desc } from "drizzle-orm"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { planFeatureChanges, planFeatures, user } from "@/lib/db/schema"
import { PLAN_FEATURES, PLANS, planIncludes } from "@/lib/plan-features"

vi.mock("server-only", () => ({}))

const { PlanFeatureError, featurePlans, setFeaturePlan } = await import("./plan-access")

let dir: string
let closeDb: () => void

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-plan-access-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  closeDb = () => db.$client.close()
  await db.insert(user).values({ id: "admin", name: "Admin", email: "admin@example.com", emailVerified: false })
})

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})

test("a higher plan has everything a lower one has", () => {
  expect(planIncludes("pro", "free")).toBe(true)
  expect(planIncludes("free", "pro")).toBe(false)
  expect(planIncludes("free", "free")).toBe(true)
})

test("built features start on Free and coming-soon ones on Pro", () => {
  for (const feature of Object.values(PLAN_FEATURES)) {
    expect(feature.defaultPlan).toBe(feature.status === "live" ? "free" : "pro")
    expect(PLANS).toContain(feature.defaultPlan)
  }
})

test("the defaults apply until the admin changes one", async () => {
  const plans = await featurePlans()
  expect(plans.analytics).toBe("free")
  expect(plans.smsReminders).toBe("pro")
})

test("a change is saved and logged, and the default removes the row", async () => {
  await setFeaturePlan({ key: "analytics", plan: "pro", userId: "admin" })
  expect((await featurePlans()).analytics).toBe("pro")

  // The same value again logs nothing.
  await setFeaturePlan({ key: "analytics", plan: "pro", userId: "admin" })

  await setFeaturePlan({ key: "analytics", plan: "free", userId: "admin" })
  expect((await featurePlans()).analytics).toBe("free")
  expect(await db.select().from(planFeatures)).toHaveLength(0)

  const changes = await db.select().from(planFeatureChanges).orderBy(desc(planFeatureChanges.id))
  expect(changes.map(({ before, after }) => [before, after])).toEqual([
    ["pro", null],
    [null, "pro"],
  ])
  expect(changes[0]?.changedBy).toBe("admin")
})

test("unknown features and plans are refused, and stale rows ignored", async () => {
  await expect(
    setFeaturePlan({ key: "nope" as never, plan: "pro", userId: "admin" })
  ).rejects.toBeInstanceOf(PlanFeatureError)
  await expect(
    setFeaturePlan({ key: "analytics", plan: "gold" as never, userId: "admin" })
  ).rejects.toBeInstanceOf(PlanFeatureError)

  await db.insert(planFeatures).values({ featureKey: "removedFeature", plan: "pro" })
  expect(await featurePlans()).not.toHaveProperty("removedFeature")
})
