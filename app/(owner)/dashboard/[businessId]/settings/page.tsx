import type { Metadata } from "next"
import { PageSection } from "@/components/page-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.settings }
}

type Props = {
  params: Promise<{ businessId: string }>
}

// Settings → Details, the first part, under the section title every part
// has. No "Improve with Muse" here (the owner's call); sign-up keeps it.
export default async function SettingsPage({ params }: Props) {
  const { businessId } = await params
  const [{ business, team }, m] = await Promise.all([
    getOwnerBusiness(businessId),
    getOwnerMessages(),
  ])
  return (
    <PageSection
      id="details"
      title={m.settings.parts.details}
      info={m.settings.details.info}
      infoLabel={m.settings.moreInfo}
    >
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
          currency: business.currency,
        }}
      />
    </PageSection>
  )
}
