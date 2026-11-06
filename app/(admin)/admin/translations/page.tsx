import { getTranslationOverview } from "@/features/admin/api/translations"
import { TranslationsOverview } from "@/features/admin/components/translations-overview"

// Translations → Overview (G5).
export default async function TranslationsOverviewPage() {
  return <TranslationsOverview overview={await getTranslationOverview()} />
}
