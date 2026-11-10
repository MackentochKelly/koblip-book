import type { PageLanguage } from "@/lib/page-language"

// What the bells show: the owner's (docs/plans/in-app-notifications.md, N1)
// and the client's (docs/plans/client-account.md, D10). Shared by the code
// that creates notifications (lib/in-app-notifications.ts) and the bell
// (features/notifications).

export const OWNER_IN_APP_KINDS = [
  "newBooking",
  "customerCancelled",
  "customerConfirmed",
  "customerCantCome",
  "customerMoved",
  "customerPaid",
  "customerReplied",
  "messageFailed",
  "templateApproved",
  "templateRejected",
  "koblipLimitNear",
  "koblipLimitReached",
  "connectionRenew",
] as const

// The client's: what the business did with their booking, the reminder
// before the visit, and a reward they earned (docs/plans/rewards.md).
export const CLIENT_IN_APP_KINDS = [
  "clientBooked",
  "clientMoved",
  "clientCancelled",
  "clientPaid",
  "clientReminder",
  "clientReviewAsk",
  "clientRewardEarned",
] as const

export const IN_APP_KINDS = [...OWNER_IN_APP_KINDS, ...CLIENT_IN_APP_KINDS] as const

export type OwnerInAppKind = (typeof OWNER_IN_APP_KINDS)[number]
export type ClientInAppKind = (typeof CLIENT_IN_APP_KINDS)[number]
export type InAppKind = (typeof IN_APP_KINDS)[number]

// Whose bell a notification is in: the business owner's, or the account
// that owns its booking.
export const IN_APP_AUDIENCES = ["owner", "client"] as const
export type InAppAudience = (typeof IN_APP_AUDIENCES)[number]

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
  language?: PageLanguage
  // Koblip-number templates sent this month and the limit.
  sent?: number
  limit?: number
}
