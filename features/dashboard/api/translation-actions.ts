"use server"

import { isMetaAiEnabled } from "@/lib/meta-ai"
import type { ActionResult } from "../types"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { ownedBusiness } from "./owned-business"
import { translateBusinessTexts } from "./translate-business"

export async function translateBusiness(
  businessId: string
): Promise<ActionResult<{ translated: number }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const result = await translateBusinessTexts(owned.business)
  if (!result.ok) {
    return result
  }
  revalidateBusiness(owned.business.slug)
  return result
}
