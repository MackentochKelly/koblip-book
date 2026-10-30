import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { IntegrationsView } from "@/features/dashboard/components/integrations-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.integrations }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function IntegrationsPage({ params }: Props) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  return <IntegrationsView businessId={businessId} connection={null} />
}
