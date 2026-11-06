import {
  getTranslationGroups,
  getTranslationList,
} from "@/features/admin/api/translations"
import { TranslationList } from "@/features/admin/components/translation-list"
import { translationFilterFrom } from "@/features/admin/utils/translation-filter"

// Translations → Business (G5): filtered by the address.
export default async function TranslationsBusinessPage({
  searchParams,
}: PageProps<"/admin/translations/business">) {
  const filter = translationFilterFrom(await searchParams)
  const [list, groups] = await Promise.all([
    getTranslationList("business", filter),
    getTranslationGroups("business"),
  ])
  return (
    <TranslationList
      scope="business"
      list={list}
      groups={groups}
      filter={{ ...filter, page: list.page }}
    />
  )
}
