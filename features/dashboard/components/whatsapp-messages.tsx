"use client"

import type { NotificationMessage } from "../types/notifications"
import { isCustomerMessage, WhatsappMessageList } from "./whatsapp-message-list"

// Customer messages: what the customer gets, each on or off and editable.
export function WhatsappMessages({
  businessId,
  messages,
}: {
  businessId: string
  messages: NotificationMessage[]
}) {
  return (
    <WhatsappMessageList
      businessId={businessId}
      messages={messages.filter((item) => isCustomerMessage(item.message))}
    />
  )
}
