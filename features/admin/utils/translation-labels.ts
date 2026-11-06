import { isTranslationLanguage } from "@/lib/translations/languages"
import type { TranslationStatus } from "@/lib/translations/rules"
import type { TranslationRow } from "../api/translations"
import type { AdminMessages } from "../i18n"

type Fields = AdminMessages["translations"]["fields"]

// Where a text is from and what it is, in the admin's words: a business and
// the kind of text ("Palacete · Service"), or the interface's page and the
// word's key.
export function textLabels(
  row: Pick<TranslationRow, "scope" | "module" | "key" | "language" | "businessName">,
  m: AdminMessages
): { where: string; what: string; language: string } {
  const t = m.translations
  const language = isTranslationLanguage(row.language)
    ? t.languages[row.language]
    : row.language
  if (row.scope === "interface") {
    return { where: row.module, what: row.key, language }
  }
  return {
    where: row.businessName ?? t.parts.business,
    what: Object.hasOwn(t.fields, row.module)
      ? t.fields[row.module as keyof Fields]
      : row.module,
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
