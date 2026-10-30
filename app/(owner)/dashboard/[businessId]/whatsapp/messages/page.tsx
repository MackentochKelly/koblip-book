import type { Metadata } from "next"
import { notificationMessagesFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappMessages } from "@/features/dashboard/components/whatsapp-messages"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.messages }
}

export default async function WhatsappMessagesPage({
  params,
}: PageProps<"/dashboard/[businessId]/whatsapp/messages">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const messages = await notificationMessagesFor(businessId)
  return <WhatsappMessages businessId={businessId} messages={messages} />
}
