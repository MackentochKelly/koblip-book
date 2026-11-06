import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { cache } from "react"
import { db } from "@/lib/db"
import {
  addonGroups,
  addonOptions,
  businesses,
  businessPolicies,
  businessPolicyPoints,
  serviceCategories,
  services,
  teamMembers,
  translationEntries,
} from "@/lib/db/schema"
import type { PageLanguage } from "@/lib/page-language"
import {
  isTranslationLanguage,
  TRANSLATION_LANGUAGES,
} from "./languages"
import {
  type QueueResult,
  runTranslationQueue,
  syncTexts,
  type SyncResult,
} from "./queue"
import { TRANSLATION_STATUSES, isShown } from "./rules"
import { translateSoon } from "./schedule"

// Each business's own texts on Google (docs/plans/translations.md, G3):
// every save that changes them records what changed, Google translates it
// in the background, and the page shows a translation only while it was
// made from the current English.

// The kinds of business text that are translated.
export type BusinessTextField =
  | "business.description"
  | "business.category"
  | "service.name"
  | "service.description"
  | "service_category.name"
  | "addon_group.prompt"
  | "addon.name"
  | "addon.description"
  | "team_member.description"
  | "team_member.about"
  | "policy.title"
  | "policy.body"
  | "policy_point.title"
  | "policy_point.body"

export interface BusinessText {
  entityId: string
  field: BusinessTextField
  // The current English.
  text: string
}

export interface BusinessTextRows {
  business: { id: string; description: string | null; category: string | null }
  services: { id: string; name: string; description: string | null }[]
  serviceCategories: { id: string; name: string }[]
  addonGroups: { id: string; prompt: string }[]
  addonOptions: { id: string; name: string; description: string | null }[]
  team: { id: string; description: string | null; about: string | null }[]
  // title: the owner's own policy's; a standard one's name is the app's.
  policies: { id: string; title: string | null; body: string }[]
  policyPoints: { id: string; title: string; body: string }[]
}

// The translation's key: one per text of one thing.
export function businessTextKey(entityId: string, field: BusinessTextField) {
  return `${entityId}:${field}`
}

// Every business text that has words, in page order.
export function collectBusinessTexts(rows: BusinessTextRows): BusinessText[] {
  const all: BusinessText[] = []
  const add = (entityId: string, field: BusinessTextField, text: string | null) => {
    if (text && text.trim() !== "") all.push({ entityId, field, text })
  }
  add(rows.business.id, "business.description", rows.business.description)
  add(rows.business.id, "business.category", rows.business.category)
  for (const service of rows.services) {
    add(service.id, "service.name", service.name)
    add(service.id, "service.description", service.description)
  }
  for (const category of rows.serviceCategories) {
    add(category.id, "service_category.name", category.name)
  }
  for (const group of rows.addonGroups) {
    add(group.id, "addon_group.prompt", group.prompt)
  }
  for (const option of rows.addonOptions) {
    add(option.id, "addon.name", option.name)
    add(option.id, "addon.description", option.description)
  }
  for (const member of rows.team) {
    add(member.id, "team_member.description", member.description)
    add(member.id, "team_member.about", member.about)
  }
  for (const policy of rows.policies) {
    add(policy.id, "policy.title", policy.title)
    add(policy.id, "policy.body", policy.body)
  }
  for (const point of rows.policyPoints) {
    add(point.id, "policy_point.title", point.title)
    add(point.id, "policy_point.body", point.body)
  }
  return all
}

async function loadBusinessTextRows(
  businessId: string
): Promise<(BusinessTextRows & { isDemo: boolean }) | null> {
  const [business] = await db
    .select({
      id: businesses.id,
      description: businesses.description,
      category: businesses.category,
      isDemo: businesses.isDemo,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId))
    .limit(1)
  if (!business) return null
  const [
    serviceRows,
    categoryRows,
    groupRows,
    optionRows,
    teamRows,
    policyRows,
    pointRows,
  ] = await Promise.all([
    db
      .select({ id: services.id, name: services.name, description: services.description })
      .from(services)
      .where(eq(services.businessId, businessId)),
    db
      .select({ id: serviceCategories.id, name: serviceCategories.name })
      .from(serviceCategories)
      .where(eq(serviceCategories.businessId, businessId)),
    db
      .select({ id: addonGroups.id, prompt: addonGroups.prompt })
      .from(addonGroups)
      .where(eq(addonGroups.businessId, businessId)),
    db
      .select({
        id: addonOptions.id,
        name: addonOptions.name,
        description: addonOptions.description,
      })
      .from(addonOptions)
      .where(eq(addonOptions.businessId, businessId)),
    db
      .select({
        id: teamMembers.id,
        description: teamMembers.description,
        about: teamMembers.about,
      })
      .from(teamMembers)
      .where(eq(teamMembers.businessId, businessId)),
    db
      .select({
        id: businessPolicies.id,
        title: businessPolicies.title,
        body: businessPolicies.body,
      })
      .from(businessPolicies)
      .where(eq(businessPolicies.businessId, businessId)),
    db
      .select({
        id: businessPolicyPoints.id,
        title: businessPolicyPoints.title,
        body: businessPolicyPoints.body,
      })
      .from(businessPolicyPoints)
      .where(eq(businessPolicyPoints.businessId, businessId)),
  ])
  return {
    business,
    isDemo: business.isDemo,
    services: serviceRows,
    serviceCategories: categoryRows,
    addonGroups: groupRows,
    addonOptions: optionRows,
    team: teamRows,
    policies: policyRows,
    policyPoints: pointRows,
  }
}

// Brings the business's translations in line with its current English:
// only new or changed texts wait for Google, and those of removed things go.
// Demo businesses are never translated: they are copies guests try out,
// removed within days, so they cost nothing. Null when the business is
// gone or a demo.
export async function syncBusinessTexts(
  businessId: string
): Promise<SyncResult | null> {
  const rows = await loadBusinessTextRows(businessId)
  if (!rows || rows.isDemo) return null
  return syncTexts({
    scope: "business",
    businessId,
    removeMissing: true,
    items: collectBusinessTexts(rows).map((item) => ({
      key: businessTextKey(item.entityId, item.field),
      module: item.field,
      text: item.text,
    })),
  })
}

// After an owner's (or team member's) save in a Server Function: the
// changed texts go to Google once the answer has gone.
export function translateBusinessSoon(businessId: string): void {
  translateSoon(() => syncBusinessTexts(businessId))
}

// For work already running after the answer (sign-up's preparing) and for
// scripts: records the changes, then sends what waits to Google now.
export async function translateBusinessNow(
  businessId: string
): Promise<QueueResult> {
  await syncBusinessTexts(businessId)
  return runTranslationQueue()
}

const SHOWN_STATUSES = TRANSLATION_STATUSES.filter(isShown)

// The business's translations in the page's language, as a lookup that
// gives the English back when there is none to show or it was made from
// other English (changed since, Google not done yet).
async function loadBusinessTranslations(
  businessId: string,
  language: PageLanguage
): Promise<(entityId: string, field: BusinessTextField, english: string) => string> {
  if (!isTranslationLanguage(language)) {
    return (_entityId, _field, english) => english
  }
  const rows = await db
    .select({
      key: translationEntries.key,
      sourceText: translationEntries.sourceText,
      text: translationEntries.text,
    })
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.scope, "business"),
        eq(translationEntries.businessId, businessId),
        eq(translationEntries.language, language),
        inArray(translationEntries.status, SHOWN_STATUSES)
      )
    )
  const byKey = new Map(rows.map((row) => [row.key, row]))
  return (entityId, field, english) => {
    const row = byKey.get(businessTextKey(entityId, field))
    return row && row.text !== null && row.sourceText === english
      ? row.text
      : english
  }
}

export const getBusinessTranslations = cache(loadBusinessTranslations)

// Each service's name in the other languages, while made from its current
// English name: the assistant also finds "corte clásico" for "Classic
// Haircut". The caller has checked the business is the owner's.
export async function getServiceNameTranslations(
  businessId: string
): Promise<{ serviceId: string; sourceText: string; text: string }[]> {
  const rows = await db
    .select({
      key: translationEntries.key,
      language: translationEntries.language,
      sourceText: translationEntries.sourceText,
      text: translationEntries.text,
    })
    .from(translationEntries)
    .where(
      and(
        eq(translationEntries.scope, "business"),
        eq(translationEntries.businessId, businessId),
        eq(translationEntries.module, "service.name"),
        inArray(translationEntries.language, [...TRANSLATION_LANGUAGES]),
        inArray(translationEntries.status, SHOWN_STATUSES)
      )
    )
  const suffix = ":service.name"
  return rows.flatMap((row) =>
    row.text === null || !row.key.endsWith(suffix)
      ? []
      : [
          {
            serviceId: row.key.slice(0, -suffix.length),
            sourceText: row.sourceText,
            text: row.text,
          },
        ]
  )
}
