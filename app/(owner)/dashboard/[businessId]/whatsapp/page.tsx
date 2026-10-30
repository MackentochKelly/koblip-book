import type { Metadata } from "next"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappView } from "@/features/dashboard/components/whatsapp-view"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.whatsapp }
}

type Props = {
  params: Promise<{ businessId: string }>
}

export default async function WhatsappPage({ params }: Props) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [connection, settings, messages] = await Promise.all([
    chatConnectionFor(businessId),
    notificationSettingsFor(businessId),
    notificationMessagesFor(businessId),
  ])
  return (
    <WhatsappView
      businessId={businessId}
      connection={connection}
      settings={settings}
      messages={messages}
    />
  )
}
