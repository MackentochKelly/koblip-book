// Every email Koblip Book sends and what became of it (docs/plans/email.md,
// EM-D4, EM-D5). Shared by the tables, the sender and the admin screens.

// What an email is.
export const EMAIL_KINDS = [
  "verification",
  "resetPassword",
  "teamInvite",
  "teamCalendar",
  "paymentFailed",
  "backToFree",
  "clientReminder",
] as const

export type EmailKind = (typeof EMAIL_KINDS)[number]

// pending → sending → sent | failed; skipped when it must not go.
export const EMAIL_SEND_STATES = [
  "pending",
  "sending",
  "sent",
  "failed",
  "skipped",
] as const

export type EmailSendState = (typeof EMAIL_SEND_STATES)[number]

// Why an email was skipped or failed: a short code the admin sees.
export const EMAIL_SEND_REASONS = [
  "blocked",
  "notSetUp",
  "sendFailed",
] as const

export type EmailSendReason = (typeof EMAIL_SEND_REASONS)[number]

// What Amazon said happened after it took the email (SES events).
export const EMAIL_DELIVERY = [
  "delivered",
  "delayed",
  "bounced",
  "complained",
  "rejected",
] as const

export type EmailDelivery = (typeof EMAIL_DELIVERY)[number]

// Why an address gets no more email: it bounced for good, its owner marked
// an email as spam, or they used "Stop emails" (EM-D10, one business).
export const EMAIL_BLOCK_REASONS = ["bounce", "complaint", "stopped"] as const

export type EmailBlockReason = (typeof EMAIL_BLOCK_REASONS)[number]

// Addresses are kept and compared in lower case.
export function normalEmail(address: string): string {
  return address.trim().toLowerCase()
}
