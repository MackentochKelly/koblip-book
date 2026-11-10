"use server"

import { asc, eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  businesses,
  businessPolicies,
  businessPolicyPoints,
} from "@/lib/db/schema"
import { policyPaymentFor } from "@/lib/payment-methods"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { translateBusinessSoon } from "@/lib/translations/business-texts"
import { ownedBusiness } from "./owned-business"
import { rewritePolicies } from "./rewrite-policies"

// Settings → Payments, "Update": the owner changed how customers can pay,
// and asks Muse to bring what their policies and key points say about
// paying up to date. Only those sentences change; every changed text is
// saved together with what the policies now stand for, and its
// translations follow. Never runs by itself, and never for a demo.
export async function updatePoliciesForPayments(
  businessId: string
): Promise<{ ok: true; changed: number } | { ok: false }> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false }
  }
  const { business } = owned
  const [payment, policies, points] = await Promise.all([
    policyPaymentFor(business),
    db
      .select({ id: businessPolicies.id, body: businessPolicies.body })
      .from(businessPolicies)
      .where(eq(businessPolicies.businessId, business.id)),
    db
      .select({
        id: businessPolicyPoints.id,
        title: businessPolicyPoints.title,
        body: businessPolicyPoints.body,
      })
      .from(businessPolicyPoints)
      .where(eq(businessPolicyPoints.businessId, business.id))
      .orderBy(asc(businessPolicyPoints.position)),
  ])
  const rewrite =
    policies.length + points.length > 0
      ? await rewritePolicies({ policies, points }, payment)
      : { policies: [], points: [] }
  if (!rewrite) {
    return { ok: false }
  }
  const now = new Date().toISOString()
  const writes: BatchItem<"sqlite">[] = [
    db
      .update(businesses)
      .set({ policiesPayment: payment })
      .where(eq(businesses.id, business.id)),
    ...rewrite.policies.map((policy) =>
      db
        .update(businessPolicies)
        .set({ body: policy.body, updatedAt: now })
        .where(eq(businessPolicies.id, policy.id))
    ),
    ...rewrite.points.map((point) =>
      db
        .update(businessPolicyPoints)
        .set({ title: point.title, body: point.body, updatedAt: now })
        .where(eq(businessPolicyPoints.id, point.id))
    ),
  ]
  await saveAll(writes)
  const changed = rewrite.policies.length + rewrite.points.length
  if (changed > 0) {
    revalidateBusiness(business.slug)
    translateBusinessSoon(business.id)
  }
  return { ok: true, changed }
}
