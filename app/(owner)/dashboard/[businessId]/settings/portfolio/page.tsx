import type { Metadata } from "next"
import { getBusinessPhotos } from "@/features/dashboard/api/team-service-queries"
import { BusinessPhotosEditor } from "@/features/dashboard/components/business-photos-editor"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.portfolio }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function PortfolioPage({ params }: Props) {
  const { businessId } = await params
  const photos = await getBusinessPhotos(businessId)
  return <BusinessPhotosEditor businessId={businessId} photos={photos} />
}
