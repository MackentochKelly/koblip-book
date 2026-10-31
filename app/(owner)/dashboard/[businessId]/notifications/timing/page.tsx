import type { Metadata } from "next"
import { notificationSettingsFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappTiming } from "@/features/dashboard/components/whatsapp-timing"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.timing }
}

export default async function WhatsappTimingPage({
  params,
}: PageProps<"/dashboard/[businessId]/notifications/timing">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  await getOwnerBusiness(businessId)
  const [settings, rules] = await Promise.all([
    notificationSettingsFor(businessId),
    notificationRules(businessId),
  ])
  return (
    <WhatsappTiming
      businessId={businessId}
      settings={settings}
      rules={{ reminderChoices: rules.reminderChoices, maxReminders: rules.maxReminders }}
    />
  )
}
