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
  const [serviceRows, addonGroupRows, addonOptionRows] = await Promise.all([
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
    { groups: addonGroupRows, options: addonOptionRows }
  )
  const pending = pendingTranslations(all, existing)
  return {
    language: "es",
    enabled: isMetaAiEnabled(),
    total: all.length,
    upToDate: all.length - pending.length,
  }
}
