import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { getWidgetLayout } from "@/features/dashboard/api/widgets"
import { WidgetsView } from "@/features/dashboard/components/widgets-view"
import { PlanLocked } from "@/components/plan-locked"
import { hasFeature } from "@/lib/plan-access"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.shell")
  return { title: t("nav.widgets") }
}

export default async function WidgetsPage({
  params,
}: PageProps<"/dashboard/[businessId]/widgets">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  if (!(await hasFeature(businessId, "widgets"))) {
    return <PlanLocked feature="widgets" />
  }
  const { layout, device } = await getWidgetLayout(business)
  return <WidgetsView businessId={businessId} layout={layout} device={device} />
}
