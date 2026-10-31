import { getAdminPendingActions } from "@/features/admin/api/assistant"
import { AdminAssistant } from "@/features/admin/components/admin-assistant"

// Assistant (A8): every card waiting for an owner's tap.
export default async function AdminAssistantPage() {
  return <AdminAssistant rows={await getAdminPendingActions()} />
}
