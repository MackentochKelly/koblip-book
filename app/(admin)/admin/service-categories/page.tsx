import { getTranslations } from "next-intl/server"

import { TagIcon } from "@/components/ui/icons"
import { adminDeleteServiceCategory } from "@/features/admin/api/actions"
import { getServiceCategories } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { ServiceCategoriesList } from "@/features/admin/components/service-categories-list"
import { requireAdmin } from "@/lib/dal"

export default async function AdminServiceCategoriesPage() {
  const [, businesses, t] = await Promise.all([
    requireAdmin(),
    getServiceCategories(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.serviceCategories")}
      icon={<TagIcon />}
      empty={businesses.length ? null : t("serviceCategories.none")}
    >
      <ServiceCategoriesList
        businesses={businesses}
        onDelete={adminDeleteServiceCategory}
      />
    </AdminPage>
  )
}
