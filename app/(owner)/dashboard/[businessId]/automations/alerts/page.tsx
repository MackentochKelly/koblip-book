import type { Metadata } from "next"
import {
  notificationMessagesFor,
  notificationSettingsFor,
} from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappAlerts } from "@/features/dashboard/components/whatsapp-alerts"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.alerts }
}

export default async function WhatsappAlertsPage({
  params,
}: PageProps<"/dashboard/[businessId]/automations/alerts">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [messages, settings, rules] = await Promise.all([
    notificationMessagesFor(businessId),
    notificationSettingsFor(businessId),
    notificationRules(businessId),
  ])
  return (
    <WhatsappAlerts
      businessId={businessId}
      messages={messages}
      settings={settings}
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
