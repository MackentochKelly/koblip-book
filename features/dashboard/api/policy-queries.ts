import "server-only"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { businessPolicies } from "@/lib/db/schema"
import { POLICY_KINDS, type PolicyKind } from "@/lib/policy-rules"
import { ownedBusiness } from "./owned-business"

// The owner's booking policy, terms and privacy notice; "" for one that is
// not written (hidden from the page).
export async function getPolicies(
  businessId: string
): Promise<Record<PolicyKind, string>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    notFound()
  }
  const rows = await db
    .select({ kind: businessPolicies.kind, body: businessPolicies.body })
    .from(businessPolicies)
    .where(eq(businessPolicies.businessId, owned.business.id))
  const byKind = new Map(rows.map((row) => [row.kind, row.body]))
  return Object.fromEntries(
    POLICY_KINDS.map((kind) => [kind, byKind.get(kind) ?? ""])
  ) as Record<PolicyKind, string>
}
