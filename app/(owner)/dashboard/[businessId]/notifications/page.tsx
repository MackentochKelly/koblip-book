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
import { notificationRules } from "@/lib/platform-settings"
import { whatsappActivityStats } from "@/lib/whatsapp-activity"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).shell.nav.notifications }
}

export default async function AutoMessagesOverviewPage({
  params,
}: PageProps<"/dashboard/[businessId]/notifications">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [connection, sender, messages, settings, rules] = await Promise.all([
    chatConnectionFor(businessId),
    senderFor(businessId),
    notificationMessagesFor(businessId),
    notificationSettingsFor(businessId),
    notificationRules(businessId),
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
  const stats = await whatsappActivityStats(businessId, rules.statsDays)
  return (
    <WhatsappOverview
      businessId={businessId}
      connection={connection}
      sender={sender}
      messages={messages}
      waiting={waiting}
      settings={settings}
      stats={stats}
      statsDays={rules.statsDays}
      limits={{
        maxHeader: rules.maxHeader,
        maxBody: rules.maxBody,
        maxFooter: rules.maxFooter,
        maxButtons: rules.maxButtons,
        maxButtonLabel: rules.maxButtonLabel,
      }}
    />
  )
}
