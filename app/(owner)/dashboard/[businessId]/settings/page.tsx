import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getBusinessPhotos } from "@/features/dashboard/api/team-service-queries"
import { getTranslationStatus } from "@/features/dashboard/api/translation-queries"
import { BusinessPhotosEditor } from "@/features/dashboard/components/business-photos-editor"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { SpanishSection } from "@/features/dashboard/components/spanish-section"

export const metadata: Metadata = { title: "Settings" }

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { businessId } = await params
  const [{ business, team }, photos, translation] = await Promise.all([
    getOwnerBusiness(businessId),
    getBusinessPhotos(businessId),
    getTranslationStatus(businessId),
  ])
  return (
    <div className="flex flex-col gap-10">
      <DetailsForm
        businessId={businessId}
        hasTeam={team.length > 0}
        details={{
          name: business.name,
          address: business.address,
          description: business.description,
          phone: business.phone,
          website: business.website,
          seats: business.seats,
        }}
      />
      <BusinessPhotosEditor businessId={businessId} photos={photos} />
      <SpanishSection
        businessId={businessId}
        slug={business.slug}
        status={translation}
      />
    </div>
  )
}
