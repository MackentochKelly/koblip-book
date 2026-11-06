"use server"

import { and, count, eq, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessPolicies, businessPolicyPoints } from "@/lib/db/schema"
import {
  isPolicyKind,
  isPolicyPointIcon,
  POLICY_RULES,
} from "@/lib/policy-rules"
import type { ActionResult, OwnPolicyInput, PolicyPointInput } from "../types"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { translateBusinessSoon } from "@/lib/translations/business-texts"
import { ownedBusiness } from "./owned-business"

// A policy's text: required, up to POLICY_RULES.maxLength; null when not.
function policyText(body: unknown): string | null {
  const text = typeof body === "string" ? body.trim() : ""
  return text !== "" && text.length <= POLICY_RULES.maxLength ? text : null
}

// How many policies the business has, standard and own together.
async function policyCount(businessId: string): Promise<number> {
  const [row] = await db
    .select({ total: count() })
    .from(businessPolicies)
    .where(eq(businessPolicies.businessId, businessId))
  return row?.total ?? 0
}

// Writes one of the standard policies (booking, terms, privacy): adds it to
// the page when the business has none of that kind yet, up to
// POLICY_RULES.maxPolicies, or replaces its text. Its Spanish follows on
// the next translation.
export async function savePolicy(
  businessId: string,
  kind: unknown,
  body: unknown
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const text = policyText(body)
  if (!isPolicyKind(kind) || text === null) {
    return { ok: false, error: "invalid" }
  }
  const { business } = owned
  const [current] = await db
    .select({ id: businessPolicies.id })
    .from(businessPolicies)
    .where(
      and(
        eq(businessPolicies.businessId, business.id),
        eq(businessPolicies.kind, kind)
      )
    )
    .limit(1)
  if (!current && (await policyCount(business.id)) >= POLICY_RULES.maxPolicies) {
    return { ok: false, error: "limit" }
  }
  await db
    .insert(businessPolicies)
    .values({ businessId: business.id, kind, body: text })
    .onConflictDoUpdate({
      target: [businessPolicies.businessId, businessPolicies.kind],
      set: { body: text, updatedAt: new Date().toISOString() },
    })
  revalidateBusiness(business.slug)
  translateBusinessSoon(business.id)
  return { ok: true }
}

// Adds one of the owner's own policies (policyId null), up to
// POLICY_RULES.maxPolicies, or changes one: its title and its text. Its
// Spanish follows on the next translation.
export async function saveOwnPolicy(
  businessId: string,
  policyId: string | null,
  input: OwnPolicyInput
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const title = typeof input?.title === "string" ? input.title.trim() : ""
  const text = policyText(input?.body)
  if (
    (policyId !== null && typeof policyId !== "string") ||
    title === "" ||
    title.length > POLICY_RULES.maxTitle ||
    text === null
  ) {
    return { ok: false, error: "invalid" }
  }
  const { business } = owned
  if (policyId === null) {
    if ((await policyCount(business.id)) >= POLICY_RULES.maxPolicies) {
      return { ok: false, error: "limit" }
    }
    await db
      .insert(businessPolicies)
      .values({ businessId: business.id, kind: null, title, body: text })
  } else {
    // Only the business's own policies, never a standard one by its id.
    const changed = await db
      .update(businessPolicies)
      .set({ title, body: text })
      .where(
        and(
          eq(businessPolicies.businessId, business.id),
          eq(businessPolicies.id, policyId),
          isNull(businessPolicies.kind)
        )
      )
      .returning({ id: businessPolicies.id })
    if (changed.length === 0) {
      return { ok: false, error: "not_found" }
    }
  }
  revalidateBusiness(business.slug)
  translateBusinessSoon(business.id)
  return { ok: true }
}

// Takes one policy off the page for good, standard or own. Its Spanish goes
// with it on the next translation (orphan rows).
export async function removePolicy(
  businessId: string,
  policyId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (typeof policyId !== "string") {
    return { ok: false, error: "invalid" }
  }
  const removed = await db
    .delete(businessPolicies)
    .where(
      and(
        eq(businessPolicies.businessId, owned.business.id),
        eq(businessPolicies.id, policyId)
      )
    )
    .returning({ id: businessPolicies.id })
  if (removed.length === 0) {
    return { ok: false, error: "not_found" }
  }
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
  return { ok: true }
}

// Adds a key point (pointId null, at the end) or changes one. Up to
// POLICY_RULES.maxPoints; its Spanish follows on the next translation.
export async function savePolicyPoint(
  businessId: string,
  pointId: string | null,
  input: PolicyPointInput
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  const title = typeof input?.title === "string" ? input.title.trim() : ""
  const body = typeof input?.body === "string" ? input.body.trim() : ""
  if (
    !isPolicyPointIcon(input?.icon) ||
    title === "" ||
    title.length > POLICY_RULES.maxPointTitle ||
    body === "" ||
    body.length > POLICY_RULES.maxPointBody
  ) {
    return { ok: false, error: "invalid" }
  }
  const { business } = owned
  const points = await db
    .select({ id: businessPolicyPoints.id, position: businessPolicyPoints.position })
    .from(businessPolicyPoints)
    .where(eq(businessPolicyPoints.businessId, business.id))
  if (pointId === null) {
    if (points.length >= POLICY_RULES.maxPoints) {
      return { ok: false, error: "limit" }
    }
    await db.insert(businessPolicyPoints).values({
      businessId: business.id,
      icon: input.icon,
      title,
      body,
      position: Math.max(-1, ...points.map((point) => point.position)) + 1,
    })
  } else {
    if (!points.some((point) => point.id === pointId)) {
      return { ok: false, error: "not_found" }
    }
    await db
      .update(businessPolicyPoints)
      .set({ icon: input.icon, title, body })
      .where(eq(businessPolicyPoints.id, pointId))
  }
  revalidateBusiness(business.slug)
  translateBusinessSoon(business.id)
  return { ok: true }
}

// Removes one key point for good.
export async function removePolicyPoint(
  businessId: string,
  pointId: string
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  await db
    .delete(businessPolicyPoints)
    .where(
      and(
        eq(businessPolicyPoints.businessId, owned.business.id),
        eq(businessPolicyPoints.id, pointId)
      )
    )
  revalidateBusiness(owned.business.slug)
  translateBusinessSoon(owned.business.id)
  return { ok: true }
}
