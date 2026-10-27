"use server"

import { and, eq, inArray, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  services,
  translations,
} from "@/lib/db/schema"
import { isMetaAiEnabled } from "@/lib/meta-ai"
import type { ActionResult } from "../types"
import {
  collectTranslatableTexts,
  pendingTranslations,
  translateTexts,
} from "../utils/translate"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

export async function translateBusiness(
  businessId: string
): Promise<ActionResult<{ translated: number }>> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (!isMetaAiEnabled()) {
    return { ok: false, error: "ai_off" }
  }
  const business = owned.business
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
    { groups: addonGroupRows, options: addonOptionRows }
  )
  const pending = pendingTranslations(all, existing)

  // Rows whose business, service, add-on group or add-on option no longer
  // exists.
  const liveIds = new Set([
    business.id,
    ...serviceRows.map((service) => service.id),
    ...addonGroupRows.map((group) => group.id),
    ...addonOptionRows.map((option) => option.id),
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
  revalidateBusiness(business.slug)
  return { ok: true, translated }
}
