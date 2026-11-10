// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, afterEach, beforeAll, expect, test, vi } from "vitest"
import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  bookings,
  businesses,
  rewardEvents,
  rewardRules,
  rewards,
  services,
  user,
} from "@/lib/db/schema"

vi.mock("server-only", () => ({}))
vi.mock("next/cache", () => ({ revalidatePath: () => {} }))
const session = vi.hoisted(() => ({ userId: "owner" }))
vi.mock("@/lib/dal", () => ({
  requireOwner: async () => ({ userId: session.userId }),
}))
const plan = vi.hoisted(() => ({ rewards: true }))
vi.mock("@/lib/plan-access", () => ({
  hasFeature: async () => plan.rewards,
}))

const {
  bookingRewards,
  changeCustomerProgress,
  giveCustomerReward,
  redeemForBooking,
  rewardsOfCustomer,
} = await import("./customer-reward-actions")
const { getCustomerRewards } = await import("./customers")

let dir: string
const ANA = "p:18095550000"

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "koblip-customer-rewards-test-"))
  process.env.DATABASE_URL = `file:${join(dir, "test.db")}`
  const { migrate } = await import("drizzle-orm/libsql/migrator")
  await migrate(db, { migrationsFolder: "drizzle" })
  await db.insert(user).values([
    { id: "owner", name: "O", email: "o@example.com", emailVerified: true },
    { id: "other", name: "X", email: "x@example.com", emailVerified: true },
  ])
  await db.insert(businesses).values({
    id: "biz",
    slug: "shop",
    name: "Shop",
    timezone: "UTC",
    currency: "USD",
    ownerId: "owner",
  })
  await db.insert(services).values({
    id: "cut",
    businessId: "biz",
    name: "Haircut",
    durationMinutes: 60,
    priceMinor: 2500,
  })
})

async function rule() {
  await db.insert(rewardRules).values({
    id: "rule",
    businessId: "biz",
    earnType: "visit",
    goal: 3,
    rewardType: "free",
    startsAt: "2026-01-01T00:00:00.000Z",
  })
}

afterEach(async () => {
  session.userId = "owner"
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

const change = (amount: number, note = "Regular") =>
  changeCustomerProgress("biz", {
    ruleId: "rule",
    customerKey: ANA,
    amount,
    note,
  })

test("the owner adds visits with a reason; reaching the goal makes the reward", async () => {
  await rule()
  expect(await change(4)).toEqual({ ok: true, earned: 1 })
  const mine = await getCustomerRewards("biz", ANA)
  expect(mine?.rules.map((item) => item.balance)).toEqual([1])
  expect(mine?.rewards).toHaveLength(1)
  expect(mine?.history.map((event) => [event.type, event.amount])).toEqual(
    expect.arrayContaining([
      ["adjust", 4],
      ["convert", -3],
    ])
  )
  expect(mine?.history.find((event) => event.type === "adjust")).toMatchObject({
    byHand: true,
    note: "Regular",
  })
})

test("a change needs a reason and a whole number in range", async () => {
  await rule()
  expect(await change(2, "  ")).toEqual({ ok: false, error: "note" })
  expect(await change(0)).toEqual({ ok: false, error: "amount" })
  expect(await change(1.5)).toEqual({ ok: false, error: "amount" })
  expect(await change(101)).toEqual({ ok: false, error: "amount" })
  expect(await db.select().from(rewardEvents)).toHaveLength(0)
})

test("removing visits takes an unused reward back", async () => {
  await rule()
  await change(3)
  expect(await change(-1)).toEqual({ ok: true, earned: 0 })
  const mine = await getCustomerRewards("biz", ANA)
  expect(mine?.rewards).toEqual([])
  expect(mine?.rules.map((item) => item.balance)).toEqual([2])
})

test("giving a reward needs a reason and leaves the count alone", async () => {
  await rule()
  const input = { ruleId: "rule", customerKey: ANA, note: "" }
  expect(await giveCustomerReward("biz", input)).toEqual({
    ok: false,
    error: "note",
  })
  expect(
    await giveCustomerReward("biz", { ...input, note: "Birthday" })
  ).toEqual({ ok: true })
  const mine = await getCustomerRewards("biz", ANA)
  expect(mine?.rewards).toHaveLength(1)
  expect(mine?.rules.map((item) => item.balance)).toEqual([0])
})

test("the owner redeems a customer's reward on their booking", async () => {
  await rule()
  await change(3)
  await db.insert(bookings).values({
    id: "bk",
    businessId: "biz",
    serviceId: "cut",
    serviceName: "Haircut",
    durationMinutes: 60,
    priceMinor: 2500,
    currency: "USD",
    startAt: "2099-01-01T10:00:00.000Z",
    endAt: "2099-01-01T11:00:00.000Z",
    customerName: "Ana",
    customerPhone: "+18095550000",
    customerKey: ANA,
  })
  // Found while adding a booking too, by the phone as it is typed.
  const [typed] = await rewardsOfCustomer("biz", {
    name: "Ana",
    phone: "+1 809 555 0000",
    serviceId: "cut",
  })
  const [offer] = await bookingRewards("biz", "bk")
  expect(offer.discountMinor).toBe(2500)
  expect(typed.id).toBe(offer.id)
  expect(await redeemForBooking("biz", "bk", offer.id)).toEqual({ ok: true })
  const [row] = await db.select().from(bookings).where(eq(bookings.id, "bk"))
  expect(row).toMatchObject({ priceMinor: 0, rewardDiscountMinor: 2500 })
  expect(await redeemForBooking("biz", "bk", offer.id)).toEqual({
    ok: false,
    error: "reward",
  })
  expect((await getCustomerRewards("biz", ANA))?.rewards).toEqual([
    expect.objectContaining({ id: offer.id, held: true }),
  ])
})

test("another owner, or a plan with no rewards, can do none of it", async () => {
  await rule()
  session.userId = "other"
  expect(await change(1)).toEqual({ ok: false, error: "not_found" })
  expect(await bookingRewards("biz", "bk")).toEqual([])
  session.userId = "owner"
  plan.rewards = false
  expect(await change(1)).toEqual({ ok: false, error: "not_found" })
  expect(
    await giveCustomerReward("biz", {
      ruleId: "rule",
      customerKey: ANA,
      note: "x",
    })
  ).toEqual({ ok: false, error: "not_found" })
  expect(await db.select().from(rewardEvents)).toHaveLength(0)
})
