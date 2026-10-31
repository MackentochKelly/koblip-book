import "server-only"
import { and, eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  businesses,
  services,
  teamMembers,
  translations,
} from "@/lib/db/schema"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import type { TranslationStatus } from "../translation-types"
import {
  collectTranslatableTexts,
  pendingTranslations,
} from "../utils/translate"

async function ownedBusiness(businessId: string) {
  const session = await requireOwner()
  const [business] = await db
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId) {
    notFound()
  }
  return business
}

export async function getTranslationStatus(
  businessId: string
): Promise<TranslationStatus> {
  const business = await ownedBusiness(businessId)
  const [serviceRows, addonGroupRows, addonOptionRows, teamRows] =
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
      .select({ id: teamMembers.id, description: teamMembers.description })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, business.id)),
  ])
  const existing = await db
    .select({
      entityId: translations.entityId,
      field: translations.field,
      sourceText: translations.sourceText,
    })
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
    teamRows
  )
  const pending = pendingTranslations(all, existing)
  return {
    language: "es",
    enabled: isMetaAiEnabled(),
    total: all.length,
    upToDate: all.length - pending.length,
  }
}

// The saved Spanish service names, with the English name each was made
// from: the assistant also knows a service by its Spanish name ("corte
// clásico" for "Classic Haircut") while it is still up to date.
export async function getServiceNameTranslations(
  businessId: string
): Promise<{ serviceId: string; sourceText: string; text: string }[]> {
  const business = await ownedBusiness(businessId)
  return db
    .select({
      serviceId: translations.entityId,
      sourceText: translations.sourceText,
      text: translations.text,
    })
    .from(translations)
    .where(
      and(
        eq(translations.businessId, business.id),
        eq(translations.language, "es"),
        eq(translations.field, "service.name")
      )
    )
}
