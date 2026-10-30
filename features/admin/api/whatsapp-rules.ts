import "server-only"

import { requireAdmin } from "@/lib/dal"
import { notificationRuleSettings } from "@/lib/platform-settings"

// WhatsApp → Rules (A7): each rule with its default and the admin's value.
export async function getWhatsappRules() {
  await requireAdmin()
  return notificationRuleSettings()
}
