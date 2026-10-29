import { ContactIcon } from "@/components/ui/icons"
import { getOwners } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { OwnersList } from "@/features/admin/components/owners-list"
import { getAdminMessages } from "@/features/admin/i18n/server"
import { requireAdmin } from "@/lib/dal"

export default async function AdminOwnersPage() {
  const [session, owners, m] = await Promise.all([
    requireAdmin(),
    getOwners(),
    getAdminMessages(),
  ])
  return (
    <AdminPage
      title={m.nav.owners}
      icon={<ContactIcon />}
      empty={owners.length ? null : m.owners.none}
    >
      <OwnersList owners={owners} selfId={session.userId} m={m} />
    </AdminPage>
  )
}
