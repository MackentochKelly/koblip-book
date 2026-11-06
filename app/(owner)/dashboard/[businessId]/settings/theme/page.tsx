import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { ThemeSection } from "@/features/dashboard/components/theme-section"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.settings")
  return { title: t("parts.theme") }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { businessId } = await params
  const { business } = await getOwnerBusiness(businessId)
  return <ThemeSection businessId={businessId} active={business.theme} />
}
