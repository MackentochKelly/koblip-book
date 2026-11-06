import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageSection } from "@/components/page-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { HoursForm } from "@/features/dashboard/components/hours-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.hours") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function HoursPage({ params }: Props) {
  const { businessId } = await params
  const [{ hours }, t] = await Promise.all([
    getOwnerBusiness(businessId),
    getTranslations("owner.settings"),
  ])
  return (
    <PageSection id="hours" title={t("parts.hours")}>
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
