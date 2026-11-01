"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAccount } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import type { StarterResult } from "../types"
import { drawMemberPhoto } from "./fill-catalog"
import { catalogJob, policiesJob } from "./prepare-jobs"

// The signed-in owner's own real business (never a demo copy), or null.
// The id comes from the browser, so ownership is checked here.
async function ownedBusiness(businessId: unknown) {
  if (typeof businessId !== "string" || !businessId) {
    return null
  }
  const session = await requireAccount()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId || business.isDemo) {
    return null
  }
  return { business, userId: session.userId }
}

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
  if (!owned) {
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
// a second call costs nothing.
export async function drawTeamPhoto(
  businessId: string,
  memberId: string
): Promise<{ ok: true; photoUrl: string } | { ok: false }> {
  const owned = await ownedBusiness(businessId)
  if (!owned || typeof memberId !== "string") {
    return { ok: false }
  }
  const photoUrl = await drawMemberPhoto(owned.business, memberId, owned.userId)
  if (!photoUrl) {
    return { ok: false }
  }
  revalidatePath("/b/" + owned.business.slug)
  return { ok: true, photoUrl }
}
