"use client"

import type { NotificationMessage } from "../types/notifications"
import type { EditorLimits } from "./message-editor"
import { isCustomerMessage, WhatsappMessageList } from "./whatsapp-message-list"

// Customer messages: what the customer gets, each on or off and editable.
export function WhatsappMessages({
  businessId,
  messages,
  limits,
}: {
  businessId: string
  messages: NotificationMessage[]
  limits: EditorLimits
}) {
  return (
    <WhatsappMessageList
      businessId={businessId}
      limits={limits}
      messages={messages.filter((item) => isCustomerMessage(item.message))}
    />
  )
}
