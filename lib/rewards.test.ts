// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  bookingAddons,
  bookings,
  businesses,
  rewardEvents,
  rewardRuleServices,
  rewardRules,
  rewards,
  services,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
const plan = vi.hoisted(() => ({ rewards: true }))
vi.mock("@/lib/plan-access", () => ({
  hasFeature: async () => plan.rewards,
}))

const {
  adjustProgress,
  availableRewards,
  customerRewards,
  giveReward,
  holdRewardWrite,
  recountBooking,
  redeemOnBooking,
  rewardHistory,
  rewardRulesFor,
  rewardsForBooking,
  sweepRewards,
} = await import("./rewards")

let dir: string
const ANA = "p:18095550000"
const DAY = 86_400_000
// The rule starts ten days ago; "now" is today.
const NOW = new Date("2026-11-20T12:00:00.000Z")
const RULE_START = new Date(NOW.getTime() - 10 * DAY).toISOString()
let count = 0

async function rule(values: Partial<typeof rewardRules.$inferInsert> = {}) {
  const id = values.id ?? "rule"
  await db.insert(rewardRules).values({
    id,
    businessId: "biz",
    earnType: "visit",
    goal: 3,
    rewardType: "free",
    startsAt: RULE_START,
    ...values,
  })
  return id
}

// A booking that ended `daysAgo` days ago (negative: still ahead).
async function visit(
  daysAgo: number,
  values: Partial<typeof bookings.$inferInsert> = {}
) {
  count += 1
  const id = values.id ?? `bk${count}`
  const start = NOW.getTime() - daysAgo * DAY - 3_600_000
  await db.insert(bookings).values({
    id,
    businessId: "biz",
    serviceId: "cut",
    serviceName: "Haircut",
    durationMinutes: 60,
    priceMinor: 2500,
    currency: "USD",
    startAt: new Date(start).toISOString(),
    endAt: new Date(start + 3_600_000).toISOString(),
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: ANA,
    status: "confirmed",
    ...values,
  })
  return id
}

async function visits(howMany: number) {
  const ids: string[] = []
  for (let index = 0; index < howMany; index += 1) {
    const id = await visit(howMany - index)
    await recountBooking(id, NOW)
    ids.push(id)
  }
  return ids
}

const balance = async (ruleId = "rule") =>
  (await customerRewards("biz", ANA)).progress.find(
    (item) => item.rule.id === ruleId
  )?.balance
const statuses = async () =>
  (await db.select().from(rewards)).map((row) => row.status).sort()

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-rewards-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values({
    id: "u1",
    name: "Owner",
    email: "owner@example.com",
    emailVerified: false,
  })
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "America/Santo_Domingo",
    currency: "USD",
    ownerId: "u1",
  })
  await db.insert(services).values([
    {
      id: "cut",
      businessId: "biz",
      name: "Haircut",
      durationMinutes: 60,
      priceMinor: 2500,
    },
    {
      id: "color",
      businessId: "biz",
      name: "Color",
      durationMinutes: 90,
      priceMinor: 6000,
      position: 1,
    },
  ])
})

afterEach(async () => {
  plan.rewards = true
  await db.delete(bookings)
  await db.delete(rewards)
  await db.delete(rewardEvents)
  await db.delete(rewardRules)
})

afterAll(() => {
  db.$client.close()
  rmSync(dir, { recursive: true, force: true })
})

test("a rule is read with its services, by name", async () => {
  await rule()
  await db
    .insert(rewardRuleServices)
    .values([
      { businessId: "biz", ruleId: "rule", serviceId: "cut", role: "reward" },
    ])
  const [read] = await rewardRulesFor("biz")
  expect(read.earnServices).toBeNull()
  expect(read.rewardServices).toEqual([{ id: "cut", name: "Haircut" }])
})

test("an ended visit counts once, however often it is looked at", async () => {
  await rule()
  const id = await visit(1)
  await recountBooking(id, NOW)
  await recountBooking(id, NOW)
  expect(await balance()).toBe(1)
  expect(await db.select().from(rewardEvents)).toHaveLength(1)
})

test("a booking still ahead counts nothing", async () => {
  await rule()
  const id = await visit(-1)
  await recountBooking(id, NOW)
  expect(await balance()).toBe(0)
})

test("reaching the goal makes a reward and starts again from 0", async () => {
  await rule({ expiresDays: 30 })
  await visits(3)
  expect(await balance()).toBe(0)
  const [earned] = await availableRewards("biz", ANA, NOW)
  expect(earned.reward).toEqual({
    type: "free",
    value: null,
    maxDiscountMinor: null,
    services: null,
  })
  expect(earned.expiresAt).toBe(
    new Date(NOW.getTime() + 30 * DAY).toISOString()
  )
})

test('"get 2 free" makes two rewards', async () => {
  await rule({ rewardCount: 2 })
  await visits(3)
  expect(await statuses()).toEqual(["available", "available"])
})

test("the goal reached twice in one change makes two rewards", async () => {
  await rule({ goal: 2 })
  const result = await adjustProgress({
    businessId: "biz",
    ruleId: "rule",
    customerKey: ANA,
    amount: 5,
    actor: "owner",
    actorUserId: "u1",
    note: "Regular since 2020",
  })
  expect(result).toEqual({ ok: true, earned: 2 })
  expect(await balance()).toBe(1)
  const [event] = await db
    .select()
    .from(rewardEvents)
    .where(eq(rewardEvents.type, "adjust"))
  expect(event).toMatchObject({
    actor: "owner",
    actorUserId: "u1",
    note: "Regular since 2020",
  })
})

test("a no-show after counting takes the visit back, and the unused reward with it", async () => {
  await rule()
  const ids = await visits(3)
  await db
    .update(bookings)
    .set({ status: "no_show" })
    .where(eq(bookings.id, ids[2]))
  await recountBooking(ids[2], NOW)
  expect(await statuses()).toEqual(["removed"])
  expect(await balance()).toBe(2)
  // Back to confirmed: counted again, and the reward is earned again.
  await db
    .update(bookings)
    .set({ status: "confirmed" })
    .where(eq(bookings.id, ids[2]))
  await recountBooking(ids[2], NOW)
  expect(await statuses()).toEqual(["available", "removed"])
  expect(await balance()).toBe(0)
})

test("undoing a visit after the reward was used leaves the count under 0", async () => {
  await rule()
  const ids = await visits(3)
  await db.update(rewards).set({ status: "used" })
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, ids[0]))
  await recountBooking(ids[0], NOW)
  expect(await statuses()).toEqual(["used"])
  expect(await balance()).toBe(-1)
})

test("a rule that is off earns nothing new but still undoes what it counted", async () => {
  await rule()
  const [first] = await visits(1)
  await db.update(rewardRules).set({ status: "off" })
  const second = await visit(1)
  await recountBooking(second, NOW)
  expect(await balance()).toBe(1)
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, first))
  await recountBooking(first, NOW)
  expect(await balance()).toBeUndefined()
  expect(await db.select().from(rewardEvents)).toHaveLength(2)
})

test("a business whose plan has no rewards earns nothing", async () => {
  plan.rewards = false
  await rule()
  await visits(3)
  expect(await db.select().from(rewardEvents)).toHaveLength(0)
})

test("only paid bookings count on a paid-only rule", async () => {
  await rule({ paidOnly: true })
  const id = await visit(1, { paymentChoice: "later", paymentStatus: "unpaid" })
  await recountBooking(id, NOW)
  expect(await balance()).toBe(0)
  await db
    .update(bookings)
    .set({ paymentStatus: "paid" })
    .where(eq(bookings.id, id))
  await recountBooking(id, NOW)
  expect(await balance()).toBe(1)
})

test("a rule for chosen services counts only those", async () => {
  await rule()
  await db
    .insert(rewardRuleServices)
    .values([
      { businessId: "biz", ruleId: "rule", serviceId: "color", role: "earn" },
    ])
  await recountBooking(await visit(2), NOW)
  expect(await balance()).toBe(0)
  await recountBooking(await visit(1, { serviceId: "color" }), NOW)
  expect(await balance()).toBe(1)
})

test("a spend rule counts money, and two rules count side by side", async () => {
  await rule()
  await rule({
    id: "spend",
    earnType: "spend",
    goal: 6000,
    rewardType: "amount",
    rewardValue: 1000,
    position: 1,
  })
  await visits(2)
  expect(await balance()).toBe(2)
  expect(await balance("spend")).toBe(5000)
})

test("a customer can earn a rule only as often as it allows", async () => {
  await rule({ goal: 1, maxPerCustomer: 1 })
  await visits(3)
  expect(await statuses()).toEqual(["available"])
  expect(await balance()).toBe(2)
})

test("a held reward is used once the visit happened, and that free visit earns nothing", async () => {
  await rule({ goal: 1 })
  await visits(1)
  const [earned] = await availableRewards("biz", ANA, NOW)
  const id = await visit(-1, {
    priceMinor: 0,
    rewardId: earned.id,
    rewardDiscountMinor: 2500,
  })
  await db.batch([holdRewardWrite(earned.id)])
  expect(await availableRewards("biz", ANA, NOW)).toEqual([])
  // The day after the visit.
  const later = new Date(NOW.getTime() + 2 * DAY)
  await recountBooking(id, later)
  expect(await statuses()).toEqual(["used"])
  expect(await balance()).toBe(0)
})

test("cancelling a booking gives its reward and its price back", async () => {
  await rule({ goal: 1 })
  await visits(1)
  const [earned] = await availableRewards("biz", ANA, NOW)
  const id = await visit(-1, {
    priceMinor: 500,
    rewardId: earned.id,
    rewardDiscountMinor: 2500,
  })
  await db.batch([holdRewardWrite(earned.id)])
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, id))
  await recountBooking(id, NOW)
  expect(await statuses()).toEqual(["available"])
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  expect(row).toMatchObject({
    rewardId: null,
    rewardDiscountMinor: null,
    priceMinor: 3000,
  })
})

test("one reward can never be on two bookings", async () => {
  await rule({ goal: 1 })
  await visits(1)
  const [earned] = await availableRewards("biz", ANA, NOW)
  await visit(-1, { rewardId: earned.id })
  await expect(visit(-2, { rewardId: earned.id })).rejects.toThrow()
})

test("the timer counts ended bookings once and expires old rewards", async () => {
  await rule({ goal: 2, expiresDays: 5 })
  await visit(2)
  await visit(1)
  await visit(-1)
  // From before the rule: never looked at.
  await visit(30)
  expect(await sweepRewards(NOW)).toBe(2)
  expect(await sweepRewards(NOW)).toBe(0)
  expect(await statuses()).toEqual(["available"])
  await sweepRewards(new Date(NOW.getTime() + 6 * DAY))
  expect(await statuses()).toEqual(["expired"])
})

test("another customer's visits are their own", async () => {
  await rule()
  await visits(2)
  await recountBooking(
    await visit(1, { customerKey: "p:1999", customerPhone: "+1999" }),
    NOW
  )
  expect(await balance()).toBe(2)
  expect((await customerRewards("biz", "p:1999")).progress[0].balance).toBe(1)
})

test("a reward given by hand is in the history with who and why, and moves no count", async () => {
  await rule({ rewardCount: 2, expiresDays: 30 })
  await visits(1)
  const given = await giveReward({
    businessId: "biz",
    ruleId: "rule",
    customerKey: ANA,
    actor: "owner",
    actorUserId: "u1",
    note: "Birthday",
    now: NOW,
  })
  expect(given).toBe(true)
  expect(await statuses()).toEqual(["available", "available"])
  expect(await balance()).toBe(1)
  const [latest] = await rewardHistory("biz", ANA, 10)
  expect(latest).toMatchObject({
    type: "adjust",
    amount: 0,
    actor: "owner",
    actorUserId: "u1",
    note: "Birthday",
  })
  // Nothing from a rule that was removed.
  await db.update(rewardRules).set({ status: "ended" })
  expect(
    await giveReward({
      businessId: "biz",
      ruleId: "rule",
      customerKey: ANA,
      actor: "owner",
      actorUserId: "u1",
      note: null,
    })
  ).toBe(false)
})

test("the owner redeems on a booking already made: its service is free, its extra stays", async () => {
  await rule({ goal: 1 })
  await visits(1)
  const id = await visit(-1, { priceMinor: 3000 })
  await db.insert(bookingAddons).values({
    businessId: "biz",
    bookingId: id,
    name: "Wash",
    priceMinor: 500,
    durationMinutes: 0,
  })
  const [offer] = await rewardsForBooking("biz", id, NOW)
  expect(offer.discountMinor).toBe(2500)
  expect(
    await redeemOnBooking({
      businessId: "biz",
      bookingId: id,
      rewardId: offer.id,
      now: NOW,
    })
  ).toBe(true)
  const [row] = await db.select().from(bookings).where(eq(bookings.id, id))
  expect(row).toMatchObject({
    rewardId: offer.id,
    rewardDiscountMinor: 2500,
    priceMinor: 500,
  })
  expect(await statuses()).toEqual(["held"])
  // Once redeemed, nothing more to offer, and never twice.
  expect(await rewardsForBooking("biz", id, NOW)).toEqual([])
  expect(
    await redeemOnBooking({
      businessId: "biz",
      bookingId: id,
      rewardId: offer.id,
      now: NOW,
    })
  ).toBe(false)
})

test("redeemed after the visit, the reward is used at once and that free visit gives its count back", async () => {
  await rule({ goal: 2 })
  const [, second] = await visits(2)
  const third = await visit(0.5)
  await recountBooking(third, NOW)
  expect(await balance()).toBe(1)
  const [offer] = await rewardsForBooking("biz", third, NOW)
  await redeemOnBooking({
    businessId: "biz",
    bookingId: third,
    rewardId: offer.id,
    now: NOW,
  })
  expect(await statuses()).toEqual(["used"])
  expect(await balance()).toBe(0)
  // Another customer's reward, or a cancelled booking, takes none.
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, second))
  expect(await rewardsForBooking("biz", second, NOW)).toEqual([])
})
