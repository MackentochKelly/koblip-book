import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getBusinessPhotos } from "@/features/dashboard/api/team-service-queries"
import { BusinessPhotosEditor } from "@/features/dashboard/components/business-photos-editor"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.settings")
  return { title: t("parts.portfolio") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function PortfolioPage({ params }: Props) {
  const { businessId } = await params
  const photos = await getBusinessPhotos(businessId)
  return <BusinessPhotosEditor businessId={businessId} photos={photos} />
}
