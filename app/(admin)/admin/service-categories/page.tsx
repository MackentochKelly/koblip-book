import { TagIcon } from "@/components/ui/icons"
import { adminDeleteServiceCategory } from "@/features/admin/api/actions"
import { getServiceCategories } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { ServiceCategoriesList } from "@/features/admin/components/service-categories-list"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { requireAdmin } from "@/lib/dal"

export default async function AdminServiceCategoriesPage() {
  const [, businesses, m] = await Promise.all([
    requireAdmin(),
    getServiceCategories(),
    getAdminMessages(),
  ])
  return (
    <AdminPage
      title={m.nav.serviceCategories}
      icon={<TagIcon />}
      empty={businesses.length ? null : m.serviceCategories.none}
    >
      <ServiceCategoriesList
        businesses={businesses}
        m={m}
        onDelete={adminDeleteServiceCategory}
      />
    </AdminPage>
  )
}
