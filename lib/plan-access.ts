import "server-only"
import { eq } from "drizzle-orm"

import { db } from "@/lib/db"
import { planFeatureChanges, planFeatures } from "@/lib/db/schema"
import { saveAll } from "@/lib/db/save-all"
import {
  isPlan,
  isPlanFeature,
  PLAN_FEATURES,
  type Plan,
  type PlanFeatureKey,
} from "@/lib/plan-features"

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
