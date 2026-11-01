import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { ThemeSection } from "@/features/dashboard/components/theme-section"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).settings.parts.theme }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function ThemePage({ params }: Props) {
  const { businessId } = await params
  const { business } = await getOwnerBusiness(businessId)
  return <ThemeSection businessId={businessId} active={business.theme} />
}
