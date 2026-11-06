import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { notificationSettingsFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappTiming } from "@/features/dashboard/components/whatsapp-timing"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.whatsapp")
  return { title: t("parts.timing") }
}

export default async function WhatsappTimingPage({
  params,
}: PageProps<"/dashboard/[businessId]/automations/timing">) {
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
