import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"

import { notificationSettingsFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { EmailPage } from "@/features/dashboard/components/email-page"
import { emailActivity } from "@/lib/email-activity"
import { emailFilterFrom } from "@/lib/email-activity-filter"
import { BOOKING_EMAILS } from "@/lib/email-rules"
import { notificationRules } from "@/lib/platform-settings"

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("owner.whatsapp")
  return { title: t("parts.email") }
}

// The Email part (docs/plans/email.md, EM-10): each booking email's switch,
// and the history, filtered from the address.
export default async function EmailRoute({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/automations/email">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  const filter = emailFilterFrom(await searchParams, BOOKING_EMAILS)
  const [settings, rules] = await Promise.all([
    notificationSettingsFor(businessId),
    notificationRules(businessId),
  ])
  const history = await emailActivity({ businessId, kinds: BOOKING_EMAILS }, filter, rules.historySize)
  return (
    <EmailPage
      businessId={businessId}
      turnedOff={settings.emailTurnedOff}
      history={history}
      filter={filter}
      timeZone={business.timezone}
    />
  )
}
