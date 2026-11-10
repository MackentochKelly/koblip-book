// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  businesses,
  rewardEvents,
  rewardRuleServices,
  rewardRules,
  services,
  user,
} from "@/lib/db/schema"
import type { RewardRuleInput } from "@/lib/reward-rules"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const session = vi.hoisted(() => ({ userId: "u1" }))
vi.mock("@/lib/dal", () => ({
  requireOwner: vi.fn(async () => ({
    userId: session.userId,
    name: "Owner",
    email: "owner@example.com",
  })),
}))
const plan = vi.hoisted(() => ({ rewards: true }))
vi.mock("@/lib/plan-access", () => ({
  hasFeature: async () => plan.rewards,
}))

const { removeRewardRule, saveRewardRule, setRewardRuleOn } =
  await import("./reward-actions")
const { rewardRulesFor } = await import("@/lib/rewards")

let dir: string

const input: RewardRuleInput = {
  earnType: "visit",
  earnServiceIds: null,
  earnMinPriceMinor: null,
  goal: 5,
  rewardType: "free",
  rewardValue: null,
  rewardCount: 1,
  rewardServiceIds: ["cut"],
  maxDiscountMinor: null,
  expiresDays: 90,
  endsAt: null,
  maxPerCustomer: null,
  paidOnly: false,
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-reward-actions-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    {
      id: "u1",
      name: "Owner",
      email: "owner@example.com",
      emailVerified: false,
    },
    {
      id: "u2",
      name: "Other",
      email: "other@example.com",
      emailVerified: false,
    },
  ])
  await db.insert(businesses).values([
    {
      id: "biz",
      slug: "shop",
      name: "Shop",
      timezone: "America/Santo_Domingo",
      currency: "USD",
      ownerId: "u1",
    },
    {
      id: "biz2",
      slug: "other",
      name: "Other",
      timezone: "America/Santo_Domingo",
      currency: "USD",
      ownerId: "u2",
    },
  ])
  await db.insert(services).values([
    {
      id: "cut",
      businessId: "biz",
      name: "Haircut",
      durationMinutes: 60,
      priceMinor: 2500,
    },
    {
      id: "theirs",
      businessId: "biz2",
      name: "Nails",
      durationMinutes: 60,
      priceMinor: 2500,
    },
  ])
})

afterEach(async () => {
  session.userId = "u1"
  plan.rewards = true
  await db.delete(rewardEvents)
  await db.delete(rewardRules)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a new rule is saved with its services and counts from now", async () => {
  const before = new Date().toISOString()
  const result = await saveRewardRule("biz", null, input)
  expect(result.ok).toBe(true)
  const [rule] = await rewardRulesFor("biz")
  expect(rule).toMatchObject({
    status: "active",
    goal: 5,
    rewardType: "free",
    expiresDays: 90,
    earnServices: null,
    rewardServices: [{ id: "cut", name: "Haircut" }],
  })
  expect(rule.startsAt! >= before).toBe(true)
})

test("saving a rule again changes it and replaces its services", async () => {
  const made = await saveRewardRule("biz", null, input)
  const id = made.ok ? made.id : ""
  const [{ startsAt }] = await rewardRulesFor("biz")
  expect(
    await saveRewardRule("biz", id, {
      ...input,
      goal: 8,
      rewardType: "percent",
      rewardValue: 20,
      rewardServiceIds: null,
      earnServiceIds: ["cut"],
    })
  ).toEqual({ ok: true, id })
  const [rule] = await rewardRulesFor("biz")
  expect(rule).toMatchObject({
    goal: 8,
    rewardType: "percent",
    rewardValue: 20,
    rewardServices: null,
    earnServices: [{ id: "cut", name: "Haircut" }],
    startsAt,
  })
  expect(await db.select().from(rewardRuleServices)).toHaveLength(1)
})

test("a wrong field, or another business's service, is refused by name", async () => {
  expect(await saveRewardRule("biz", null, { ...input, goal: 0 })).toEqual({
    ok: false,
    error: "goal",
  })
  expect(
    await saveRewardRule("biz", null, {
      ...input,
      rewardServiceIds: ["theirs"],
    })
  ).toEqual({ ok: false, error: "rewardServices" })
  expect(await rewardRulesFor("biz")).toEqual([])
})

test("another owner, or a plan without rewards, changes nothing", async () => {
  const made = await saveRewardRule("biz", null, input)
  const id = made.ok ? made.id : ""
  session.userId = "u2"
  expect(await saveRewardRule("biz", null, input)).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await setRewardRuleOn("biz", id, false)).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await removeRewardRule("biz", id)).toEqual({
    ok: false,
    error: "not_found",
  })
  // Their own business cannot reach the rule either.
  expect(await setRewardRuleOn("biz2", id, false)).toEqual({
    ok: false,
    error: "not_found",
  })
  expect(await removeRewardRule("biz2", id)).toEqual({
    ok: false,
    error: "not_found",
  })
  session.userId = "u1"
  plan.rewards = false
  expect(await saveRewardRule("biz", null, input)).toEqual({
    ok: false,
    error: "not_found",
  })
  expect((await rewardRulesFor("biz"))[0].status).toBe("active")
})

test("a business can run only so many rules", async () => {
  for (let index = 0; index < 10; index += 1) {
    expect((await saveRewardRule("biz", null, input)).ok).toBe(true)
  }
  expect(await saveRewardRule("biz", null, input)).toEqual({
    ok: false,
    error: "full",
  })
})

test("a rule turns off and on", async () => {
  const made = await saveRewardRule("biz", null, input)
  const id = made.ok ? made.id : ""
  expect(await setRewardRuleOn("biz", id, false)).toEqual({ ok: true })
  expect((await rewardRulesFor("biz"))[0].status).toBe("off")
  expect(await setRewardRuleOn("biz", id, true)).toEqual({ ok: true })
  expect((await rewardRulesFor("biz"))[0].status).toBe("active")
})

test("a rule nobody earned on is deleted; one with history is ended and kept", async () => {
  const first = await saveRewardRule("biz", null, input)
  const second = await saveRewardRule("biz", null, input)
  const [unused, used] = [first, second].map((made) => (made.ok ? made.id : ""))
  await db.insert(rewardEvents).values({
    businessId: "biz",
    ruleId: used,
    customerKey: "p:1",
    type: "earn",
    amount: 1,
  })
  expect(await removeRewardRule("biz", unused)).toEqual({ ok: true })
  expect(await removeRewardRule("biz", used)).toEqual({ ok: true })
  expect(await rewardRulesFor("biz")).toEqual([])
  const kept = await rewardRulesFor("biz", { withEnded: true })
  expect(kept.map((rule) => [rule.id, rule.status])).toEqual([[used, "ended"]])
  // An ended rule cannot be turned on again.
  expect(await setRewardRuleOn("biz", used, true)).toEqual({
    ok: false,
    error: "not_found",
  })
})
