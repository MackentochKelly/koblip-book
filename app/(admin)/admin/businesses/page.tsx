import { getTranslations } from "next-intl/server"

import { StoreIcon } from "@/components/ui/icons"
import { adminDeleteBusiness } from "@/features/dashboard/api/delete-actions"
import { getBusinesses } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { BusinessesList } from "@/features/admin/components/businesses-list"

export default async function AdminBusinessesPage() {
  const [businesses, t] = await Promise.all([
    getBusinesses(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.businesses")}
      icon={<StoreIcon />}
      empty={businesses.length ? null : t("businesses.none")}
    >
      <BusinessesList businesses={businesses} onDelete={adminDeleteBusiness} />
    </AdminPage>
  )
}
