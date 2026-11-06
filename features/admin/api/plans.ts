import "server-only"

import { desc, eq } from "drizzle-orm"
import { requireAdmin } from "@/lib/dal"
import { db } from "@/lib/db"
import { planFeatureChanges, user } from "@/lib/db/schema"
import { featurePlans, type FeaturePlans } from "@/lib/plan-access"
import type { Plan, PlanFeatureKey } from "@/lib/plan-features"

// The change log shows the latest this many.
const MAX_ROWS = 200

export interface PlanFeatureChange {
  id: number
  featureKey: PlanFeatureKey
  // Null is the feature's default.
  before: Plan | null
  after: Plan | null
  // Null once the admin's account is gone.
  changedBy: string | null
  changedAt: string
}

// Admin → Plans (docs/plans/subscriptions.md, P0): each feature's plan and
// every change to them, newest first.
export async function getPlans(): Promise<{
  plans: FeaturePlans
  changes: PlanFeatureChange[]
}> {
  await requireAdmin()
  const [plans, changes] = await Promise.all([
    featurePlans(),
    db
      .select({
        id: planFeatureChanges.id,
        featureKey: planFeatureChanges.featureKey,
        before: planFeatureChanges.before,
        after: planFeatureChanges.after,
        changedBy: user.name,
        changedAt: planFeatureChanges.changedAt,
      })
      .from(planFeatureChanges)
      .leftJoin(user, eq(user.id, planFeatureChanges.changedBy))
      .orderBy(desc(planFeatureChanges.id))
      .limit(MAX_ROWS),
  ])
  // A logged feature since removed from the list keeps its row in the
  // database but has no words to show.
  return {
    plans,
    changes: changes.filter((change): change is PlanFeatureChange =>
      Object.hasOwn(plans, change.featureKey)
    ),
  }
}
