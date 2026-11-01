import "server-only"
import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { businessPolicies, businessPolicyPoints } from "@/lib/db/schema"
import { POLICY_KINDS, type PolicyKind } from "@/lib/policy-rules"
import type { OwnerPolicies } from "../types"
import { ownedBusiness } from "./owned-business"

// The owner's booking policy, terms and privacy notice ("" for one that is
// not written, hidden from the page) and their key points, in order.
export async function getPolicies(businessId: string): Promise<OwnerPolicies> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    notFound()
  }
  const [rows, points] = await Promise.all([
    db
      .select({ kind: businessPolicies.kind, body: businessPolicies.body })
      .from(businessPolicies)
      .where(eq(businessPolicies.businessId, owned.business.id)),
    db
      .select({
        id: businessPolicyPoints.id,
        icon: businessPolicyPoints.icon,
        title: businessPolicyPoints.title,
        body: businessPolicyPoints.body,
      })
      .from(businessPolicyPoints)
      .where(eq(businessPolicyPoints.businessId, owned.business.id))
      .orderBy(asc(businessPolicyPoints.position)),
  ])
  const byKind = new Map(rows.map((row) => [row.kind, row.body]))
  const texts = Object.fromEntries(
    POLICY_KINDS.map((kind) => [kind, byKind.get(kind) ?? ""])
  ) as Record<PolicyKind, string>
  return { texts, points }
}
