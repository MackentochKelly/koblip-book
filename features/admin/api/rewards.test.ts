// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import {
  businesses,
  rewardEvents,
  rewardRules,
  rewards,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("@/lib/dal", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin" })),
}))

const { getAdminRewards } = await import("./rewards")
const { requireAdmin } = await import("@/lib/dal")

let dir: string
let db: (typeof import("@/lib/db"))["db"]

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "admin-rewards-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  db = (await import("@/lib/db")).db
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  const shop = { timezone: "UTC", currency: "USD", ownerId: "u1" }
  await db.insert(businesses).values([
    { ...shop, id: "real", slug: "real", name: "Real" },
    { ...shop, id: "demo", slug: "demo", name: "Demo", isDemo: true },
  ])
  const rule = (id: string, businessId: string, more = {}) => ({
    id,
    businessId,
    earnType: "visit" as const,
    goal: 5,
    rewardType: "free" as const,
    startsAt: "2026-01-01T00:00:00.000Z",
    ...more,
  })
  await db
    .insert(rewardRules)
    .values([
      rule("r1", "real"),
      rule("r2", "real", { status: "ended", position: 1 }),
      rule("d1", "demo"),
    ])
  const event = (businessId: string, ruleId: string) => ({
    businessId,
    ruleId,
    customerKey: "p:18095550000",
    type: "adjust" as const,
    amount: 5,
    actor: "owner" as const,
    note: "Regular",
  })
  await db
    .insert(rewardEvents)
    .values([event("real", "r1"), event("demo", "d1")])
  const earned = (businessId: string, ruleId: string) => ({
    businessId,
    ruleId,
    customerKey: "n:ana ruiz",
    reward: {
      type: "free" as const,
      value: null,
      maxDiscountMinor: null,
      services: null,
    },
    earnedAt: "2026-03-01T00:00:00.000Z",
  })
  await db.insert(rewards).values([earned("real", "r1"), earned("demo", "d1")])
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("the admin sees every real business's rules, rewards and history, never a demo's", async () => {
  const all = await getAdminRewards()
  expect(requireAdmin).toHaveBeenCalled()
  expect(all.businesses.map((business) => business.name)).toEqual(["Real"])
  // Removed rules too.
  expect(all.businesses[0].rules.map((rule) => rule.id)).toEqual(["r1", "r2"])
  expect(all.earned).toMatchObject([
    { businessName: "Real", customer: "ana ruiz", status: "available" },
  ])
  expect(all.history).toMatchObject([
    {
      businessName: "Real",
      customer: "+18095550000",
      type: "adjust",
      amount: 5,
      actor: "owner",
      note: "Regular",
      spend: false,
    },
  ])
})
