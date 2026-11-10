import "server-only"
import { and, eq, inArray } from "drizzle-orm"

import type { CustomerSession } from "@/lib/customer-dal"
import { customerKey } from "@/lib/customer-key"
import { db } from "@/lib/db"
import { bookings, businesses, rewardEvents } from "@/lib/db/schema"
import { hasFeature } from "@/lib/plan-access"
import { progressShown } from "@/lib/reward-rules"
import { customerRewards } from "@/lib/rewards"
import type { MyRewardsPlace } from "../types"
import { firstPhotos } from "./my-bookings"

// The client's rewards at every business they book with
// (docs/plans/rewards.md, RW-7): what is ready to redeem and how far they
// are on each rule. Rewards belong to a phone, so only an account whose
// phone was proved by a sign-in code sees any (RW2).
export async function myRewards(
  customer: CustomerSession,
  locale: string,
  now: Date = new Date()
): Promise<MyRewardsPlace[]> {
  if (!customer.phone) return []
  const key = customerKey(customer.phone, "")
  // Where they booked, and where the owner gave them something by hand.
  const [booked, given] = await Promise.all([
    db
      .selectDistinct({ id: bookings.businessId })
      .from(bookings)
      .where(eq(bookings.customerKey, key)),
    db
      .selectDistinct({ id: rewardEvents.businessId })
      .from(rewardEvents)
      .where(eq(rewardEvents.customerKey, key)),
  ])
  const ids = [...new Set([...booked, ...given].map((row) => row.id))]
  if (!ids.length) return []
  const shops = await db
    .select({
      id: businesses.id,
      slug: businesses.slug,
      name: businesses.name,
      address: businesses.address,
      timezone: businesses.timezone,
      currency: businesses.currency,
    })
    .from(businesses)
    .where(and(inArray(businesses.id, ids), eq(businesses.isDemo, false)))
    .orderBy(businesses.name)
  const photos = await firstPhotos(shops.map((shop) => shop.id))
  const nowIso = now.toISOString()

  const places = await Promise.all(
    shops.map(async (shop): Promise<MyRewardsPlace | null> => {
      if (!(await hasFeature(shop.id, "rewards"))) return null
      const mine = await customerRewards(shop.id, key)
      const rewards = mine.rewards
        .filter(
          (reward) =>
            reward.status === "available" &&
            (reward.expiresAt === null || reward.expiresAt > nowIso)
        )
        .map((reward) => ({
          id: reward.id,
          reward: reward.reward,
          expires:
            reward.expiresAt === null
              ? null
              : new Intl.DateTimeFormat(locale, {
                  month: "short",
                  day: "numeric",
                  // The year only when it isn't this one.
                  year:
                    new Date(reward.expiresAt).getUTCFullYear() ===
                    now.getUTCFullYear()
                      ? undefined
                      : "numeric",
                  timeZone: shop.timezone,
                }).format(new Date(reward.expiresAt)),
        }))
      const progress = mine.progress
        .filter(
          ({ rule }) =>
            rule.status === "active" &&
            (rule.endsAt === null || rule.endsAt > nowIso)
        )
        .map(({ rule, balance }) => ({
          rule,
          done: progressShown(balance, rule.goal),
        }))
      if (!rewards.length && !progress.length) return null
      return {
        business: {
          slug: shop.slug,
          name: shop.name,
          photoUrl: photos.get(shop.id) ?? null,
          address: shop.address,
        },
        currency: shop.currency,
        rewards,
        progress,
      }
    })
  )
  // Places with something to redeem first.
  return places
    .filter((place) => place !== null)
    .sort((a, b) => Number(!a.rewards.length) - Number(!b.rewards.length))
}
