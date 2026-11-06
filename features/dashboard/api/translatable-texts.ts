import "server-only"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  type businesses,
  businessPolicies,
  businessPolicyPoints,
  serviceCategories,
  services,
  teamMembers,
  translations,
} from "@/lib/db/schema"
import { collectTranslatableTexts, pendingTranslations } from "../utils/translate"

// The same saved texts for the Spanish count and Translate. Read-only;
// callers check ownership, and only the Translate run removes orphan rows.
export async function loadTranslatableTexts(
  business: Pick<typeof businesses.$inferSelect, "id" | "description" | "category">
) {
  const [
    serviceRows,
    addonGroupRows,
    addonOptionRows,
    teamRows,
    policyRows,
    pointRows,
    categoryRows,
  ] = await Promise.all([
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
    db
      .select({ id: serviceCategories.id, name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.businessId, business.id)),
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
    business.category,
    serviceRows,
    { groups: addonGroupRows, options: addonOptionRows },
    teamRows,
    policyRows,
    pointRows,
    categoryRows
  )
  const pending = pendingTranslations(all, existing)

  // Rows whose business, service, service category, add-on group, add-on
  // option, team member, policy or policy point no longer exists.
  const liveIds = new Set([
    business.id,
    ...serviceRows.map((service) => service.id),
    ...categoryRows.map((category) => category.id),
    ...addonGroupRows.map((group) => group.id),
    ...addonOptionRows.map((option) => option.id),
    ...teamRows.map((member) => member.id),
    ...policyRows.map((policy) => policy.id),
    ...pointRows.map((point) => point.id),
  ])
  return { all, pending, existing, liveIds }
}
