import type { Metadata } from "next"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getWidgetLayout } from "@/features/dashboard/api/widgets"
import { WidgetsView } from "@/features/dashboard/components/widgets-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.widgets }
}

export default async function WidgetsPage({
  params,
}: PageProps<"/dashboard/[businessId]/widgets">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  const { layout, device } = await getWidgetLayout(business)
  return <WidgetsView businessId={businessId} layout={layout} device={device} />
}
