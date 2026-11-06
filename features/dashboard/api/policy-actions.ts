"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { businessPolicies, businessPolicyPoints } from "@/lib/db/schema"
import {
  isPolicyKind,
  isPolicyPointIcon,
  POLICY_RULES,
} from "@/lib/policy-rules"
import type { ActionResult, PolicyPointInput } from "../types"
import { revalidateBusiness } from "@/lib/revalidate-business"
import { ownedBusiness } from "./owned-business"

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
  return { ok: true }
}
