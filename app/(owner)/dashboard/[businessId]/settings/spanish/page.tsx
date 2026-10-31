import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getTranslationStatus } from "@/features/dashboard/api/translation-queries"
import { SpanishSection } from "@/features/dashboard/components/spanish-section"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.spanish }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function SpanishPage({ params }: Props) {
  const { businessId } = await params
  const [{ business }, translation] = await Promise.all([
    getOwnerBusiness(businessId),
    getTranslationStatus(businessId),
  ])
  return (
    <SpanishSection
      businessId={businessId}
      slug={business.slug}
      status={translation}
    />
  )
}
