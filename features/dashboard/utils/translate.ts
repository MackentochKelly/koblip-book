import "server-only"
import { BOOKING_RULES } from "@/lib/booking-rules"
import { POLICY_RULES } from "@/lib/policy-rules"
import { TEAM_RULES } from "@/lib/team-rules"
import {
  getMetaAiClient,
  isMetaAiEnabled,
  META_TEXT_MODEL,
} from "@/lib/meta-ai"

export type TranslationField =
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
  | "policy.body"
  | "policy_point.title"
  | "policy_point.body"

export interface AddonTranslatableRows {
  groups: { id: string; prompt: string }[]
  options: { id: string; name: string; description: string | null }[]
}

export interface TranslatableText {
  // The id translateTexts answers with: `${entityId}:${field}`.
  id: string
  entityId: string
  field: TranslationField
  // The current English text the translation is made from.
  text: string
}

export interface ExistingTranslation {
  entityId: string
  field: string
  sourceText: string
}

export function translationId(
  entityId: string,
  field: TranslationField
): string {
  return `${entityId}:${field}`
}

// Every text that needs a Spanish translation: About and category (if any) + every
// service name + every service description (if any) + every service
// category's name + every add-on group prompt + every add-on option name +
// every add-on option description (if any) + every team member's job title
// and About (if any) + policies and their key points.
export function collectTranslatableTexts(
  businessId: string,
  businessDescription: string | null,
  businessCategory: string | null,
  serviceRows: { id: string; name: string; description: string | null }[],
  addonRows: AddonTranslatableRows = { groups: [], options: [] },
  teamRows: { id: string; description: string | null; about?: string | null }[] = [],
  policyRows: { id: string; body: string }[] = [],
  pointRows: { id: string; title: string; body: string }[] = [],
  serviceCategoryRows: { id: string; name: string }[] = []
): TranslatableText[] {
  const all: TranslatableText[] = []
  if (businessDescription && businessDescription.trim() !== "") {
    all.push({
      id: translationId(businessId, "business.description"),
      entityId: businessId,
      field: "business.description",
      text: businessDescription,
    })
  }
  if (businessCategory && businessCategory.trim() !== "") {
    all.push({
      id: translationId(businessId, "business.category"),
      entityId: businessId,
      field: "business.category",
      text: businessCategory,
    })
  }
  for (const service of serviceRows) {
    all.push({
      id: translationId(service.id, "service.name"),
      entityId: service.id,
      field: "service.name",
      text: service.name,
    })
    if (service.description && service.description.trim() !== "") {
      all.push({
        id: translationId(service.id, "service.description"),
        entityId: service.id,
        field: "service.description",
        text: service.description,
      })
    }
  }
  for (const category of serviceCategoryRows) {
    all.push({
      id: translationId(category.id, "service_category.name"),
      entityId: category.id,
      field: "service_category.name",
      text: category.name,
    })
  }
  for (const group of addonRows.groups) {
    all.push({
      id: translationId(group.id, "addon_group.prompt"),
      entityId: group.id,
      field: "addon_group.prompt",
      text: group.prompt,
    })
  }
  for (const option of addonRows.options) {
    all.push({
      id: translationId(option.id, "addon.name"),
      entityId: option.id,
      field: "addon.name",
      text: option.name,
    })
    if (option.description && option.description.trim() !== "") {
      all.push({
        id: translationId(option.id, "addon.description"),
        entityId: option.id,
        field: "addon.description",
        text: option.description,
      })
    }
  }
  for (const member of teamRows) {
    if (member.description && member.description.trim() !== "") {
      all.push({
        id: translationId(member.id, "team_member.description"),
        entityId: member.id,
        field: "team_member.description",
        text: member.description,
      })
    }
    if (member.about && member.about.trim() !== "") {
      all.push({
        id: translationId(member.id, "team_member.about"),
        entityId: member.id,
        field: "team_member.about",
        text: member.about,
      })
    }
  }
  for (const policy of policyRows) {
    if (policy.body.trim() !== "") {
      all.push({
        id: translationId(policy.id, "policy.body"),
        entityId: policy.id,
        field: "policy.body",
        text: policy.body,
      })
    }
  }
  for (const point of pointRows) {
    for (const field of ["policy_point.title", "policy_point.body"] as const) {
      const text = field === "policy_point.title" ? point.title : point.body
      all.push({
        id: translationId(point.id, field),
        entityId: point.id,
        field,
        text,
      })
    }
  }
  return all
}

// The subset that is missing or out of date. A translation is up to date
// only while its sourceText equals the current English text exactly.
export function pendingTranslations(
  all: TranslatableText[],
  existing: ExistingTranslation[]
): TranslatableText[] {
  const current = new Map(
    existing.map((row) => [`${row.entityId}\n${row.field}`, row.sourceText])
  )
  return all.filter(
    (item) => current.get(`${item.entityId}\n${item.field}`) !== item.text
  )
}

const TRANSLATE_SYSTEM_MESSAGE =
  "You translate texts for a local business's booking page into neutral Latin American Spanish. Keep the meaning; keep names, brands, numbers and prices exactly as they are; do not add anything. For ids ending in :business.category, translate the short business-type label, not a business name (Photography studio becomes Estudio de fotografía). Keep it short. Return every id exactly once."

const TRANSLATIONS_SCHEMA_NAME = "booking_page_translations"

const TRANSLATIONS_JSON_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          text: { type: "string" },
        },
        required: ["id", "text"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const

const TRANSLATE_BATCH_SIZE = 40
// English characters per call, so long texts (policies) never push a call
// past its timeout. A longer text goes alone.
const TRANSLATE_BATCH_CHARS = 3000

// Splits texts into calls of at most TRANSLATE_BATCH_SIZE items and
// TRANSLATE_BATCH_CHARS characters, keeping their order.
export function translationBatches<T extends { text: string }>(
  items: T[]
): T[][] {
  const batches: T[][] = []
  let batch: T[] = []
  let chars = 0
  for (const item of items) {
    if (
      batch.length > 0 &&
      (batch.length === TRANSLATE_BATCH_SIZE ||
        chars + item.text.length > TRANSLATE_BATCH_CHARS)
    ) {
      batches.push(batch)
      batch = []
      chars = 0
    }
    batch.push(item)
    chars += item.text.length
  }
  if (batch.length > 0) {
    batches.push(batch)
  }
  return batches
}

function limitForId(id: string): number {
  const field = id.slice(id.lastIndexOf(":") + 1)
  if (field === "service.name") {
    return BOOKING_RULES.maxServiceName
  }
  if (field === "service_category.name") {
    return BOOKING_RULES.maxServiceCategoryName
  }
  if (field === "addon.name") {
    return BOOKING_RULES.maxAddonName
  }
  if (field === "service.description") {
    return BOOKING_RULES.maxServiceDescription
  }
  if (field === "addon.description") {
    return BOOKING_RULES.maxAddonDescription
  }
  if (field === "addon_group.prompt") {
    return BOOKING_RULES.maxAddonPrompt
  }
  // Spanish runs longer than English.
  if (field === "team_member.about") {
    return Math.ceil(TEAM_RULES.aboutMaxLength * 1.5)
  }
  if (field === "policy_point.title") {
    return Math.ceil(POLICY_RULES.maxPointTitle * 1.5)
  }
  if (field === "policy_point.body") {
    return Math.ceil(POLICY_RULES.maxPointBody * 1.5)
  }
  if (field === "policy.body") {
    return Math.ceil(POLICY_RULES.maxLength * 1.5)
  }
  return BOOKING_RULES.maxBusinessDescription
}

function userMessage(batch: { id: string; text: string }[]): string {
  return (
    "Translate each English text into Spanish. Answer with every id once:\n" +
    JSON.stringify(batch.map((item) => ({ id: item.id, text: item.text })))
  )
}

// Translates a batch of texts with Meta AI, in calls split by
// translationBatches. Drops any returned item whose id was not asked, is empty, or is longer
// than its limit; one bad item never fails the rest. A failed call stops
// there and keeps what the calls before it got (the rest stay to be
// translated next time); Meta AI off or a first call that fails gives an
// empty Map, which the callers report.
export async function translateTexts(
  items: { id: string; text: string }[]
): Promise<Map<string, string>> {
  const translated = new Map<string, string>()
  if (items.length === 0) {
    return translated
  }
  if (!isMetaAiEnabled()) {
    return translated
  }
  const client = getMetaAiClient()
  if (!client) {
    return translated
  }
  const asked = new Set(items.map((item) => item.id))
  for (const batch of translationBatches(items)) {
    let returned: unknown
    try {
      const completion = await client.chat.completions.create(
        {
          model: META_TEXT_MODEL,
          messages: [
            { role: "system", content: TRANSLATE_SYSTEM_MESSAGE },
            { role: "user", content: userMessage(batch) },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: TRANSLATIONS_SCHEMA_NAME,
              schema: TRANSLATIONS_JSON_SCHEMA,
              strict: true,
            },
          },
        },
        { timeout: 15_000 }
      )
      const content = completion.choices[0]?.message?.content
      if (!content) {
        return translated
      }
      returned = JSON.parse(content) as unknown
    } catch {
      return translated
    }
    if (!returned || typeof returned !== "object" || !("items" in returned)) {
      return translated
    }
    const rawItems = (returned as { items?: unknown }).items
    if (!Array.isArray(rawItems)) {
      return translated
    }
    for (const raw of rawItems) {
      if (!raw || typeof raw !== "object") {
        continue
      }
      const candidate = raw as { id?: unknown; text?: unknown }
      if (typeof candidate.id !== "string" || typeof candidate.text !== "string") {
        continue
      }
      if (!asked.has(candidate.id) || translated.has(candidate.id)) {
        continue
      }
      const text = candidate.text.trim()
      if (!text || text.length > limitForId(candidate.id)) {
        continue
      }
      translated.set(candidate.id, text)
    }
  }
  return translated
}
