import type { Metadata } from "next"
import { notificationMessagesFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappMessages } from "@/features/dashboard/components/whatsapp-messages"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.messages }
}

export default async function WhatsappMessagesPage({
  params,
}: PageProps<"/dashboard/[businessId]/notifications/messages">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [messages, rules] = await Promise.all([
    notificationMessagesFor(businessId),
    notificationRules(businessId),
  ])
  return (
    <WhatsappMessages
      businessId={businessId}
      messages={messages}
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
