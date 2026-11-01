import { UsersIcon } from "@/components/ui/icons"
import { getTeamAccounts } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { TeamAccountsList } from "@/features/admin/components/team-accounts-list"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { requireAdmin } from "@/lib/dal"

export default async function AdminTeamPage() {
  const [, { joined, invites }, m] = await Promise.all([
    requireAdmin(),
    getTeamAccounts(),
    getAdminMessages(),
  ])
  return (
    <AdminPage
      title={m.nav.team}
      icon={<UsersIcon />}
      empty={joined.length || invites.length ? null : m.team.none}
    >
      <TeamAccountsList joined={joined} invites={invites} m={m} />
    </AdminPage>
  )
}
