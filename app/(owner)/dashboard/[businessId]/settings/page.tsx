import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.settings }
}

type Props = {
  params: Promise<{ businessId: string }>
}

// Settings → Details, the first part: the frame gives the title.
export default async function SettingsPage({ params }: Props) {
  const { businessId } = await params
  const { business, team } = await getOwnerBusiness(businessId)
  return (
    <DetailsForm
      businessId={businessId}
      hasTeam={team.length > 0}
      title={null}
      details={{
        name: business.name,
        address: business.address,
        description: business.description,
        phone: business.phone,
        website: business.website,
        seats: business.seats,
      }}
    />
  )
}
