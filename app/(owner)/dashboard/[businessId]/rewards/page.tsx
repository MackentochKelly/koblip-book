import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PlanLocked } from "@/components/plan-locked"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { RewardsView } from "@/features/dashboard/components/rewards-view"
import { paymentMethodsFor } from "@/lib/payment-methods"
import { hasFeature } from "@/lib/plan-access"
import { rewardRulesFor } from "@/lib/rewards"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.rewards") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

// The owner's reward rules (docs/plans/rewards.md).
export default async function RewardsPage({ params }: Props) {
  const { businessId } = await params
  // Checks the business is the signed-in owner's before anything is read.
  const { business, services } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(business.id, "rewards"))) {
    return <PlanLocked feature="rewards" />
  }
  const [rules, methods] = await Promise.all([
    rewardRulesFor(business.id),
    paymentMethodsFor(business.id),
  ])
  return (
    <RewardsView
      businessId={businessId}
      currency={business.currency}
      rules={rules}
      services={services.map(({ id, name }) => ({ id, name }))}
      tracksPayments={methods.length > 0}
    />
  )
}
