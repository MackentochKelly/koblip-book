import { getWhatsappActivity } from "@/features/admin/api/whatsapp-activity"
import { WhatsappActivity } from "@/features/admin/components/whatsapp-activity"
import { activityFilterFrom } from "@/lib/whatsapp-activity-filter"

// WhatsApp → Activity (A5).
export default async function WhatsappActivityPage({
  searchParams,
}: PageProps<"/admin/whatsapp/activity">) {
  const filter = activityFilterFrom(await searchParams)
  const rows = await getWhatsappActivity(filter)
  return <WhatsappActivity rows={rows} filter={filter} />
}
