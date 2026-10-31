import type { Metadata } from "next"
import { teamCalendarsFor } from "@/features/dashboard/api/google-calendar"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TeamView } from "@/features/dashboard/components/team-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.team }
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
