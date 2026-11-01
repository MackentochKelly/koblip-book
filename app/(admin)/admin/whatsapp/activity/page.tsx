import { adminAutomationRuns } from "@/features/admin/api/automations"
import { getWhatsappActivity } from "@/features/admin/api/whatsapp-activity"
import { WhatsappActivity } from "@/features/admin/components/whatsapp-activity"
import { activityFilterFrom, activitySources } from "@/lib/whatsapp-activity-filter"

// WhatsApp → Activity (A5), with every business's automation runs among
// the messages (D18 of the automations plan).
export default async function WhatsappActivityPage({
  searchParams,
}: PageProps<"/admin/whatsapp/activity">) {
  const filter = activityFilterFrom(await searchParams)
  const load = activitySources(filter)
  const [rows, runs] = await Promise.all([
    load.messages ? getWhatsappActivity(filter) : [],
    load.runs ? adminAutomationRuns(load.runs).then((page) => page.runs) : [],
  ])
  return <WhatsappActivity rows={rows} runs={runs} filter={filter} />
}
