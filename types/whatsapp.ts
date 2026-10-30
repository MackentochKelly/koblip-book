// The WhatsApp words the business page and the admin share
// (docs/plans/whatsapp-notifications.md, W0 and D33): the kinds of message,
// the numbers they go from, and one message as Activity lists it.

// Which number a business's messages go from: Koblip's own, by default, or
// the business's own once it connects its Koblip Chat workspace.
export type Sender = "koblip" | "own"

// The messages to the customer, and the alerts to the owner's own WhatsApp.
export type CustomerMessage = "confirmed" | "reminder" | "changed" | "cancelled"
export type OwnerAlert = "ownerNewBooking" | "ownerCantCome" | "ownerCancelled" | "ownerFailed"
export type BookingMessage = CustomerMessage | OwnerAlert

// What a button does when the customer taps it. Buttons are WhatsApp quick
// replies: a short label (NOTIFICATION_RULES.maxButtonLabel) with this action
// as the payload Book reads back.
export type ButtonAction = "confirm" | "cantCome" | "ok"

// A customer's tap on a message's button.
export type NotificationReply = { action: ButtonAction; at: string }

// Every kind of message Activity lists: the booking messages and the owner's
// alerts (S5), and the thank-you a customer's tap queues (S3, D16, D19).
export type SendKind = BookingMessage | "thankYou"

// One message Book sent, will send or did not send, for Activity.
export type NotificationSend = {
  id: string
  message: SendKind
  customerName: string
  // When it went, or is or was due (ISO).
  at: string
  state: "pending" | "sending" | "sent" | "failed" | "skipped"
  reason: string | null
  // A normal message inside the 24-hour window, or the template.
  via: "text" | "template" | null
  sender: Sender
  // WhatsApp's delivery status, once Chat reports it.
  delivery: string | null
  reply: NotificationReply | null
}

// One message in the admin's Activity for all businesses (A5): which
// business, and its time zone for the time shown.
export type BusinessNotificationSend = NotificationSend & {
  businessId: string
  businessName: string
  timeZone: string
}

export type ActivityFilter = {
  message?: SendKind
  state?: NotificationSend["state"]
  // Customer name or phone.
  search?: string
}
