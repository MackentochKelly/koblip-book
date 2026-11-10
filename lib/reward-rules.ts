// Rewards (docs/plans/rewards.md): a business sets rules like "after 5
// visits, 1 free haircut"; customers earn by booking and redeem a reward on
// a later booking. Koblip never moves money: a reward only lowers the price
// a booking shows and stores. This file is the rules alone, no database.
import { EARNING_STATUSES } from "./booking-rules"
import type { PaymentStatus } from "./payment-rules"

export const REWARD_RULES = {
  // Rules a business can have that are not ended.
  maxRules: 10,
  maxGoalVisits: 100,
  // How many bookings one earned reward covers ("get 2 free").
  maxCount: 10,
  maxExpiresDays: 730,
  maxPerCustomer: 100,
  // The reason an owner gives when adding or removing visits by hand.
  maxNote: 120,
  // Visits the owner can add or remove in one go.
  maxAdjust: 100,
  // How often the server counts ended bookings and expires rewards.
  sweepMinutes: 5,
  // Ended bookings counted per sweep.
  sweepBatch: 200,
} as const

// visit: each booking counts 1. spend: each booking counts its price.
export const REWARD_EARN_TYPES = ["visit", "spend"] as const
export type RewardEarnType = (typeof REWARD_EARN_TYPES)[number]

// free: the service is free. percent: X% off it. amount: a fixed amount off.
export const REWARD_TYPES = ["free", "percent", "amount"] as const
export type RewardType = (typeof REWARD_TYPES)[number]

// off: earns nothing for now. ended: closed for good, kept for its history.
export const REWARD_RULE_STATUSES = ["active", "off", "ended"] as const
export type RewardRuleStatus = (typeof REWARD_RULE_STATUSES)[number]

// The history (reward_events), rows only ever added. earn: a booking
// counted. reverse: a counted booking was undone. adjust: the owner added
// or removed by hand. convert: the goal was reached and a reward made.
// expire: reserved for progress that lapses.
export const REWARD_EVENT_TYPES = [
  "earn",
  "reverse",
  "adjust",
  "convert",
  "expire",
] as const
export type RewardEventType = (typeof REWARD_EVENT_TYPES)[number]

// available → held (on a booking still ahead) → used (the visit happened);
// or expired, or removed (its visits were undone, or the owner took it).
export const REWARD_STATUSES = [
  "available",
  "held",
  "used",
  "expired",
  "removed",
] as const
export type RewardStatus = (typeof REWARD_STATUSES)[number]

export const REWARD_ACTORS = ["system", "owner", "assistant"] as const
export type RewardActor = (typeof REWARD_ACTORS)[number]

// Which services a rule's part is about; null = every service.
export type RewardServices = { id: string; name: string }[] | null

// One rule as the owner set it.
export interface RewardRule {
  id: string
  status: RewardRuleStatus
  earnType: RewardEarnType
  earnServices: RewardServices
  // A booking under this price does not count; null = any price.
  earnMinPriceMinor: number | null
  // Visits, or minor units of the business's currency.
  goal: number
  rewardType: RewardType
  // The percent (1–100) or the amount in minor units; null for free.
  rewardValue: number | null
  rewardCount: number
  rewardServices: RewardServices
  // The most one use can take off; null = no cap.
  maxDiscountMinor: number | null
  // Days an earned reward stays usable; null = for good.
  expiresDays: number | null
  // Bookings count from this moment (set when the rule is made, so older
  // visits never count) until endsAt; null endsAt = no end.
  startsAt: string | null
  endsAt: string | null
  // Times one customer can earn it; null = again and again.
  maxPerCustomer: number | null
  // Only bookings the owner marked paid count.
  paidOnly: boolean
}

// What a rule gave, copied onto each earned reward: a later change to the
// rule never changes rewards already earned.
export interface RewardCopy {
  type: RewardType
  value: number | null
  maxDiscountMinor: number | null
  services: RewardServices
}

export function rewardCopy(rule: RewardRule): RewardCopy {
  return {
    type: rule.rewardType,
    value: rule.rewardValue,
    maxDiscountMinor: rule.maxDiscountMinor,
    services: rule.rewardServices,
  }
}

// What a form sends for a rule: service ids only, the names are read from
// the business's services when it is saved.
export interface RewardRuleInput {
  earnType: RewardEarnType
  earnServiceIds: string[] | null
  earnMinPriceMinor: number | null
  goal: number
  rewardType: RewardType
  rewardValue: number | null
  rewardCount: number
  rewardServiceIds: string[] | null
  maxDiscountMinor: number | null
  expiresDays: number | null
  endsAt: string | null
  maxPerCustomer: number | null
  paidOnly: boolean
}

export type RewardRuleField =
  | "earnType"
  | "earnServices"
  | "earnMinPrice"
  | "goal"
  | "rewardType"
  | "rewardValue"
  | "rewardCount"
  | "rewardServices"
  | "maxDiscount"
  | "expiresDays"
  | "endsAt"
  | "maxPerCustomer"

function wholeIn(value: unknown, min: number, max: number): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
  )
}

// null stays null; anything else must be a whole number in range.
function optionalWhole(
  value: unknown,
  min: number,
  max: number
): number | null | undefined {
  if (value === null || value === undefined) return null
  return wholeIn(value, min, max) ? value : undefined
}

// A list of the business's own service ids, without repeats; null = every
// service. An empty list or an unknown id is refused.
function serviceIds(
  value: unknown,
  known: ReadonlySet<string>
): string[] | null | undefined {
  if (value === null || value === undefined) return null
  if (!Array.isArray(value) || value.length === 0) return undefined
  const ids = [...new Set(value)]
  return ids.every((id) => typeof id === "string" && known.has(id))
    ? (ids as string[])
    : undefined
}

// Checks one rule sent from the owner's form or the assistant. maxMinor is
// the highest price the app allows (BOOKING_RULES.maxPriceMinor).
export function checkRewardRule(
  input: Partial<Record<keyof RewardRuleInput, unknown>> | null | undefined,
  knownServiceIds: ReadonlySet<string>,
  maxMinor: number
):
  | { ok: true; values: RewardRuleInput }
  | { ok: false; error: RewardRuleField } {
  const fail = (error: RewardRuleField) => ({ ok: false as const, error })
  const earnType = REWARD_EARN_TYPES.find((type) => type === input?.earnType)
  if (!earnType) return fail("earnType")
  const earnServiceIds = serviceIds(input?.earnServiceIds, knownServiceIds)
  if (earnServiceIds === undefined) return fail("earnServices")
  const earnMinPriceMinor = optionalWhole(input?.earnMinPriceMinor, 1, maxMinor)
  if (earnMinPriceMinor === undefined) return fail("earnMinPrice")
  const goal = input?.goal
  if (
    !wholeIn(
      goal,
      1,
      earnType === "visit" ? REWARD_RULES.maxGoalVisits : maxMinor * 100
    )
  ) {
    return fail("goal")
  }
  const rewardType = REWARD_TYPES.find((type) => type === input?.rewardType)
  if (!rewardType) return fail("rewardType")
  let rewardValue: number | null = null
  if (rewardType !== "free") {
    const top = rewardType === "percent" ? 100 : maxMinor
    if (!wholeIn(input?.rewardValue, 1, top)) return fail("rewardValue")
    rewardValue = input.rewardValue
  }
  const rewardCount = input?.rewardCount ?? 1
  if (!wholeIn(rewardCount, 1, REWARD_RULES.maxCount)) {
    return fail("rewardCount")
  }
  const rewardServiceIds = serviceIds(input?.rewardServiceIds, knownServiceIds)
  if (rewardServiceIds === undefined) return fail("rewardServices")
  // A fixed amount is its own cap.
  const maxDiscountMinor =
    rewardType === "amount"
      ? null
      : optionalWhole(input?.maxDiscountMinor, 1, maxMinor)
  if (maxDiscountMinor === undefined) return fail("maxDiscount")
  const expiresDays = optionalWhole(
    input?.expiresDays,
    1,
    REWARD_RULES.maxExpiresDays
  )
  if (expiresDays === undefined) return fail("expiresDays")
  let endsAt: string | null = null
  if (input?.endsAt !== null && input?.endsAt !== undefined) {
    if (
      typeof input.endsAt !== "string" ||
      Number.isNaN(Date.parse(input.endsAt))
    ) {
      return fail("endsAt")
    }
    endsAt = new Date(input.endsAt).toISOString()
  }
  const maxPerCustomer = optionalWhole(
    input?.maxPerCustomer,
    1,
    REWARD_RULES.maxPerCustomer
  )
  if (maxPerCustomer === undefined) return fail("maxPerCustomer")
  return {
    ok: true,
    values: {
      earnType,
      earnServiceIds,
      earnMinPriceMinor,
      goal,
      rewardType,
      rewardValue,
      rewardCount,
      rewardServiceIds,
      maxDiscountMinor,
      expiresDays,
      endsAt,
      maxPerCustomer,
      paidOnly: input?.paidOnly === true,
    },
  }
}

function inServices(services: RewardServices, serviceId: string | null) {
  return (
    services === null ||
    (serviceId !== null && services.some((service) => service.id === serviceId))
  )
}

// What a booking carries that decides whether it counts.
export interface EarningBooking {
  status: string
  startAt: string
  endAt: string
  serviceId: string | null
  // What is to pay, after any reward.
  priceMinor: number | null
  paymentStatus: PaymentStatus | null
  // The kind of reward the booking itself used; null when it used none.
  usedReward: RewardType | null
}

// How much a booking counts on a rule right now: 0, 1 for a visit, or its
// price for a spend rule. The rule's status is not looked at here: a rule
// that is off earns nothing new, but a booking it already counted must
// still be undone when it is cancelled (lib/rewards.ts decides). A visit counts once it happened (it ended, and is
// confirmed or completed: the app's one rule, isEarned), never when it is
// only booked; a cancelled or no-show booking counts 0, which is how a
// counted booking gets undone. A booking a reward made free earns nothing.
export function earnAmount(
  rule: RewardRule,
  booking: EarningBooking,
  now: string
): number {
  if (!EARNING_STATUSES.some((status) => status === booking.status)) return 0
  if (booking.endAt > now) return 0
  if (rule.startsAt && booking.startAt < rule.startsAt) return 0
  if (rule.endsAt && booking.startAt > rule.endsAt) return 0
  if (!inServices(rule.earnServices, booking.serviceId)) return 0
  if (booking.usedReward === "free") return 0
  if (rule.paidOnly && booking.paymentStatus !== "paid") return 0
  const price = booking.priceMinor ?? 0
  if (rule.earnMinPriceMinor !== null && price < rule.earnMinPriceMinor) {
    return 0
  }
  return rule.earnType === "visit" ? 1 : price
}

// How many rewards a balance has reached, given how many times this
// customer already earned the rule: each one takes `goal` off the balance.
export function goalsReached(
  rule: Pick<RewardRule, "goal" | "maxPerCustomer">,
  balance: number,
  earnedBefore: number
): number {
  const reached = Math.max(0, Math.floor(balance / rule.goal))
  if (rule.maxPerCustomer === null) return reached
  return Math.min(reached, Math.max(0, rule.maxPerCustomer - earnedBefore))
}

// The day an earned reward stops being usable; null = never.
export function rewardExpiry(
  expiresDays: number | null,
  earnedAt: string
): string | null {
  if (expiresDays === null) return null
  return new Date(Date.parse(earnedAt) + expiresDays * 86_400_000).toISOString()
}

// Whether a reward can be used on this service at all.
export function rewardFits(reward: RewardCopy, serviceId: string): boolean {
  return inServices(reward.services, serviceId)
}

// What a reward takes off a service's own price (never its extras, never
// more than the price); null when it takes nothing: a service with no
// price, or a free one.
export function rewardDiscount(
  reward: RewardCopy,
  servicePriceMinor: number | null
): number | null {
  if (servicePriceMinor === null || servicePriceMinor <= 0) return null
  const full =
    reward.type === "free"
      ? servicePriceMinor
      : reward.type === "percent"
        ? Math.round((servicePriceMinor * (reward.value ?? 0)) / 100)
        : (reward.value ?? 0)
  const capped = Math.min(
    full,
    servicePriceMinor,
    reward.maxDiscountMinor ?? Number.POSITIVE_INFINITY
  )
  return capped > 0 ? capped : null
}

// An earned reward a customer holds.
export interface HeldReward {
  id: string
  reward: RewardCopy
  expiresAt: string | null
}

// Whether a reward can be redeemed on this service today.
export function redeemable(
  held: HeldReward,
  service: { id: string; priceMinor: number | null },
  now: string
): number | null {
  if (held.expiresAt !== null && held.expiresAt <= now) return null
  if (!rewardFits(held.reward, service.id)) return null
  return rewardDiscount(held.reward, service.priceMinor)
}

// The rewards usable on a service, the one that saves the most first; on a
// tie, the one that expires soonest (so nothing is lost by waiting).
export function usableRewards<Held extends HeldReward>(
  rewards: readonly Held[],
  service: { id: string; priceMinor: number | null },
  now: string
): { reward: Held; discountMinor: number }[] {
  return rewards
    .flatMap((reward) => {
      const discountMinor = redeemable(reward, service, now)
      return discountMinor === null ? [] : [{ reward, discountMinor }]
    })
    .sort(
      (a, b) =>
        b.discountMinor - a.discountMinor ||
        (a.reward.expiresAt ?? "9").localeCompare(b.reward.expiresAt ?? "9")
    )
}

// A booking's total with a reward on its service: the service's price less
// the discount, plus its extras.
export function totalWithReward(
  totalMinor: number | null,
  discountMinor: number
): number {
  return Math.max(0, (totalMinor ?? 0) - discountMinor)
}

// How far a customer is on a rule, for "3 of 5": never under 0 or over the
// goal on screen, whatever the history sums to.
export function progressShown(balance: number, goal: number): number {
  return Math.min(goal, Math.max(0, balance))
}
