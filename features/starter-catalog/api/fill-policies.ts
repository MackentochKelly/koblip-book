import "server-only"

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { type businesses, businessPolicies } from "@/lib/db/schema"
import { POLICY_KINDS } from "@/lib/policy-rules"
import type { DraftPolicies } from "../utils/check-policies"
import { draftPolicies } from "./draft-policies"

// The work behind the setup screen's policies step and the policies:fill
// script, with no session check: callers check who may run it.

type Business = typeof businesses.$inferSelect

export async function hasPolicies(businessId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: businessPolicies.id })
    .from(businessPolicies)
    .where(eq(businessPolicies.businessId, businessId))
    .limit(1)
  return Boolean(row)
}

// Muse Spark's checked policies for this business, or null.
export function draftPoliciesFor(business: Business): Promise<DraftPolicies | null> {
  return draftPolicies({
    name: business.name,
    category: business.category,
    address: business.address,
    phone: business.phone,
  })
}

// Saves the three policies in one insert.
export async function writePolicies(
  business: Business,
  policies: DraftPolicies
): Promise<void> {
  await db.insert(businessPolicies).values(
    POLICY_KINDS.map((kind) => ({
      businessId: business.id,
      kind,
      body: policies[kind],
    }))
  )
}
