"use client"

import { WhatsappActivityList } from "@/components/whatsapp-activity-list"
import type { ActivityFilter, BusinessNotificationSend } from "@/types/whatsapp"
import { adminCancelSend, adminSendAgain } from "../api/whatsapp-activity-actions"
import { useAdminMessages } from "../i18n/provider"

// WhatsApp → Activity (A5): the business page's list (D33) for every
// business, each row with its business and in its time zone; a failed
// message can be sent again and a waiting one cancelled.
export function WhatsappActivity({
  rows,
  filter,
}: {
  rows: BusinessNotificationSend[]
  filter: ActivityFilter
}) {
  const m = useAdminMessages()
  return (
    <WhatsappActivityList
      rows={rows}
      filter={filter}
      labels={{ ...m.whatsapp.activity, locale: m.locale }}
      showBusiness
      onSendAgain={adminSendAgain}
      onCancel={adminCancelSend}
    />
  )
}
