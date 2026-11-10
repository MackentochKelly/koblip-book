"use server"

import { and, eq } from "drizzle-orm"

import { getCustomer } from "@/lib/customer-dal"
import { customerKey } from "@/lib/customer-key"
import { db } from "@/lib/db"
import { businesses, rewardRules } from "@/lib/db/schema"
import { hasFeature } from "@/lib/plan-access"
import type { HeldReward } from "@/lib/reward-rules"
import { availableRewards } from "@/lib/rewards"

// What the booking screens know about rewards for the person booking
// (docs/plans/rewards.md, RW7). Rewards are found only by the phone a
// sign-in code proved, never by a phone typed in the form: nobody can read
// or spend someone else's.
export type MyRewards =
  // The business runs no reward: the booking shows nothing about them.
  | { state: "none" }
  // It does, and nobody is signed in.
  | { state: "signedOut" }
  // Signed in without a proved phone (Google or email): add one first.
  | { state: "noPhone" }
  | { state: "mine"; rewards: HeldReward[] }

export async function myRewardsHere(slug: string): Promise<MyRewards> {
  if (typeof slug !== "string") return { state: "none" }
  try {
    const [business] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.slug, slug))
      .limit(1)
    if (!business || !(await hasFeature(business.id, "rewards"))) {
      return { state: "none" }
    }
    const customer = await getCustomer()
    const mine =
      customer?.phone != null
        ? await availableRewards(business.id, customerKey(customer.phone, ""))
        : []
    // Rewards already earned stay usable after a rule is turned off.
    if (mine.length > 0) return { state: "mine", rewards: mine }
    const [active] = await db
      .select({ id: rewardRules.id })
      .from(rewardRules)
      .where(
        and(
          eq(rewardRules.businessId, business.id),
          eq(rewardRules.status, "active")
        )
      )
      .limit(1)
    if (!active) return { state: "none" }
    if (!customer) return { state: "signedOut" }
    return customer.phone
      ? { state: "mine", rewards: [] }
      : { state: "noPhone" }
  } catch {
    console.error("myRewardsHere failed")
    return { state: "none" }
  }
}
