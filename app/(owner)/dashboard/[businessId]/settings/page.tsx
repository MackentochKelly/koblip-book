import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getBusinessPhotos } from "@/features/dashboard/api/team-service-queries"
import { getTranslationStatus } from "@/features/dashboard/api/translation-queries"
import { BusinessPhotosEditor } from "@/features/dashboard/components/business-photos-editor"
import { DetailsForm } from "@/features/dashboard/components/details-form"
import { SpanishSection } from "@/features/dashboard/components/spanish-section"
import {
  getOwnerLanguage,
  getOwnerMessages,
} from "@/features/dashboard/i18n/server"
import { NotificationSettingsLink } from "@/features/notifications/components/notification-settings-link"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.settings }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function SettingsPage({ params }: Props) {
  const { businessId } = await params
  const [{ business, team }, photos, translation, language] = await Promise.all(
    [
      getOwnerBusiness(businessId),
      getBusinessPhotos(businessId),
      getTranslationStatus(businessId),
      getOwnerLanguage(),
    ]
  )
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
      <NotificationSettingsLink
        href={`/dashboard/${businessId}/settings/notifications`}
        language={language}
      />
    </div>
  )
}
