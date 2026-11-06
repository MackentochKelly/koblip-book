"use server"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { hasFeature } from "@/lib/plan-access"
import { businesses } from "@/lib/db/schema"
import { isAvailableTheme } from "@/lib/theme-rules"
import type { ActionResult } from "../types"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { ownedBusiness } from "./owned-business"

// The owner turns on one of the built themes for their public page.
export async function activateTheme(
  businessId: string,
  theme: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!(await hasFeature(businessId, "pageThemes"))) {
    return { ok: false, error: "locked" }
  }
  if (!isAvailableTheme(theme)) {
    return { ok: false, error: "invalid" }
  }
  await db
    .update(businesses)
    .set({ theme })
    .where(eq(businesses.id, owned.business.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
