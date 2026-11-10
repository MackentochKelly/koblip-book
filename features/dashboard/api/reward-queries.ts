import "server-only"

import { hasFeature } from "@/lib/plan-access"
import type { RewardRule } from "@/lib/reward-rules"
import { rewardCounts, rewardRulesFor } from "@/lib/rewards"
import { getOwnerBusiness } from "./queries"

export interface RewardSettings {
  // False on a plan without rewards: nothing else is read.
  available: boolean
  currency: string
  // The rules that are not ended, in the owner's order.
  rules: RewardRule[]
  // Customers who have counted something, rewards waiting to be redeemed,
  // and rewards used.
  counts: { earning: number; waiting: number; used: number }
}

// The owner's reward rules and their numbers (docs/plans/rewards.md), for
// the assistant. Checks the business is the signed-in owner's first.
export async function getRewardSettings(
  businessId: string
): Promise<RewardSettings> {
  const { business } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(business.id, "rewards"))) {
    return {
      available: false,
      currency: business.currency,
      rules: [],
      counts: { earning: 0, waiting: 0, used: 0 },
    }
  }
  const [rules, counts] = await Promise.all([
    rewardRulesFor(business.id),
    rewardCounts(business.id),
  ])
  return { available: true, currency: business.currency, rules, counts }
}
