"use server"

import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { requireAccount } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import type { StarterResult } from "../types"
import {
  catalogSummary,
  draftFor,
  drawMemberPhoto,
  hasCatalog,
  writeCatalog,
} from "./fill-catalog"
import { draftPoliciesFor, hasPolicies, writePolicies } from "./fill-policies"

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
export async function startStarterCatalog(
  businessId: string
): Promise<StarterResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const { business } = owned
  if (await hasCatalog(business.id)) {
    return { ok: true, summary: await catalogSummary(business, null, false) }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const catalog = await draftFor(business)
  if (!catalog) {
    return { ok: false, error: "failed" }
  }
  // The owner may have added something while Meta AI was writing.
  if (await hasCatalog(business.id)) {
    return { ok: true, summary: await catalogSummary(business, null, false) }
  }
  await writeCatalog(business, catalog)
  revalidatePath("/b/" + business.slug)
  return {
    ok: true,
    summary: await catalogSummary(business, catalog.team.role, true),
  }
}

// Right after sign-up: Muse writes the business's booking policy, terms
// and privacy notice for its kind of business. A business that already has
// policies is never changed. True when it has them now.
export async function startPolicies(
  businessId: string
): Promise<{ ok: boolean }> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false }
  }
  const { business } = owned
  if (await hasPolicies(business.id)) {
    return { ok: true }
  }
  const policies = await draftPoliciesFor(business)
  // The owner may have saved some while Muse was writing.
  if (!policies || (await hasPolicies(business.id))) {
    return { ok: Boolean(policies) }
  }
  await writePolicies(business, policies)
  revalidatePath("/b/" + business.slug)
  return { ok: true }
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
