"use client"

import { WhatsappActivityList } from "@/components/whatsapp-activity-list"
import { sendAgain } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { ActivityFilter, NotificationSend } from "../types/notifications"

// Activity on the business's WhatsApp page (P7): the shared list (D33), in
// the business's time zone, with "Send again" for a failed message.
export function WhatsappActivity({
  businessId,
  history,
  filter,
  timeZone,
}: {
  businessId: string
  history: NotificationSend[]
  filter: ActivityFilter
  timeZone: string
}) {
  const m = useOwnerMessages()
  return (
    <WhatsappActivityList
      rows={history}
      filter={filter}
      timeZone={timeZone}
      labels={{ ...m.whatsapp, locale: m.locale }}
      onSendAgain={(id) => sendAgain(businessId, id)}
    />
  )
}
