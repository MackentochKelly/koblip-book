import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { TeamView } from "@/features/dashboard/components/team-view"

export const metadata: Metadata = { title: "Team" }

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function TeamPage({ params }: Props) {
  const { businessId } = await params
  const { team } = await getOwnerBusiness(businessId)
  return <TeamView businessId={businessId} team={team} />
}
