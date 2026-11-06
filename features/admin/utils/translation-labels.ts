import type { useTranslations } from "next-intl"

import { LANGUAGE_NAMES } from "@/lib/page-language"
import type { BusinessTextField } from "@/lib/translations/business-texts"
import { isTranslationLanguage } from "@/lib/translations/languages"
import type { TranslationStatus } from "@/lib/translations/rules"
import type { TranslationRow } from "../api/translations"

// The Translations screens' words (useTranslations or getTranslations).
export type TranslationWords = ReturnType<typeof useTranslations<"admin.translations">>

// Where a text is from and what it is, in the admin's words: a business and
// the kind of text ("Palacete · Service"), or the interface's page and the
// word's key. The language is named in itself ("Español").
export function textLabels(
  row: Pick<TranslationRow, "scope" | "module" | "key" | "language" | "businessName">,
  t: TranslationWords
): { where: string; what: string; language: string } {
  const language = isTranslationLanguage(row.language)
    ? LANGUAGE_NAMES[row.language]
    : row.language
  if (row.scope === "interface") {
    return { where: row.module, what: row.key, language }
  }
  // A business text's module is its field ("service.name"); one this
  // screen has no name for shows as it is.
  const field = `fields.${row.module as BusinessTextField}` as const
  return {
    where: row.businessName ?? t("parts.business"),
    what: t.has(field) ? t(field) : row.module,
    language,
  }
}

// A state's badge: failed stands out, what waits on someone is outlined.
export function stateBadge(
  status: TranslationStatus
): "destructive" | "outline" | "secondary" {
  if (status === "failed") return "destructive"
  if (status === "pending" || status === "needs_review") return "outline"
  return "secondary"
}
