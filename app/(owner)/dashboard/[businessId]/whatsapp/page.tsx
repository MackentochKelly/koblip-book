import type { Metadata } from "next"
import {
  chatConnectionFor,
  ownTemplatesNotApproved,
} from "@/features/dashboard/api/chat-templates"
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
  // Its own number is connected but Koblip's sends: these still wait for
  // Meta (K3, D34).
  const waiting =
    sender === "koblip" && connection && !connection.needsReconnect
      ? await ownTemplatesNotApproved(
          businessId,
          messages.filter((item) => item.on).map((item) => item.message)
        )
      : []
  return (
    <WhatsappOverview
      businessId={businessId}
      connection={connection}
      sender={sender}
      messages={messages}
      waiting={waiting}
      freeTextInWindow={settings.freeTextInWindow}
      ownerPhone={settings.ownerPhone}
    />
  )
}
