import type { Metadata } from "next"
import { notificationHistoryFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappActivity } from "@/features/dashboard/components/whatsapp-activity"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.activity }
}

export default async function WhatsappActivityPage({
  params,
}: PageProps<"/dashboard/[businessId]/whatsapp/activity">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  const history = await notificationHistoryFor(businessId)
  return <WhatsappActivity history={history} timeZone={business.timezone} />
}
