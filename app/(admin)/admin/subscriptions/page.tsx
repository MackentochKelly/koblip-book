import { getTranslations } from "next-intl/server"

import { BanknoteIcon } from "@/components/ui/icons"
import { getFreeBusinesses, getSubscriptions } from "@/features/admin/api/subscriptions"
import { AdminPage } from "@/features/admin/components/admin-page"
import { GiveFreePro } from "@/features/admin/components/give-free-pro"
import { SubscriptionsList } from "@/features/admin/components/subscriptions-list"
import { stripeClient } from "@/lib/stripe"

// Subscriptions (docs/plans/subscriptions.md, P7, P7b): every business's
// paid plan, live and ended, with links into Stripe; the one action gives
// a business Pro for free, once Stripe is set up.
export default async function AdminSubscriptionsPage() {
  const [subscriptions, freeBusinesses, t] = await Promise.all([
    getSubscriptions(),
    getFreeBusinesses(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage
      title={t("nav.subscriptions")}
      icon={<BanknoteIcon />}
      empty={subscriptions.length ? null : t("subscriptions.none")}
      action={stripeClient ? <GiveFreePro businesses={freeBusinesses} /> : undefined}
    >
      <SubscriptionsList subscriptions={subscriptions} />
    </AdminPage>
  )
}
