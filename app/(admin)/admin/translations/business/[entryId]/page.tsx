import { notFound } from "next/navigation"

import { getTranslationDetail } from "@/features/admin/api/translations"
import { TranslationEntry } from "@/features/admin/components/translation-entry"

// Translations → Business → one text (G5).
export default async function TranslationBusinessEntryPage({
  params,
}: PageProps<"/admin/translations/business/[entryId]">) {
  const { entryId } = await params
  const detail = await getTranslationDetail("business", entryId)
  if (!detail) notFound()
  return <TranslationEntry key={detail.entry.id} detail={detail} />
}
