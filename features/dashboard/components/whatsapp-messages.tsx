"use client"

import type { NotificationMessage } from "../types/notifications"
import type { EditorLimits } from "@/components/message-editor"
import type { BookingField, TemplateLanguage } from "../utils/booking-templates"
import { isCustomerMessage } from "../utils/customer-messages"
import { WhatsappMessageList } from "./whatsapp-message-list"

// Customer messages: what the customer gets, each on or off and editable.
export function WhatsappMessages({
  businessId,
  messages,
  limits,
  examples,
}: {
  businessId: string
  messages: NotificationMessage[]
  limits: EditorLimits
  examples: Record<TemplateLanguage, Record<BookingField, string>>
}) {
  return (
    <WhatsappMessageList
      businessId={businessId}
      limits={limits}
      examples={examples}
      messages={messages.filter((item) => isCustomerMessage(item.message))}
    />
  )
}
