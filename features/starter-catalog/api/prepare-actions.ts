"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import type { StarterResult } from "../types"
import { ownedBusiness } from "./owned-business"
import { catalogJob, photoJob, policiesJob } from "./prepare-jobs"

// Right after sign-up: Meta AI writes the business's services, extras,
// prices and team from its Google details, and they go live at once. A
// business that already has services or team is never changed.
// The job usually started on the Google details screen, so this mostly
// waits for work already under way (./prepare-jobs).
export async function startStarterCatalog(
  businessId: string
): Promise<StarterResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const result = await catalogJob(owned.business)
  if (result.ok && result.summary.created) {
    revalidatePath("/b/" + owned.business.slug)
  }
  return result
}

// Right after sign-up: Muse writes the business's booking policy, terms,
// privacy notice and their key points for its kind of business. Parts the
// business already has are never changed. True when it has them all now.
export async function startPolicies(
  businessId: string
): Promise<{ ok: boolean }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || owned.business.setupFinishedAt !== null) {
    return { ok: false }
  }
  const result = await policiesJob(owned.business)
  if (result.ok) {
    revalidatePath("/b/" + owned.business.slug)
  }
  return result
}

// Muse Image draws one team member's photo. Only for a member of the
// owner's business who has no photo yet, so a photo is never replaced and
// a second call costs nothing. Usually already drawing since the team was
// written (./prepare-jobs), so the photos come side by side.
export async function drawTeamPhoto(
  businessId: string,
  memberId: string
): Promise<{ ok: true; photoUrl: string } | { ok: false }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || owned.business.setupFinishedAt !== null || typeof memberId !== "string") {
    return { ok: false }
  }
  const result = await photoJob(owned.business, memberId)
  if (result.ok) {
    revalidatePath("/b/" + owned.business.slug)
  }
  return result
}

// Setup is finished even when AI is off or fails: the page works without
// it. Only the current owner may finish it, never a demo or another owner.
export async function finishSetup(businessId: string): Promise<{ ok: boolean }> {
  const owned = await ownedBusiness(businessId)
  if (!owned) return { ok: false }
  if (owned.business.setupFinishedAt !== null) return { ok: true }
  const saved = await db
    .update(businesses)
    .set({ setupFinishedAt: Date.now() })
    .where(and(
      eq(businesses.id, businessId),
      eq(businesses.ownerId, owned.userId),
      eq(businesses.isDemo, false),
      isNull(businesses.setupFinishedAt)
    ))
    .returning({ id: businesses.id })
  return { ok: saved.length > 0 }
}
