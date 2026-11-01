"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessPolicies } from "@/lib/db/schema"
import { isPolicyKind, POLICY_RULES } from "@/lib/policy-rules"
import type { ActionResult } from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

// Saves one of the owner's policies. Empty text removes it, which hides it
// from the page. Its Spanish follows on the next translation.
export async function savePolicy(
  businessId: string,
  kind: unknown,
  body: unknown
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!isPolicyKind(kind) || typeof body !== "string") {
    return { ok: false, error: "invalid" }
  }
  const text = body.trim()
  if (text.length > POLICY_RULES.maxLength) {
    return { ok: false, error: "invalid" }
  }
  const { business } = owned
  if (text === "") {
    await db
      .delete(businessPolicies)
      .where(
        and(
          eq(businessPolicies.businessId, business.id),
          eq(businessPolicies.kind, kind)
        )
      )
  } else {
    await db
      .insert(businessPolicies)
      .values({ businessId: business.id, kind, body: text })
      .onConflictDoUpdate({
        target: [businessPolicies.businessId, businessPolicies.kind],
        set: { body: text, updatedAt: new Date().toISOString() },
      })
  }
  revalidateBusiness(business.slug)
  return { ok: true }
}
