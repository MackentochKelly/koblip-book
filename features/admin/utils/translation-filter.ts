import {
  isTranslationLanguage,
  type TranslationLanguage,
} from "@/lib/translations/languages"
import {
  TRANSLATION_STATUSES,
  type TranslationStatus,
} from "@/lib/translations/rules"

// Admin → Translations' list filters live in the address
// (?language=&state=&group=&q=&page=), so a filtered list can be shared and
// Back brings it back. `group` is a business (Business texts) or a page
// (Interface). Unknown values are ignored.
export interface TranslationFilter {
  language?: TranslationLanguage
  state?: TranslationStatus
  group?: string
  search?: string
  // From 1.
  page: number
}

type Query = Record<string, string | string[] | undefined>

export function translationFilterFrom(query: Query): TranslationFilter {
  const one = (value: string | string[] | undefined) =>
    typeof value === "string" ? value : undefined
  const language = one(query.language)
  const page = Number(one(query.page))
  return {
    language: language && isTranslationLanguage(language) ? language : undefined,
    state: TRANSLATION_STATUSES.find((state) => state === one(query.state)),
    group: one(query.group)?.trim() || undefined,
    search: one(query.q)?.trim() || undefined,
    page: Number.isSafeInteger(page) && page > 1 ? page : 1,
  }
}

// The address for a filter: only the parts that are set.
export function translationQuery(filter: TranslationFilter): string {
  const query = new URLSearchParams()
  if (filter.language) query.set("language", filter.language)
  if (filter.state) query.set("state", filter.state)
  if (filter.group) query.set("group", filter.group)
  if (filter.search) query.set("q", filter.search)
  if (filter.page > 1) query.set("page", String(filter.page))
  const text = query.toString()
  return text ? `?${text}` : ""
}
