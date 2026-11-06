import { getTranslations } from "next-intl/server"

import { ContactIcon } from "@/components/ui/icons"
import { adminDeleteUser } from "@/features/dashboard/api/delete-actions"
import { getOwners } from "@/features/admin/api/queries"
import { AdminPage } from "@/features/admin/components/admin-page"
import { OwnersList } from "@/features/admin/components/owners-list"
import { requireAdmin } from "@/lib/dal"

export default async function AdminOwnersPage() {
  const [session, owners, t] = await Promise.all([
    requireAdmin(),
    getOwners(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.owners")}
      icon={<ContactIcon />}
      empty={owners.length ? null : t("owners.none")}
    >
      <OwnersList
        owners={owners}
        selfId={session.userId}
        onDelete={adminDeleteUser}
      />
    </AdminPage>
  )
}
