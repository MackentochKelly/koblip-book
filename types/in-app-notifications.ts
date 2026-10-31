// What the owner's bell shows (docs/plans/in-app-notifications.md, N1).
// Shared by the code that creates notifications (lib/in-app-notifications.ts)
// and the bell (features/notifications).

export const IN_APP_KINDS = [
  "newBooking",
  "customerCancelled",
  "customerConfirmed",
  "customerCantCome",
  "customerReplied",
  "messageFailed",
  "templateApproved",
  "templateRejected",
  "koblipLimitNear",
  "koblipLimitReached",
  "connectionRenew",
] as const

export type InAppKind = (typeof IN_APP_KINDS)[number]

// The facts a notification's title is made from, on screen, in the reader's
// language (N-D1). Each kind fills only what it needs.
export type InAppData = {
  customerName?: string
  // Digits only, for a customer Book has no name for.
  customerPhone?: string
  serviceName?: string
  // The visit (ISO), shown in the business's time zone.
  startAt?: string
  // A WhatsApp message (BookingMessage) and its language, for Meta's review
  // and failed sends.
  message?: string
  language?: "en" | "es"
  // Koblip-number templates sent this month and the limit.
  sent?: number
  limit?: number
}
