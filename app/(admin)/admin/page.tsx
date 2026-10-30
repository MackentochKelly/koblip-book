import { LayoutDashboardIcon } from "@/components/ui/icons"
import { getOverview } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { OverviewCards } from "@/features/admin/components/overview-cards"
import { getAdminMessages } from "@/features/admin/i18n/server"

export default async function AdminOverviewPage() {
  const [overview, m] = await Promise.all([getOverview(), getAdminMessages()])
  return (
    <AdminPage title={m.nav.overview} icon={<LayoutDashboardIcon />} empty={null}>
      <OverviewCards overview={overview} m={m} />
    </AdminPage>
  )
}
