import { expect, test } from "vitest"

import {
  checkRewardRule,
  earnAmount,
  goalsReached,
  progressShown,
  redeemable,
  rewardChoices,
  rewardDiscount,
  rewardExpiry,
  totalWithReward,
  usableRewards,
  type EarningBooking,
  type RewardCopy,
  type RewardRule,
  type RewardRuleInput,
} from "./reward-rules"

const MAX = 10_000_000
const known = new Set(["cut", "color"])

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

const rule: RewardRule = {
  id: "r1",
  status: "active",
  earnType: "visit",
  earnServices: null,
  earnMinPriceMinor: null,
  goal: 5,
  rewardType: "free",
  rewardValue: null,
  rewardCount: 1,
  rewardServices: null,
  maxDiscountMinor: null,
  expiresDays: null,
  startsAt: "2026-11-01T00:00:00.000Z",
  endsAt: null,
  maxPerCustomer: null,
  paidOnly: false,
}

const visit: EarningBooking = {
  status: "confirmed",
  startAt: "2026-11-10T15:00:00.000Z",
  endAt: "2026-11-10T16:00:00.000Z",
  serviceId: "cut",
  priceMinor: 2500,
  paymentStatus: null,
  usedReward: null,
}
const NOW = "2026-11-11T00:00:00.000Z"

const free: RewardCopy = {
  type: "free",
  value: null,
  maxDiscountMinor: null,
  services: null,
}
const percent = (value: number, cap: number | null = null): RewardCopy => ({
  type: "percent",
  value,
  maxDiscountMinor: cap,
  services: null,
})
const amount = (value: number): RewardCopy => ({
  type: "amount",
  value,
  maxDiscountMinor: null,
  services: null,
})

test("a good rule passes, with what was sent", () => {
  expect(checkRewardRule(input, known, MAX)).toEqual({
    ok: true,
    values: input,
  })
})

test("a percent or an amount needs its number; free keeps none", () => {
  expect(
    checkRewardRule({ ...input, rewardType: "percent" }, known, MAX)
  ).toEqual({ ok: false, error: "rewardValue" })
  expect(
    checkRewardRule(
      { ...input, rewardType: "percent", rewardValue: 101 },
      known,
      MAX
    )
  ).toEqual({ ok: false, error: "rewardValue" })
  const freeRule = checkRewardRule({ ...input, rewardValue: 50 }, known, MAX)
  expect(freeRule.ok && freeRule.values.rewardValue).toBeNull()
})

test("each wrong part is refused by name", () => {
  const refuse = (change: Record<string, unknown>) => {
    const result = checkRewardRule({ ...input, ...change }, known, MAX)
    return result.ok ? null : result.error
  }
  expect(refuse({ earnType: "points" })).toBe("earnType")
  expect(refuse({ earnServiceIds: ["nails"] })).toBe("earnServices")
  expect(refuse({ earnServiceIds: [] })).toBe("earnServices")
  expect(refuse({ earnMinPriceMinor: 0 })).toBe("earnMinPrice")
  expect(refuse({ goal: 0 })).toBe("goal")
  expect(refuse({ goal: 2.5 })).toBe("goal")
  expect(refuse({ goal: 101 })).toBe("goal")
  expect(refuse({ rewardType: "gift" })).toBe("rewardType")
  expect(refuse({ rewardCount: 11 })).toBe("rewardCount")
  expect(refuse({ rewardServiceIds: ["nails"] })).toBe("rewardServices")
  expect(refuse({ maxDiscountMinor: -1 })).toBe("maxDiscount")
  expect(refuse({ expiresDays: 0 })).toBe("expiresDays")
  expect(refuse({ endsAt: "soon" })).toBe("endsAt")
  expect(refuse({ maxPerCustomer: 0 })).toBe("maxPerCustomer")
  expect(checkRewardRule(null, known, MAX).ok).toBe(false)
})

test("a spend goal may be far above 100", () => {
  expect(
    checkRewardRule({ ...input, earnType: "spend", goal: 30_000 }, known, MAX)
      .ok
  ).toBe(true)
})

test("a visit counts once it happened", () => {
  expect(earnAmount(rule, visit, NOW)).toBe(1)
  expect(earnAmount(rule, { ...visit, status: "completed" }, NOW)).toBe(1)
  // Still ahead.
  expect(earnAmount(rule, visit, "2026-11-10T15:30:00.000Z")).toBe(0)
})

test("cancelled and no-show bookings count nothing", () => {
  expect(earnAmount(rule, { ...visit, status: "cancelled" }, NOW)).toBe(0)
  expect(earnAmount(rule, { ...visit, status: "no_show" }, NOW)).toBe(0)
})

test("visits from before the rule, or after its end, don't count", () => {
  expect(
    earnAmount(rule, { ...visit, startAt: "2026-10-31T15:00:00.000Z" }, NOW)
  ).toBe(0)
  expect(
    earnAmount({ ...rule, endsAt: "2026-11-05T00:00:00.000Z" }, visit, NOW)
  ).toBe(0)
})

test("only the chosen services count", () => {
  const cuts = { ...rule, earnServices: [{ id: "cut", name: "Haircut" }] }
  expect(earnAmount(cuts, visit, NOW)).toBe(1)
  expect(earnAmount(cuts, { ...visit, serviceId: "color" }, NOW)).toBe(0)
  // The service was deleted since.
  expect(earnAmount(cuts, { ...visit, serviceId: null }, NOW)).toBe(0)
})

test("a booking under the minimum price doesn't count", () => {
  const min = { ...rule, earnMinPriceMinor: 3000 }
  expect(earnAmount(min, visit, NOW)).toBe(0)
  expect(earnAmount(min, { ...visit, priceMinor: 3000 }, NOW)).toBe(1)
  expect(earnAmount(min, { ...visit, priceMinor: null }, NOW)).toBe(0)
})

test("paid only waits for the owner's word", () => {
  const paid = { ...rule, paidOnly: true }
  expect(earnAmount(paid, visit, NOW)).toBe(0)
  expect(earnAmount(paid, { ...visit, paymentStatus: "reported" }, NOW)).toBe(0)
  expect(earnAmount(paid, { ...visit, paymentStatus: "paid" }, NOW)).toBe(1)
})

test("a booking a reward made free earns nothing; a discounted one does", () => {
  expect(earnAmount(rule, { ...visit, usedReward: "free" }, NOW)).toBe(0)
  expect(earnAmount(rule, { ...visit, usedReward: "percent" }, NOW)).toBe(1)
})

test("a spend rule counts what is to pay", () => {
  const spend = { ...rule, earnType: "spend" as const, goal: 30_000 }
  expect(earnAmount(spend, visit, NOW)).toBe(2500)
  expect(earnAmount(spend, { ...visit, priceMinor: null }, NOW)).toBe(0)
})

test("each goal reached is one reward, up to the customer's limit", () => {
  expect(goalsReached(rule, 4, 0)).toBe(0)
  expect(goalsReached(rule, 5, 0)).toBe(1)
  expect(goalsReached(rule, 11, 0)).toBe(2)
  expect(goalsReached(rule, -3, 0)).toBe(0)
  expect(goalsReached({ ...rule, maxPerCustomer: 1 }, 11, 0)).toBe(1)
  expect(goalsReached({ ...rule, maxPerCustomer: 1 }, 11, 1)).toBe(0)
})

test("a reward expires its days after it was earned, or never", () => {
  expect(rewardExpiry(null, NOW)).toBeNull()
  expect(rewardExpiry(30, NOW)).toBe("2026-12-11T00:00:00.000Z")
})

test("free takes the whole service price", () => {
  expect(rewardDiscount(free, 2500)).toBe(2500)
})

test("percent is rounded and can be capped", () => {
  expect(rewardDiscount(percent(20), 2500)).toBe(500)
  expect(rewardDiscount(percent(33), 1000)).toBe(330)
  expect(rewardDiscount(percent(15), 999)).toBe(150)
  expect(rewardDiscount(percent(50, 1000), 5000)).toBe(1000)
})

test("an amount never takes more than the price", () => {
  expect(rewardDiscount(amount(1000), 2500)).toBe(1000)
  expect(rewardDiscount(amount(5000), 2500)).toBe(2500)
})

test("a service with no price, or a free one, takes no reward", () => {
  expect(rewardDiscount(free, null)).toBeNull()
  expect(rewardDiscount(percent(20), 0)).toBeNull()
})

test("a reward is redeemable only on its services and before it expires", () => {
  const cutOnly = {
    id: "w1",
    reward: { ...free, services: [{ id: "cut", name: "Haircut" }] },
    expiresAt: "2026-12-01T00:00:00.000Z",
  }
  expect(redeemable(cutOnly, { id: "cut", priceMinor: 2500 }, NOW)).toBe(2500)
  expect(redeemable(cutOnly, { id: "color", priceMinor: 6000 }, NOW)).toBeNull()
  expect(
    redeemable(
      cutOnly,
      { id: "cut", priceMinor: 2500 },
      "2026-12-01T00:00:00.000Z"
    )
  ).toBeNull()
})

test("the reward that saves the most comes first, then the one ending soonest", () => {
  const list = [
    { id: "a", reward: percent(10), expiresAt: null },
    { id: "b", reward: amount(1000), expiresAt: null },
    { id: "c", reward: amount(1000), expiresAt: "2026-12-01T00:00:00.000Z" },
    { id: "d", reward: free, expiresAt: "2026-01-01T00:00:00.000Z" },
  ]
  expect(
    usableRewards(list, { id: "cut", priceMinor: 2500 }, NOW).map(
      (item) => item.reward.id
    )
  ).toEqual(["c", "b", "a"])
})

test("rewards that give the same thing are one choice, the one ending soonest", () => {
  const list = [
    { id: "a", reward: percent(10), expiresAt: null },
    { id: "b", reward: amount(1000), expiresAt: null },
    { id: "c", reward: amount(1000), expiresAt: "2026-12-01T00:00:00.000Z" },
  ]
  expect(
    rewardChoices(usableRewards(list, { id: "cut", priceMinor: 2500 }, NOW)).map(
      (item) => item.reward.id
    )
  ).toEqual(["c", "a"])
})

test("the total keeps the extras and never goes under 0", () => {
  // A 25.00 haircut made free, with a 5.00 extra.
  expect(totalWithReward(3000, 2500)).toBe(500)
  expect(totalWithReward(2500, 2500)).toBe(0)
  expect(totalWithReward(null, 100)).toBe(0)
})

test("progress shown stays between 0 and the goal", () => {
  expect(progressShown(3, 5)).toBe(3)
  expect(progressShown(-2, 5)).toBe(0)
  expect(progressShown(7, 5)).toBe(5)
})
