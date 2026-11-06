import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getPolicies } from "@/features/dashboard/api/policy-queries"
import { PoliciesSection } from "@/features/dashboard/components/policies-section"
import { PolicyPointsSection } from "@/features/dashboard/components/policy-points-section"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.policies }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function PoliciesPage({ params }: Props) {
  const { businessId } = await params
  const [{ business }, policies] = await Promise.all([
    getOwnerBusiness(businessId),
    getPolicies(businessId),
  ])
  return (
    <div className="flex flex-col gap-10">
      <PoliciesSection
        businessId={businessId}
        slug={business.slug}
        policies={policies.policies}
      />
      <PolicyPointsSection businessId={businessId} points={policies.points} />
    </div>
  )
}
