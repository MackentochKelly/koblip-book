import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PlanLocked } from "@/components/plan-locked"
import { getRewardActivity } from "@/features/dashboard/api/customers"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { RewardsActivity } from "@/features/dashboard/components/rewards-activity"
import { hasFeature } from "@/lib/plan-access"
import { rewardRulesFor } from "@/lib/rewards"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.rewards.parts")
  return { title: t("activity") }
}

// What happened with the business's rewards, newest first
// (docs/plans/rewards.md, RW-9). The rule to show is in the address
// (?rule=), so it filters on the server.
export default async function RewardsActivityPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/rewards/activity">) {
  const { businessId } = await params
  const { rule } = await searchParams
  // Checks the business is the signed-in owner's before anything is read.
  const { business } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(business.id, "rewards"))) {
    return <PlanLocked feature="rewards" />
  }
  const rules = await rewardRulesFor(business.id, { withEnded: true })
  const ruleId =
    typeof rule === "string" && rules.some((item) => item.id === rule)
      ? rule
      : null
  return (
    <RewardsActivity
      businessId={businessId}
      currency={business.currency}
      rules={rules}
      ruleId={ruleId}
      activity={await getRewardActivity(businessId, ruleId)}
    />
  )
}
