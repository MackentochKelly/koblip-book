import "server-only"
import { cache } from "react"
import { and, eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { businesses, planFeatureChanges, planFeatures } from "@/lib/db/schema"
import { saveAll } from "@/lib/db/save-all"
import {
  isPlan,
  isPlanFeature,
  PLAN_FEATURES,
  PLANS,
  planIncludes,
  planMovable,
  type Plan,
  type PlanFeatureKey,
} from "@/lib/plan-features"
import { SUBSCRIPTION_RULES } from "@/lib/subscription-rules"

// Which plan has which feature (docs/plans/subscriptions.md, S9): the
// defaults in lib/plan-features.ts with the admin's choices over them. Only
// the admin area changes them (its action checks who is asking); every
// change is logged.

export type FeaturePlans = Record<PlanFeatureKey, Plan>

// The lowest plan that has each feature.
export async function featurePlans(): Promise<FeaturePlans> {
  const plans = Object.fromEntries(
    Object.entries(PLAN_FEATURES).map(([key, feature]) => [key, feature.defaultPlan])
  ) as FeaturePlans
  for (const row of await db.select().from(planFeatures)) {
    // A feature since removed from the list, or a plan since removed, is
    // ignored rather than trusted.
    if (isPlanFeature(row.featureKey) && isPlan(row.plan)) plans[row.featureKey] = row.plan
  }
  return plans
}

export class PlanFeatureError extends Error {
  constructor(readonly key: string) {
    super(`Not a feature or plan: ${key}`)
  }
}

// Sets a feature's lowest plan, or goes back to its default with null, and
// logs the change, together.
export async function setFeaturePlan({
  key,
  plan,
  userId,
}: {
  key: PlanFeatureKey
  plan: Plan | null
  userId: string
}) {
  if (!isPlanFeature(key) || (plan !== null && !isPlan(plan))) {
    throw new PlanFeatureError(String(key))
  }
  // A built feature with no plan check yet stays on its default plan: a
  // choice for it would change nothing.
  if (!planMovable(key) && plan !== null && plan !== PLAN_FEATURES[key].defaultPlan) {
    throw new PlanFeatureError(key)
  }
  // Choosing the default is the same as having no row.
  const after = plan === PLAN_FEATURES[key].defaultPlan ? null : plan
  const where = eq(planFeatures.featureKey, key)
  const [row] = await db.select({ plan: planFeatures.plan }).from(planFeatures).where(where)
  const before = row?.plan ?? null
  if (before === after) return
  await saveAll([
    after === null
      ? db.delete(planFeatures).where(where)
      : db
          .insert(planFeatures)
          .values({ featureKey: key, plan: after, updatedBy: userId })
          .onConflictDoUpdate({
            target: planFeatures.featureKey,
            set: { plan: after, updatedBy: userId },
          }),
    db.insert(planFeatureChanges).values({ featureKey: key, before, after, changedBy: userId }),
  ])
}

// The plan a business is on. Until billing is live every business counts
// as on the top plan (SUBSCRIPTION_RULES.billingLive); then it comes from
// its subscription (P2).
export async function businessPlan(businessId: string): Promise<Plan> {
  if (!SUBSCRIPTION_RULES.billingLive) return PLANS[PLANS.length - 1]
  // P2 reads the business's active or trialing subscription here; with none
  // a business is on the first plan.
  void businessId
  return PLANS[0]
}

// Every feature this business has, read once per request.
export const businessFeatures = cache(
  async (businessId: string): Promise<Record<PlanFeatureKey, boolean>> => {
    const [plan, plans] = await Promise.all([businessPlan(businessId), featurePlans()])
    return Object.fromEntries(
      Object.entries(plans).map(([key, lowest]) => [key, planIncludes(plan, lowest)])
    ) as Record<PlanFeatureKey, boolean>
  }
)

export async function hasFeature(businessId: string, key: PlanFeatureKey): Promise<boolean> {
  return (await businessFeatures(businessId))[key]
}

// A feature the business's plan doesn't have, asked for anyway (the screen
// hides it, so only a stale page or a hand-made request gets here).
export class FeatureLockedError extends Error {
  constructor(readonly key: PlanFeatureKey) {
    super(`Not in this business's plan: ${key}`)
  }
}

// For server actions and routes: stops unless the business has the feature.
export async function requireFeature(businessId: string, key: PlanFeatureKey) {
  if (!(await hasFeature(businessId, key))) throw new FeatureLockedError(key)
}

// For an owner-wide feature (another business): any real business the
// owner has includes it. With no business yet, there is nothing to limit.
export async function ownerHasFeature(userId: string, key: PlanFeatureKey): Promise<boolean> {
  const owned = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.ownerId, userId), eq(businesses.isDemo, false)))
  if (owned.length === 0) return true
  for (const { id } of owned) if (await hasFeature(id, key)) return true
  return false
}
