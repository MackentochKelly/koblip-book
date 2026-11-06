import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { PageSection } from "@/components/page-section"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { DetailsForm } from "@/features/dashboard/components/details-form"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.settings") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

// Settings → Details, the first part, under the section title every part
// has. No "Improve with Muse" here (the owner's call); sign-up keeps it.
export default async function SettingsPage({ params }: Props) {
  const { businessId } = await params
  const [{ business, team }, t] = await Promise.all([
    getOwnerBusiness(businessId),
    getTranslations("owner.settings"),
  ])
  return (
    <PageSection
      id="details"
      title={t("parts.details")}
      info={t("details.info")}
      infoLabel={t("moreInfo")}
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
