import "server-only"

import { hasFeature } from "@/lib/plan-access"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { REWARD_RULES, type RewardActor } from "@/lib/reward-rules"
import { adjustProgress, rewardRulesFor } from "@/lib/rewards"
import type { ActionResult } from "../types"
import { ownedBusiness } from "./owned-business"

// Changes to one customer's rewards that more than one caller makes: the
// owner's own actions (customer-reward-actions.ts) and the assistant, each
// under its own name in the history. Not actions: the browser never
// chooses who made a change.

// The owner's own business, only on a plan with rewards.
export async function ownedWithRewards(businessId: string) {
  const owned = await ownedBusiness(businessId)
  if (!owned) return null
  return (await hasFeature(owned.business.id, "rewards")) ? owned : null
}

// The reason every change by hand carries; null when it is missing or too
// long.
export function reasonOf(note: unknown): string | null {
  const reason = typeof note === "string" ? note.trim() : ""
  return reason.length < 1 || reason.length > REWARD_RULES.maxNote
    ? null
    : reason
}

export interface ProgressChange {
  ruleId: string
  customerKey: string
  amount: number
  note: string
}

// Adds to a customer's count on a rule, or takes from it (a negative
// amount): visits on a visit rule, money in minor units on a spend rule.
// Rewards are made or taken back as the new count says.
export async function changeProgress(
  businessId: string,
  input: ProgressChange,
  actor: Exclude<RewardActor, "system">
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
    actor,
    actorUserId: owned.userId,
    note,
  })
  if (!result.ok) return { ok: false, error: "not_found" }
  revalidateBusiness(owned.business.slug)
  return { ok: true, earned: result.earned }
}
