import "server-only"
import { asc, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { businessPolicies, businessPolicyPoints } from "@/lib/db/schema"
import { orderPolicies } from "@/lib/policy-rules"
import type { OwnerPolicies } from "../types"
import { ownedBusiness } from "./owned-business"

// The owner's policies on the page (the standard ones, then their own) and
// their key points, each in order.
export async function getPolicies(businessId: string): Promise<OwnerPolicies> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    notFound()
  }
  const [rows, points] = await Promise.all([
    db
      .select({
        id: businessPolicies.id,
        kind: businessPolicies.kind,
        title: businessPolicies.title,
        body: businessPolicies.body,
        createdAt: businessPolicies.createdAt,
      })
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
  const policies = orderPolicies(rows).map(({ id, kind, title, body }) => ({
    id,
    kind,
    title,
    body,
  }))
  return { policies, points }
}
