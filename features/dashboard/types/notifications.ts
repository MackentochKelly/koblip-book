import type {
  BookingMessage,
  TemplateLanguage,
  Wording,
} from "../utils/booking-templates"

// What the WhatsApp page shows and edits (docs/koblip-chat-integration.md,
// step 2): the business's notification settings and each message's wording.

export type NotificationSettings = {
  ownerPhone: string | null
  ownerLanguage: TemplateLanguage
  reminders: number[]
  quietStart: string
  quietEnd: string
  turnedOff: BookingMessage[]
}

// Meta's review of one message in one language, as Chat last reported it:
// not made yet, waiting, approved or rejected.
export type TemplateReview = "missing" | "waiting" | "approved" | "rejected"

// One message Book sent, will send or did not send, for the history.
export type NotificationSend = {
  id: string
  message: BookingMessage
  customerName: string
  // When it went, or is or was due (ISO).
  at: string
  state: "pending" | "sending" | "sent" | "failed" | "skipped"
  reason: string | null
  // WhatsApp's delivery status, once Chat reports it.
  delivery: string | null
}

export type NotificationMessage = {
  message: BookingMessage
  on: boolean
  texts: Record<
    TemplateLanguage,
    { wording: Wording; isDefault: boolean; review: TemplateReview }
  >
}
