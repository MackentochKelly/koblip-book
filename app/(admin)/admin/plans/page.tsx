import { getTranslations } from "next-intl/server"

import { CreditCardIcon } from "@/components/ui/icons"
import { getPlans } from "@/features/admin/api/plans"
import { AdminPage } from "@/features/admin/components/admin-page"
import { PlanFeatures } from "@/features/admin/components/plan-features"

// Admin → Plans: which plan has which feature (docs/plans/subscriptions.md,
// P0). getPlans checks the admin.
export default async function AdminPlansPage() {
  const [plans, t] = await Promise.all([
    getPlans(),
    getTranslations("admin"),
  ])
  return (
    <AdminPage title={t("nav.plans")} icon={<CreditCardIcon />} empty={null}>
      <PlanFeatures plans={plans} />
    </AdminPage>
  )
}
