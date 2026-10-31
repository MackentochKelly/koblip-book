import type { Metadata } from "next"
import { notificationSettingsFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappReplies } from "@/features/dashboard/components/whatsapp-replies"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.replies }
}

export default async function WhatsappRepliesPage({
  params,
}: PageProps<"/dashboard/[businessId]/notifications/replies">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const settings = await notificationSettingsFor(businessId)
  return <WhatsappReplies businessId={businessId} settings={settings} />
}
