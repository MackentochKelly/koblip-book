import { getTranslations } from "next-intl/server"

import { BankIcon } from "@/components/ui/icons"
import { getBusinessPayments } from "@/features/admin/api/payments"
import { AdminPage } from "@/features/admin/components/admin-page"
import { BusinessPaymentsList } from "@/features/admin/components/business-payments-list"

// Every business's ways to be paid outside the app
// (docs/plans/outside-payments.md, OP-9). Read only.
export default async function AdminPaymentsPage() {
  const [businesses, t] = await Promise.all([
    getBusinessPayments(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.payments")}
      icon={<BankIcon />}
      empty={businesses.length ? null : t("payments.none")}
    >
      <BusinessPaymentsList businesses={businesses} />
    </AdminPage>
  )
}
