import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { teamCalendarsFor } from "@/features/dashboard/api/google-calendar"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TeamView } from "@/features/dashboard/components/team-view"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.team") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function TeamPage({ params }: Props) {
  const { businessId } = await params
  const { business, team, hours, memberHours } = await getOwnerBusiness(businessId)
  const calendars = await teamCalendarsFor(business.id)
  return (
    <TeamView
      businessId={businessId}
      businessName={business.name}
      team={team}
      hours={hours}
      memberHours={memberHours}
      calendars={calendars}
    />
  )
}
