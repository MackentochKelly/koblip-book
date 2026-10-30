import "server-only"

import { requireAdmin } from "@/lib/dal"
import { whatsappActivity } from "@/lib/whatsapp-activity"
import { WHATSAPP_ADMIN_RULES } from "@/lib/whatsapp-admin-rules"
import type { ActivityFilter, BusinessNotificationSend } from "@/types/whatsapp"

// WhatsApp → Activity (A5): every business's messages, newest first, with
// the same filters and search as a business's own Activity (D33).
export async function getWhatsappActivity(
  filter: ActivityFilter
): Promise<BusinessNotificationSend[]> {
  await requireAdmin()
  return whatsappActivity(filter, { limit: WHATSAPP_ADMIN_RULES.listRows })
}
