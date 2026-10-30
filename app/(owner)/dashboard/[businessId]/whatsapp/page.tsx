import type { Metadata } from "next"
import { chatConnectionFor } from "@/features/dashboard/api/chat-templates"
import {
  notificationHistoryFor,
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
  const { business } = await getOwnerBusiness(businessId)
  const [connection, settings, messages, history] = await Promise.all([
    chatConnectionFor(businessId),
    notificationSettingsFor(businessId),
    notificationMessagesFor(businessId),
    notificationHistoryFor(businessId),
  ])
  return (
    <WhatsappView
      businessId={businessId}
      connection={connection}
      settings={settings}
      messages={messages}
      history={history}
      timeZone={business.timezone}
    />
  )
}
