import { getTranslationChanges } from "@/features/admin/api/translations"
import { TranslationHistoryList } from "@/features/admin/components/translation-history-list"

// Translations → History (G5): every change, newest first.
export default async function TranslationHistoryPage() {
  return <TranslationHistoryList rows={await getTranslationChanges()} showText />
}
