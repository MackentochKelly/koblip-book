import type { Metadata } from "next"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import { senderFor } from "@/features/dashboard/api/notification-sender"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappOverview } from "@/features/dashboard/components/whatsapp-overview"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.whatsapp }
}

export default async function WhatsappOverviewPage({
  params,
}: PageProps<"/dashboard/[businessId]/whatsapp">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [connection, sender, messages, settings] = await Promise.all([
    chatConnectionFor(businessId),
    senderFor(businessId),
    notificationMessagesFor(businessId),
    notificationSettingsFor(businessId),
  ])
  return (
    <WhatsappOverview
      businessId={businessId}
      connection={connection}
      sender={sender}
      messages={messages}
      ownerPhone={settings.ownerPhone}
    />
  )
}
