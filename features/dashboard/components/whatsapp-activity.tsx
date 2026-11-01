"use client"

import Link from "next/link"

import { WhatsappActivityList } from "@/components/whatsapp-activity-list"
import { Button } from "@/components/ui/button"
import { sendAgain } from "../api/notification-actions"
import { useOwnerMessages } from "../i18n/provider"
import type { ActivityFilter, NotificationSend } from "../types/notifications"
import type { AutomationRun } from "../types/automations"

// Activity on the business's WhatsApp page (P7): the shared list (D33), in
// the business's time zone, with "Send again" for a failed message, and the
// automation runs among them (D18).
export function WhatsappActivity({
  businessId,
  history,
  runs,
  filter,
  timeZone,
}: {
  businessId: string
  history: NotificationSend[]
  runs: AutomationRun[]
  filter: ActivityFilter
  timeZone: string
}) {
  const m = useOwnerMessages()
  return (
    <WhatsappActivityList
      rows={history}
      runs={runs}
      filter={filter}
      timeZone={timeZone}
      labels={{ ...m.whatsapp, locale: m.locale }}
      onSendAgain={(id) => sendAgain(businessId, id)}
      // Nothing sent yet: the Overview's test shows what customers get.
      emptyAction={
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={`/dashboard/${businessId}/automations#test`} />}
        >
          {m.whatsapp.sendATest}
        </Button>
      }
    />
  )
}
