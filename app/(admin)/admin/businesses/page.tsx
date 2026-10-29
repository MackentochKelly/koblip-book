import { StoreIcon } from "@/components/ui/icons"
import { getBusinesses } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { BusinessesList } from "@/features/admin/components/businesses-list"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function AdminBusinessesPage() {
  const [businesses, m] = await Promise.all([
    getBusinesses(),
    getAdminMessages(),
  ])
  return (
    <AdminPage
      title={m.nav.businesses}
      icon={<StoreIcon />}
      empty={businesses.length ? null : m.businesses.none}
    >
      <BusinessesList businesses={businesses} m={m} />
    </AdminPage>
  )
}
