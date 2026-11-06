import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { bookExamples } from "@/features/dashboard/api/message-words"
import { notificationMessagesFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappMessages } from "@/features/dashboard/components/whatsapp-messages"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.whatsapp")
  return { title: t("parts.messages") }
}

export default async function WhatsappMessagesPage({
  params,
}: PageProps<"/dashboard/[businessId]/automations/messages">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [messages, rules, examples] = await Promise.all([
    notificationMessagesFor(businessId),
    notificationRules(businessId),
    bookExamples(),
  ])
  return (
    <WhatsappMessages
      businessId={businessId}
      messages={messages}
      examples={examples}
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
