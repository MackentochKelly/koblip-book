import type {
  BookingMessage,
  TemplateLanguage,
  Wording,
} from "../utils/booking-templates"

// What the WhatsApp page shows and edits (docs/koblip-chat-integration.md,
// step 2): the business's notification settings and each message's wording.

export type NotificationSettings = {
  ownerPhone: string | null
  reminders: number[]
  quietStart: string
  quietEnd: string
  turnedOff: BookingMessage[]
}

// Meta's review of one message in one language, as Chat last reported it:
// not made yet, waiting, approved or rejected.
export type TemplateReview = "missing" | "waiting" | "approved" | "rejected"

export type NotificationMessage = {
  message: BookingMessage
  on: boolean
  texts: Record<
    TemplateLanguage,
    { wording: Wording; isDefault: boolean; review: TemplateReview }
  >
}
