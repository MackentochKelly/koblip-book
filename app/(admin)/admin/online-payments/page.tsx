import { getTranslations } from "next-intl/server"

import { CreditCardIcon } from "@/components/ui/icons"
import { getAdminOnlinePayments } from "@/features/admin/api/online-payments"
import { AdminPage } from "@/features/admin/components/admin-page"
import { OnlinePaymentsLists } from "@/features/admin/components/online-payments-lists"

// Every business's Stripe account and card setting, and every online
// payment event (docs/plans/online-payments.md, ON-11). Read only.
export default async function AdminOnlinePaymentsPage() {
  const [payments, t] = await Promise.all([
    getAdminOnlinePayments(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.onlinePayments")}
      icon={<CreditCardIcon />}
      empty={null}
    >
      <OnlinePaymentsLists payments={payments} />
    </AdminPage>
  )
}
