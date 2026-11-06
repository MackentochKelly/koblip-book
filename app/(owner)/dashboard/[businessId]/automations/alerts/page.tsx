import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { bookExamples } from "@/features/dashboard/api/message-words"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappAlerts } from "@/features/dashboard/components/whatsapp-alerts"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.whatsapp")
  return { title: t("parts.alerts") }
}

export default async function WhatsappAlertsPage({
  params,
}: PageProps<"/dashboard/[businessId]/automations/alerts">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [messages, settings, rules, examples] = await Promise.all([
    notificationMessagesFor(businessId),
    notificationSettingsFor(businessId),
    notificationRules(businessId),
    bookExamples(),
  ])
  return (
    <WhatsappAlerts
      businessId={businessId}
      messages={messages}
      settings={settings}
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
