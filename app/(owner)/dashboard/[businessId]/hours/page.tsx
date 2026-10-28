import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { HoursForm } from "@/features/dashboard/components/hours-form"
import { SettingsTabs } from "@/features/dashboard/components/settings-tabs"

export const metadata: Metadata = { title: "Hours" }

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function HoursPage({ params }: Props) {
  const { businessId } = await params
  const { hours } = await getOwnerBusiness(businessId)
  return (
    <div className="flex flex-col gap-6">
      <SettingsTabs businessId={businessId} />
      <HoursForm
        businessId={businessId}
        hours={hours.map(({ weekday, opensAt, closesAt }) => ({
          weekday,
          opensAt,
          closesAt,
        }))}
      />
    </div>
  )
}
