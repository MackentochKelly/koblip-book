import "server-only"

import { eq } from "drizzle-orm"
import type { BatchItem } from "drizzle-orm/batch"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import {
  type businesses,
  businessPolicies,
  businessPolicyPoints,
} from "@/lib/db/schema"
import { POLICY_KINDS } from "@/lib/policy-rules"
import type { DraftPolicies } from "../utils/check-policies"
import { draftPolicies } from "./draft-policies"

// The work behind the setup screen's policies step and the policies:fill
// script, with no session check: callers check who may run it.

type Business = typeof businesses.$inferSelect

// Which of a business's policy parts already exist. Muse fills only the
// missing ones, so an owner's own texts and points are never replaced.
export interface PolicyParts {
  texts: boolean
  points: boolean
}

export async function policyParts(businessId: string): Promise<PolicyParts> {
  const [[text], [point]] = await Promise.all([
    db
      .select({ id: businessPolicies.id })
      .from(businessPolicies)
      .where(eq(businessPolicies.businessId, businessId))
      .limit(1),
    db
      .select({ id: businessPolicyPoints.id })
      .from(businessPolicyPoints)
      .where(eq(businessPolicyPoints.businessId, businessId))
      .limit(1),
  ])
  return { texts: Boolean(text), points: Boolean(point) }
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

// Saves the parts the business does not have yet, in one batch.
export async function writeMissingPolicies(
  business: Business,
  policies: DraftPolicies,
  existing: PolicyParts
): Promise<void> {
  const writes: BatchItem<"sqlite">[] = []
  if (!existing.texts) {
    writes.push(
      db.insert(businessPolicies).values(
        POLICY_KINDS.map((kind) => ({
          businessId: business.id,
          kind,
          body: policies.texts[kind],
        }))
      )
    )
  }
  if (!existing.points) {
    writes.push(
      db.insert(businessPolicyPoints).values(
        policies.points.map((point, position) => ({
          businessId: business.id,
          ...point,
          position,
        }))
      )
    )
  }
  await saveAll(writes)
}
