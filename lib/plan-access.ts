import "server-only"
import { cache } from "react"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "@/lib/db"
import { businesses, planFeatures, subscription } from "@/lib/db/schema"
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

// Which plan has which feature (docs/plans/subscriptions.md, S9): the
// defaults in lib/plan-features.ts with the admin's choices over them. Only
// the admin area changes them (its action checks who is asking).

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

// Sets a feature's lowest plan, or goes back to its default with null.
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
  if (after === null) {
    await db.delete(planFeatures).where(where)
    return
  }
  await db
    .insert(planFeatures)
    .values({ featureKey: key, plan: after, updatedBy: userId })
    .onConflictDoUpdate({
      target: planFeatures.featureKey,
      set: { plan: after, updatedBy: userId },
    })
}

// The Stripe statuses that count as paid (S6), as the Stripe plugin counts
// them. Any other (past_due while Stripe retries, canceled, unpaid…) is Free.
const PAID_STATUSES = ["active", "trialing"]

// The plan a business is on: the highest one its paid subscriptions give,
// else the first (Free). A business that never paid is on Free. A plan name
// the app no longer knows is ignored.
export async function businessPlan(businessId: string): Promise<Plan> {
  const rows = await db
    .select({ plan: subscription.plan })
    .from(subscription)
    .where(
      and(eq(subscription.referenceId, businessId), inArray(subscription.status, PAID_STATUSES))
    )
  let best: Plan = PLANS[0]
  for (const { plan } of rows) if (isPlan(plan) && planIncludes(plan, best)) best = plan
  return best
}

// Who may pay for, change, cancel or see a business's plan (S2): its owner,
// for a real business (a demo copy is never billed). Used by the Stripe
// plugin's authorizeReference in lib/auth.ts.
export async function canBillBusiness(userId: string, businessId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        eq(businesses.id, businessId),
        eq(businesses.ownerId, userId),
        eq(businesses.isDemo, false)
      )
    )
    .limit(1)
  return Boolean(row)
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

// The features this business's plan lacks, each with the lowest plan that
// has it: for plan badges on menus and tabs.
export async function lockedPlans(
  businessId: string
): Promise<Partial<Record<PlanFeatureKey, Plan>>> {
  const [features, plans] = await Promise.all([businessFeatures(businessId), featurePlans()])
  return Object.fromEntries(
    (Object.keys(features) as PlanFeatureKey[])
      .filter((key) => !features[key])
      .map((key) => [key, plans[key]])
  )
}
