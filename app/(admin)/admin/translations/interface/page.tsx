import {
  getTranslationGroups,
  getTranslationList,
} from "@/features/admin/api/translations"
import { TranslationList } from "@/features/admin/components/translation-list"
import { translationFilterFrom } from "@/features/admin/utils/translation-filter"

// Translations → Interface (G5): filtered by the address.
export default async function TranslationsInterfacePage({
  searchParams,
}: PageProps<"/admin/translations/interface">) {
  const filter = translationFilterFrom(await searchParams)
  const [list, groups] = await Promise.all([
    getTranslationList("interface", filter),
    getTranslationGroups("interface"),
  ])
  return (
    <TranslationList
      scope="interface"
      list={list}
      groups={groups}
      filter={{ ...filter, page: list.page }}
    />
  )
}
