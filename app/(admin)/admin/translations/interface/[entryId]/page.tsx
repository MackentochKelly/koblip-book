import { notFound } from "next/navigation"

import { getTranslationDetail } from "@/features/admin/api/translations"
import { TranslationEntry } from "@/features/admin/components/translation-entry"

// Translations → Interface → one text (G5).
export default async function TranslationInterfaceEntryPage({
  params,
}: PageProps<"/admin/translations/interface/[entryId]">) {
  const { entryId } = await params
  const detail = await getTranslationDetail("interface", entryId)
  if (!detail) notFound()
  return <TranslationEntry key={detail.entry.id} detail={detail} />
}
