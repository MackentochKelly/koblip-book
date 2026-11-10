import "server-only"

import { desc, eq } from "drizzle-orm"

import { customerKeyLabel } from "@/lib/customer-key"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses, rewardEvents, rewardRules, rewards } from "@/lib/db/schema"
import type {
  RewardActor,
  RewardCopy,
  RewardEventType,
  RewardRule,
  RewardStatus,
} from "@/lib/reward-rules"
import { rewardRulesFor } from "@/lib/rewards"

// Every list stops here; the newest come first.
const MAX_ROWS = 200

// Home page demo copies are not real businesses: every list leaves them
// out.
const realBusiness = eq(businesses.isDemo, false)

export interface AdminRewards {
  // Each business with a rule, removed rules too.
  businesses: {
    id: string
    name: string
    currency: string
    rules: RewardRule[]
  }[]
  earned: {
    id: string
    businessName: string
    currency: string
    customer: string
    reward: RewardCopy
    status: RewardStatus
    earnedAt: string
    expiresAt: string | null
  }[]
  history: {
    id: string
    businessName: string
    currency: string
    // Its rule counts money, so `amount` is in minor units.
    spend: boolean
    customer: string
    type: RewardEventType
    amount: number
    actor: RewardActor
    note: string | null
    at: string
  }[]
}

// Admin > Rewards (docs/plans/rewards.md, RW-13): every real business's
// rules, the rewards customers earned and the whole history. Read only.
export async function getAdminRewards(): Promise<AdminRewards> {
  await requireAdmin()
  const [shops, earned, history] = await Promise.all([
    db
      .selectDistinct({
        id: businesses.id,
        name: businesses.name,
        currency: businesses.currency,
      })
      .from(rewardRules)
      .innerJoin(businesses, eq(businesses.id, rewardRules.businessId))
      .where(realBusiness)
      .orderBy(businesses.name)
      .limit(MAX_ROWS),
    db
      .select({
        id: rewards.id,
        businessName: businesses.name,
        currency: businesses.currency,
        customerKey: rewards.customerKey,
        reward: rewards.reward,
        status: rewards.status,
        earnedAt: rewards.earnedAt,
        expiresAt: rewards.expiresAt,
      })
      .from(rewards)
      .innerJoin(businesses, eq(businesses.id, rewards.businessId))
      .where(realBusiness)
      .orderBy(desc(rewards.earnedAt))
      .limit(MAX_ROWS),
    db
      .select({
        id: rewardEvents.id,
        businessName: businesses.name,
        currency: businesses.currency,
        earnType: rewardRules.earnType,
        customerKey: rewardEvents.customerKey,
        type: rewardEvents.type,
        amount: rewardEvents.amount,
        actor: rewardEvents.actor,
        note: rewardEvents.note,
        at: rewardEvents.createdAt,
      })
      .from(rewardEvents)
      .innerJoin(businesses, eq(businesses.id, rewardEvents.businessId))
      .innerJoin(rewardRules, eq(rewardRules.id, rewardEvents.ruleId))
      .where(realBusiness)
      .orderBy(desc(rewardEvents.createdAt))
      .limit(MAX_ROWS),
  ])
  return {
    businesses: await Promise.all(
      shops.map(async (shop) => ({
        ...shop,
        rules: await rewardRulesFor(shop.id, { withEnded: true }),
      }))
    ),
    earned: earned.map(({ customerKey, ...row }) => ({
      ...row,
      customer: customerKeyLabel(customerKey),
    })),
    history: history.map(({ customerKey, earnType, ...row }) => ({
      ...row,
      spend: earnType === "spend",
      customer: customerKeyLabel(customerKey),
    })),
  }
}
