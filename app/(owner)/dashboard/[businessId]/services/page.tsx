import type { Metadata } from "next"
import { getAddonGroups } from "@/features/dashboard/api/addon-queries"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getServiceTeams } from "@/features/dashboard/api/team-service-queries"
import { ServicesView } from "@/features/dashboard/components/services-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.services }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function ServicesPage({ params }: Props) {
  const { businessId } = await params
  const [{ business, services, team }, serviceTeams, addonGroups] =
    await Promise.all([
      getOwnerBusiness(businessId),
      getServiceTeams(businessId),
      getAddonGroups(businessId),
    ])
  return (
    <ServicesView
      businessId={businessId}
      currency={business.currency}
      services={services}
      team={team.map(({ id, name }) => ({ id, name }))}
      serviceTeams={serviceTeams}
      addonGroups={addonGroups}
    />
  )
}
