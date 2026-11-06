// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import { businesses, planFeatures, subscription, user } from "@/lib/db/schema"
import { PLAN_FEATURES, PLANS, planIncludes } from "@/lib/plan-features"

vi.mock("server-only", () => ({}))

const { PlanFeatureError, businessPlan, canBillBusiness, featurePlans, lockedPlans, setFeaturePlan } =
  await import("./plan-access")

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

test("a change is saved, and the default removes the row", async () => {
  await setFeaturePlan({ key: "analytics", plan: "pro", userId: "admin" })
  expect((await featurePlans()).analytics).toBe("pro")

  expect((await db.select().from(planFeatures))[0]?.updatedBy).toBe("admin")

  await setFeaturePlan({ key: "analytics", plan: "free", userId: "admin" })
  expect((await featurePlans()).analytics).toBe("free")
  expect(await db.select().from(planFeatures)).toHaveLength(0)
})

test("unknown features and plans are refused, and stale rows ignored", async () => {
  await expect(
    setFeaturePlan({ key: "nope" as never, plan: "pro", userId: "admin" })
  ).rejects.toBeInstanceOf(PlanFeatureError)
  await expect(
    setFeaturePlan({ key: "analytics", plan: "gold" as never, userId: "admin" })
  ).rejects.toBeInstanceOf(PlanFeatureError)

  // Bookings has no plan check yet, so it can't leave its default plan.
  await expect(
    setFeaturePlan({ key: "bookings", plan: "pro", userId: "admin" })
  ).rejects.toBeInstanceOf(PlanFeatureError)

  await db.insert(planFeatures).values({ featureKey: "removedFeature", plan: "pro" })
  expect(await featurePlans()).not.toHaveProperty("removedFeature")
})

test("a business that never paid is on Free: a feature moved to Pro locks", async () => {
  expect(await lockedPlans("never-paid")).toEqual({
    // The "soon" ones start on Pro.
    ...Object.fromEntries(
      Object.entries(PLAN_FEATURES)
        .filter(([, feature]) => feature.defaultPlan === "pro")
        .map(([key]) => [key, "pro"])
    ),
  })
  await setFeaturePlan({ key: "analytics", plan: "pro", userId: "admin" })
  expect(await lockedPlans("never-paid")).toMatchObject({ analytics: "pro" })
  await setFeaturePlan({ key: "analytics", plan: null, userId: "admin" })
})

test("a business is on Pro only while its subscription is paid", async () => {
  const business = (id: string) => ({
    id,
    slug: id,
    name: id,
    timezone: "America/New_York",
    currency: "USD",
    ownerId: "admin",
  })
  await db.insert(businesses).values([business("paid"), business("retrying")])
  expect(await businessPlan("paid")).toBe("free")

  await db.insert(subscription).values([
    { id: "s1", plan: "pro", referenceId: "paid", status: "active" },
    // Stripe is still retrying the card: Free until it's paid.
    { id: "s2", plan: "pro", referenceId: "retrying", status: "past_due" },
    // A plan name the app no longer knows counts for nothing.
    { id: "s3", plan: "gold", referenceId: "retrying", status: "active" },
  ])
  expect(await businessPlan("paid")).toBe("pro")
  expect(await businessPlan("retrying")).toBe("free")

  await db.update(subscription).set({ status: "canceled" })
  expect(await businessPlan("paid")).toBe("free")
})

test("only a real business's owner may bill it", async () => {
  await db.insert(user).values({ id: "other", name: "Other", email: "other@example.com", emailVerified: false })
  await db.insert(businesses).values([
    { id: "mine", slug: "mine", name: "Mine", timezone: "UTC", currency: "USD", ownerId: "admin" },
    { id: "demo", slug: "demo", name: "Demo", timezone: "UTC", currency: "USD", ownerId: "admin", isDemo: true },
  ])
  expect(await canBillBusiness("admin", "mine")).toBe(true)
  expect(await canBillBusiness("other", "mine")).toBe(false)
  expect(await canBillBusiness("admin", "demo")).toBe(false)
  expect(await canBillBusiness("admin", "admin")).toBe(false)
})
