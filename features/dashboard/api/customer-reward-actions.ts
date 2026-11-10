"use server"

import { PHONE_PATTERN } from "@/lib/booking-rules"
import { customerKey } from "@/lib/customer-key"
import { hasFeature } from "@/lib/plan-access"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { REWARD_RULES } from "@/lib/reward-rules"
import {
  adjustProgress,
  giveReward,
  redeemOnBooking,
  rewardRulesFor,
  rewardsForBooking,
  rewardsForService,
  type BookingReward,
} from "@/lib/rewards"
import { internationalPhone } from "@/lib/whatsapp-phone"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"

// What the owner does with one customer's rewards (docs/plans/rewards.md,
// RW8): add or remove visits and give a reward, each with a reason, and
// redeem a reward for the customer in front of them. Every action is the
// owner's, on their own business only, and only on a plan with rewards.

async function ownedWithRewards(businessId: string) {
  const owned = await ownedBusiness(businessId)
  if (!owned) return null
  return (await hasFeature(owned.business.id, "rewards")) ? owned : null
}

// The reason every change by hand carries; null when it is missing or too
// long.
function reasonOf(note: unknown): string | null {
  const reason = typeof note === "string" ? note.trim() : ""
  return reason.length < 1 || reason.length > REWARD_RULES.maxNote
    ? null
    : reason
}

// Adds to a customer's count on a rule, or takes from it (a negative
// amount): visits on a visit rule, money in minor units on a spend rule.
// Rewards are made or taken back as the new count says.
export async function changeCustomerProgress(
  businessId: string,
  input: { ruleId: string; customerKey: string; amount: number; note: string }
): Promise<ActionResult<{ earned: number }>> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const note = reasonOf(input.note)
  if (!note) return { ok: false, error: "note" }
  const rule = (await rewardRulesFor(owned.business.id)).find(
    (item) => item.id === input.ruleId
  )
  if (!rule || typeof input.customerKey !== "string" || !input.customerKey) {
    return { ok: false, error: "not_found" }
  }
  // A few goals' worth at most in one change.
  const most =
    rule.earnType === "visit"
      ? REWARD_RULES.maxAdjust
      : rule.goal * REWARD_RULES.maxCount
  if (
    !Number.isInteger(input.amount) ||
    input.amount === 0 ||
    Math.abs(input.amount) > most
  ) {
    return { ok: false, error: "amount" }
  }
  const result = await adjustProgress({
    businessId: owned.business.id,
    ruleId: rule.id,
    customerKey: input.customerKey,
    amount: input.amount,
    actor: "owner",
    actorUserId: owned.userId,
    note,
  })
  if (!result.ok) return { ok: false, error: "not_found" }
  revalidateBusiness(owned.business.slug)
  return { ok: true, earned: result.earned }
}

// Gives the customer a rule's reward by hand.
export async function giveCustomerReward(
  businessId: string,
  input: { ruleId: string; customerKey: string; note: string }
): Promise<ActionResult> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const note = reasonOf(input.note)
  if (!note) return { ok: false, error: "note" }
  if (typeof input.customerKey !== "string" || !input.customerKey) {
    return { ok: false, error: "not_found" }
  }
  const given = await giveReward({
    businessId: owned.business.id,
    ruleId: input.ruleId,
    customerKey: input.customerKey,
    actor: "owner",
    actorUserId: owned.userId,
    note,
  })
  if (!given) return { ok: false, error: "not_found" }
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// The rewards usable on one of the business's bookings, best first.
export async function bookingRewards(
  businessId: string,
  bookingId: string
): Promise<BookingReward[]> {
  const owned = await ownedWithRewards(businessId)
  return owned ? rewardsForBooking(owned.business.id, bookingId) : []
}

// Redeems the customer's reward on a booking already made.
export async function redeemForBooking(
  businessId: string,
  bookingId: string,
  rewardId: string
): Promise<ActionResult> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return { ok: false, error: "not_found" }
  const done = await redeemOnBooking({
    businessId: owned.business.id,
    bookingId,
    rewardId,
  })
  if (!done) return { ok: false, error: "reward" }
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}

// The rewards the owner can redeem on a booking they are adding, best
// first. The customer is found the way the booking will be saved: by the
// phone, or by the name without one.
export async function rewardsOfCustomer(
  businessId: string,
  input: { name: string; phone: string | null; serviceId: string }
): Promise<BookingReward[]> {
  const owned = await ownedWithRewards(businessId)
  if (!owned) return []
  const name = typeof input.name === "string" ? input.name.trim() : ""
  const raw = typeof input.phone === "string" ? input.phone.trim() : ""
  if (!name || (raw !== "" && !PHONE_PATTERN.test(raw))) return []
  if (typeof input.serviceId !== "string") return []
  const phone = raw === "" ? null : internationalPhone(raw, owned.business)
  return rewardsForService(
    owned.business.id,
    customerKey(phone, name),
    input.serviceId
  )
}
