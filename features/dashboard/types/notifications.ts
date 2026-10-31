import type { BookingMessage, ButtonAction, Sender, TemplateReview } from "@/types/whatsapp"
import type { TemplateLanguage, Wording } from "../utils/booking-templates"

// The contract for WhatsApp notifications v2 (docs/plans/whatsapp-notifications.md,
// W0): what the WhatsApp page shows and edits, and what the server keeps.
// The page and the server both build against these types; change them only
// with a note in the plan. The words the admin shares live in
// types/whatsapp.ts (D33) and are named here too, so this stays the one
// contract the feature reads.
export type {
  ActivityFilter,
  ButtonAction,
  CustomerMessage,
  NotificationReply,
  NotificationSend,
  OwnerAlert,
  Sender,
  SendKind,
  TemplateReview,
} from "@/types/whatsapp"

export type MessageButton = { action: ButtonAction; label: string }

// What "Can't make it" does (decision D2 in the plan).
export type CantComeAction = "cancel" | "alertOnly"

export type NotificationSettings = {
  ownerPhone: string | null
  ownerLanguage: TemplateLanguage
  reminders: number[]
  quietStart: string
  quietEnd: string
  turnedOff: BookingMessage[]
  // Inside 24 hours of the person's last message, send a normal message
  // (free) instead of the template.
  freeTextInWindow: boolean
  cantCome: CantComeAction
  // A short thank-you after the customer taps a button.
  thankYouReply: boolean
}


export type NotificationText = {
  wording: Wording
  buttons: MessageButton[]
  isDefault: boolean
  review: TemplateReview
  // Meta's reason when it refused, in Meta's words.
  reason: string | null
}

export type NotificationMessage = {
  message: BookingMessage
  on: boolean
  // False on Koblip's number: its ready-made wording only turns on or off.
  editable: boolean
  texts: Record<TemplateLanguage, NotificationText>
}

// The setup steps the Overview shows, each done or not.
export type SetupStep = "connected" | "reviewed" | "submitted" | "approved" | "live"

export type NotificationOverview = {
  sender: Sender
  // The number messages go from, as WhatsApp shows it, when known.
  number: string | null
  steps: Record<SetupStep, boolean>
}

