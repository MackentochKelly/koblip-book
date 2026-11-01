import "server-only"

import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  type businesses,
  businessPolicies,
  businessPolicyPoints,
  services,
  teamMembers,
  translations,
} from "@/lib/db/schema"
import {
  collectTranslatableTexts,
  pendingTranslations,
  translateTexts,
} from "../utils/translate"

// Brings a business's Spanish texts up to date (only new or changed ones
// go to Meta AI) and drops those of deleted items. No session check: the
// Translate action checks the owner, and the starter-catalog refill script
// runs it on the server.
export async function translateBusinessTexts(
  business: Pick<typeof businesses.$inferSelect, "id" | "description">
): Promise<{ ok: true; translated: number } | { ok: false; error: "failed" }> {
  const [serviceRows, addonGroupRows, addonOptionRows, teamRows, policyRows, pointRows] =
    await Promise.all([
    db
      .select({
        id: services.id,
        name: services.name,
        description: services.description,
      })
      .from(services)
      .where(eq(services.businessId, business.id)),
    db
      .select({ id: addonGroups.id, prompt: addonGroups.prompt })
      .from(addonGroups)
      .where(eq(addonGroups.businessId, business.id)),
    db
      .select({
        id: addonOptions.id,
        name: addonOptions.name,
        description: addonOptions.description,
      })
      .from(addonOptions)
      .where(eq(addonOptions.businessId, business.id)),
    db
      .select({
        id: teamMembers.id,
        description: teamMembers.description,
        about: teamMembers.about,
      })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id)),
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
      .where(eq(businessPolicyPoints.businessId, business.id)),
  ])
  const existing = await db
    .select()
    .from(translations)
    .where(
      and(
        eq(translations.businessId, business.id),
        eq(translations.language, "es")
      )
    )
  const all = collectTranslatableTexts(
    business.id,
    business.description,
    serviceRows,
    { groups: addonGroupRows, options: addonOptionRows },
    teamRows,
    policyRows,
    pointRows
  )
  const pending = pendingTranslations(all, existing)

  // Rows whose business, service, add-on group, add-on option, team
  // member, policy or policy point no longer exists.
  const liveIds = new Set([
    business.id,
    ...serviceRows.map((service) => service.id),
    ...addonGroupRows.map((group) => group.id),
    ...addonOptionRows.map((option) => option.id),
    ...teamRows.map((member) => member.id),
    ...policyRows.map((policy) => policy.id),
    ...pointRows.map((point) => point.id),
  ])
  const orphanIds = existing
    .filter((row) => !liveIds.has(row.entityId))
    .map((row) => row.id)
  if (orphanIds.length > 0) {
    await db.delete(translations).where(inArray(translations.id, orphanIds))
  }

  let translated = 0
  if (pending.length > 0) {
    const got = await translateTexts(
      pending.map((item) => ({ id: item.id, text: item.text }))
    )
    if (got.size === 0) {
      return { ok: false, error: "failed" }
    }
    const now = new Date().toISOString()
    const rows = pending.flatMap((item) => {
      const text = got.get(item.id)
      return text === undefined
        ? []
        : [
            {
              businessId: business.id,
              entityId: item.entityId,
              field: item.field,
              language: "es",
              sourceText: item.text,
              text,
            },
          ]
    })
    if (rows.length === 0) {
      return { ok: false, error: "failed" }
    }
    await db
      .insert(translations)
      .values(rows)
      .onConflictDoUpdate({
        target: [
          translations.entityId,
          translations.field,
          translations.language,
        ],
        set: {
          sourceText: sql`excluded.source_text`,
          text: sql`excluded.text`,
          updatedAt: now,
        },
      })
    translated = rows.length
  }
  return { ok: true, translated }
}
