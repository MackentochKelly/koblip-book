import type { Metadata } from "next"
import { PageSection } from "@/components/page-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { HoursForm } from "@/features/dashboard/components/hours-form"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.hours }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function HoursPage({ params }: Props) {
  const { businessId } = await params
  const [{ hours }, m] = await Promise.all([
    getOwnerBusiness(businessId),
    getOwnerMessages(),
  ])
  return (
    <PageSection id="hours" title={m.settings.parts.hours}>
      <HoursForm
        businessId={businessId}
        hours={hours.map(({ weekday, opensAt, closesAt }) => ({
          weekday,
          opensAt,
          closesAt,
        }))}
      />
    </PageSection>
  )
}
