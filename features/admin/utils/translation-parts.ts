import type { TranslationScope } from "@/lib/translations/rules"

export const TRANSLATIONS_BASE = "/admin/translations"

// The admin's Translations parts, in order (docs/plans/translations.md, G5).
// Overview is the page itself; each other part is its own route below it
// (app/(admin)/admin/translations/).
export const TRANSLATION_PARTS = [
  "overview",
  "interface",
  "business",
  "rules",
  "history",
] as const

export type TranslationPart = (typeof TRANSLATION_PARTS)[number]

// The list part of each kind of text, and one text's own screen inside it.
export const SCOPE_PART: Record<TranslationScope, TranslationPart> = {
  interface: "interface",
  business: "business",
}

export function translationPartHref(part: TranslationPart): string {
  return part === "overview" ? TRANSLATIONS_BASE : `${TRANSLATIONS_BASE}/${part}`
}

export function translationEntryHref(
  scope: TranslationScope,
  id: string
): string {
  return `${translationPartHref(SCOPE_PART[scope])}/${id}`
}
