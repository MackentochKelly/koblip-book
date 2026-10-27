import "server-only"
import { BOOKING_RULES } from "@/lib/booking-rules"
import {
  getMetaAiClient,
  isMetaAiEnabled,
  META_TEXT_MODEL,
} from "@/lib/meta-ai"

export type TranslationField =
  | "business.description"
  | "service.name"
  | "service.description"
  | "addon_group.prompt"
  | "addon.name"
  | "addon.description"

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

// Every text that needs a Spanish translation: About (if any) + every
// service name + every service description (if any) + every add-on group
// prompt + every add-on option name + every add-on option description
// (if any).
export function collectTranslatableTexts(
  businessId: string,
  businessDescription: string | null,
  serviceRows: { id: string; name: string; description: string | null }[],
  addonRows: AddonTranslatableRows = { groups: [], options: [] }
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
  "You translate texts for a local business's booking page into neutral Latin American Spanish. Keep the meaning; keep names, brands, numbers and prices exactly as they are; do not add anything. Return every id exactly once."

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

function limitForId(id: string): number {
  const field = id.slice(id.lastIndexOf(":") + 1)
  if (field === "service.name") {
    return BOOKING_RULES.maxServiceName
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
  return BOOKING_RULES.maxBusinessDescription
}

function userMessage(batch: { id: string; text: string }[]): string {
  return (
    "Translate each English text into Spanish. Answer with every id once:\n" +
    JSON.stringify(batch.map((item) => ({ id: item.id, text: item.text })))
  )
}

// Translates a batch of texts with Meta AI, at most 40 items per call.
// Drops any returned item whose id was not asked, is empty, or is longer
// than its limit; one bad item never fails the rest. Meta AI off or a
// failed call gives an empty Map, which the callers report.
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
  for (let start = 0; start < items.length; start += TRANSLATE_BATCH_SIZE) {
    const batch = items.slice(start, start + TRANSLATE_BATCH_SIZE)
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
        return new Map()
      }
      returned = JSON.parse(content) as unknown
    } catch {
      return new Map()
    }
    if (!returned || typeof returned !== "object" || !("items" in returned)) {
      return new Map()
    }
    const rawItems = (returned as { items?: unknown }).items
    if (!Array.isArray(rawItems)) {
      return new Map()
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
