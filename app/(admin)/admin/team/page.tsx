import { getTranslations } from "next-intl/server"

import { UsersIcon } from "@/components/ui/icons"
import { getTeamAccounts } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { TeamAccountsList } from "@/features/admin/components/team-accounts-list"
import { requireAdmin } from "@/lib/dal"

export default async function AdminTeamPage() {
  const [, { joined, invites }, t] = await Promise.all([
    requireAdmin(),
    getTeamAccounts(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.team")}
      icon={<UsersIcon />}
      empty={joined.length || invites.length ? null : t("team.none")}
    >
      <TeamAccountsList joined={joined} invites={invites} />
    </AdminPage>
  )
}
