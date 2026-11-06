import "server-only"

import { requireAdmin } from "@/lib/dal"
import { featurePlans, type FeaturePlans } from "@/lib/plan-access"

// Admin → Plans (docs/plans/subscriptions.md, P0): each feature's plan.
export async function getPlans(): Promise<FeaturePlans> {
  await requireAdmin()
  return featurePlans()
}
