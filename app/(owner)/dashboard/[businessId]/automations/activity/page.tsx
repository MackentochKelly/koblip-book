import type { Metadata } from "next"
import { automationRuns } from "@/features/dashboard/api/automation-queries"
import { notificationHistoryFor } from "@/features/dashboard/api/notifications"
import { getOwnerBusiness } from "@/features/dashboard/api/queries"
import { WhatsappActivity } from "@/features/dashboard/components/whatsapp-activity"
import { getOwnerMessages } from "@/features/dashboard/i18n/server"
import {
  activityFilterFrom,
  activitySources,
} from "@/lib/whatsapp-activity-filter"

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getOwnerMessages()).whatsapp.parts.activity }
}

export default async function WhatsappActivityPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]/automations/activity">) {
  const { businessId } = await params
  // Only the business's owner gets here.
  const { business } = await getOwnerBusiness(businessId)
  const filter = activityFilterFrom(await searchParams)
  const load = activitySources(filter)
  const [history, runs] = await Promise.all([
    load.messages ? notificationHistoryFor(businessId, filter) : [],
    load.runs
      ? automationRuns(businessId, load.runs).then((page) => page.runs)
      : [],
  ])
  return (
    <WhatsappActivity
      businessId={businessId}
      history={history}
      runs={runs}
      filter={filter}
      timeZone={business.timezone}
    />
  )
}
