"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/dal"
import { PlanFeatureError, setFeaturePlan } from "@/lib/plan-access"
import { isPlan, isPlanFeature } from "@/lib/plan-features"

export type PlanActionResult =
  { ok: true } | { ok: false; error: "invalid" | "failed" }

// Admin → Plans: sets the lowest plan that has a feature.
// lib/plan-access.ts saves it and logs the change.
export async function saveFeaturePlan(
  key: string,
  plan: string
): Promise<PlanActionResult> {
  const session = await requireAdmin()
  if (!isPlanFeature(key) || !isPlan(plan)) return { ok: false, error: "invalid" }
  try {
    await setFeaturePlan({ key, plan, userId: session.userId })
  } catch (error) {
    if (error instanceof PlanFeatureError) return { ok: false, error: "invalid" }
    console.error(error)
    return { ok: false, error: "failed" }
  }
  revalidatePath("/admin/plans")
  return { ok: true }
}
