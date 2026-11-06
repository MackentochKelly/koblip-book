import { getTranslationRules } from "@/features/admin/api/translations"
import { TranslationRules } from "@/features/admin/components/translation-rules"

// Translations → Rules (G5).
export default async function TranslationRulesPage() {
  return <TranslationRules rules={await getTranslationRules()} />
}
