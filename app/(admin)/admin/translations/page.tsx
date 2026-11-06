import { getTranslationOverview } from "@/features/admin/api/translations"
import { TranslationsOverview } from "@/features/admin/components/translations-overview"
import { getAdminMessages } from "@/features/admin/i18n/server"

// Translations → Overview (G5).
export default async function TranslationsOverviewPage() {
  const [overview, m] = await Promise.all([
    getTranslationOverview(),
    getAdminMessages(),
  ])
  return <TranslationsOverview overview={overview} m={m} />
}
