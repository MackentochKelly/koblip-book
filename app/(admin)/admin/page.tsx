import { getTranslations } from "next-intl/server"

import { LayoutDashboardIcon } from "@/components/ui/icons"
import { getOverview } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { OverviewCards } from "@/features/admin/components/overview-cards"

export default async function AdminOverviewPage() {
  const [overview, t] = await Promise.all([
    getOverview(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage title={t("nav.overview")} icon={<LayoutDashboardIcon />} empty={null}>
      <OverviewCards overview={overview} />
    </AdminPage>
  )
}
