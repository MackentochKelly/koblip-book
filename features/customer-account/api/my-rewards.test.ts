// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, beforeAll, expect, test, vi } from "vitest"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  rewardEvents,
  rewardRules,
  rewards,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
const off = vi.hoisted(() => new Set<string>())
vi.mock("@/lib/plan-access", () => ({
  hasFeature: async (businessId: string) => !off.has(businessId),
}))

const { myRewards } = await import("./my-rewards")

let dir: string
const NOW = new Date("2026-11-20T12:00:00.000Z")
const ANA = { userId: "ana", name: "Ana", phone: "+18095550000" }
const KEY = "p:18095550000"
const free = {
  type: "free" as const,
  value: null,
  maxDiscountMinor: null,
  services: null,
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-my-rewards-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "O", email: "o@example.com", emailVerified: true },
    { id: "ana", name: "Ana", email: "ana@example.com", emailVerified: true },
  ])
  const shop = (id: string, more = {}) => ({
    id,
    slug: id,
    name: id.toUpperCase(),
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
    ...more,
  })
  await db
    .insert(businesses)
    .values([
      shop("a"),
      shop("b"),
      shop("norules"),
      shop("noplan"),
      shop("demo", { isDemo: true }),
    ])
  const rule = (businessId: string) => ({
    id: `rule-${businessId}`,
    businessId,
    earnType: "visit" as const,
    goal: 5,
    rewardType: "free" as const,
    startsAt: "2026-11-01T00:00:00.000Z",
  })
  await db
    .insert(rewardRules)
    .values([rule("a"), rule("b"), rule("noplan"), rule("demo")])
  const booking = (businessId: string, more = {}) => ({
    id: `bk-${businessId}`,
    businessId,
    serviceName: "Cut",
    durationMinutes: 30,
    currency: "USD",
    startAt: "2026-11-10T10:00:00.000Z",
    endAt: "2026-11-10T10:30:00.000Z",
    customerName: "Ana",
    customerPhone: ANA.phone,
    customerKey: KEY,
    ...more,
  })
  await db
    .insert(bookings)
    .values([
      booking("a"),
      booking("norules"),
      booking("noplan"),
      booking("demo"),
    ])
  const event = (businessId: string, amount: number, customerKey = KEY) => ({
    businessId,
    ruleId: `rule-${businessId}`,
    customerKey,
    type: "earn" as const,
    amount,
  })
  // Three visits at A; at B only what the owner gave by hand, and a reward.
  await db
    .insert(rewardEvents)
    .values([event("a", 3), event("a", 4, "p:1999"), event("b", 1)])
  const earned = (id: string, more = {}) => ({
    id,
    businessId: "b",
    ruleId: "rule-b",
    customerKey: KEY,
    reward: free,
    earnedAt: "2026-11-05T00:00:00.000Z",
    ...more,
  })
  await db
    .insert(rewards)
    .values([
      earned("ready", { expiresAt: "2026-12-03T12:00:00.000Z" }),
      earned("late", { expiresAt: "2026-11-19T00:00:00.000Z" }),
      earned("used", { status: "used" }),
      earned("theirs", { customerKey: "p:1999" }),
    ])
  off.add("noplan")
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("each business with rewards, the one with something to redeem first", async () => {
  const places = await myRewards(ANA, "en-US", NOW)
  expect(places.map((place) => place.business.slug)).toEqual(["b", "a"])
  expect(places[0].rewards).toEqual([
    { id: "ready", reward: free, expires: "Dec 3" },
  ])
  expect(places[0].progress.map((item) => item.done)).toEqual([1])
  expect(places[1].rewards).toEqual([])
  expect(places[1].progress.map((item) => item.done)).toEqual([3])
})

test("a rule that ended shows no progress", async () => {
  await db.update(rewardRules).set({ status: "off" })
  const places = await myRewards(ANA, "en-US", NOW)
  expect(places.map((place) => place.business.slug)).toEqual(["b"])
  expect(places[0].progress).toEqual([])
})

test("an account with no proved phone sees no rewards", async () => {
  expect(await myRewards({ ...ANA, phone: null }, "en-US", NOW)).toEqual([])
})
