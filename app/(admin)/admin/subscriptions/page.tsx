import { getTranslations } from "next-intl/server"

import { BanknoteIcon } from "@/components/ui/icons"
import { getSubscriptions } from "@/features/admin/api/subscriptions"
import { AdminPage } from "@/features/admin/components/admin-page"
import { SubscriptionsList } from "@/features/admin/components/subscriptions-list"

// Subscriptions (docs/plans/subscriptions.md, P7): every business's paid
// plan, live and ended, with links into Stripe.
export default async function AdminSubscriptionsPage() {
  const [subscriptions, t] = await Promise.all([
    getSubscriptions(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.subscriptions")}
      icon={<BanknoteIcon />}
      empty={subscriptions.length ? null : t("subscriptions.none")}
    >
      <SubscriptionsList subscriptions={subscriptions} />
    </AdminPage>
  )
}
