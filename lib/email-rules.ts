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
  // A booking's emails (EM-D6): the customer's four (the reminder keeps its
  // first name) and the owner's three.
  "clientReminder",
  "bookingConfirmed",
  "bookingChanged",
  "bookingCancelled",
  "ownerNewBooking",
  "ownerCantCome",
  "ownerCancelled",
] as const

export type EmailKind = (typeof EMAIL_KINDS)[number]

// A booking's emails, each with the owner's own switch (EM-D10): the
// customer's four, then the owner's three.
export const CUSTOMER_EMAILS = [
  "bookingConfirmed",
  "clientReminder",
  "bookingChanged",
  "bookingCancelled",
] as const satisfies readonly EmailKind[]

export const OWNER_EMAILS = [
  "ownerNewBooking",
  "ownerCantCome",
  "ownerCancelled",
] as const satisfies readonly EmailKind[]

export const BOOKING_EMAILS = [...CUSTOMER_EMAILS, ...OWNER_EMAILS] as const

export type BookingEmail = (typeof BOOKING_EMAILS)[number]

export function isBookingEmail(value: unknown): value is BookingEmail {
  return BOOKING_EMAILS.some((kind) => kind === value)
}

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
  // A booking's email that no longer fits: the booking was cancelled or
  // moved after it was planned, or its time has passed.
  "cancelled",
  "moved",
  "late",
  // A move's "Booking changed" when the customer never got the
  // confirmation: the next email they get has the new time anyway.
  "notTold",
  // The owner turned this email off.
  "turnedOff",
  // Left "sending" when the server stopped mid-send: never tried again, as
  // it may have gone.
  "interrupted",
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

// How far back the timer looks for bookings made, and owner alerts raised,
// that still need their email: a short gap (a restart) is covered, and the
// first run after a deploy never emails old bookings.
export const EMAIL_RULES = { planWindowMinutes: 60 } as const

// Addresses are kept and compared in lower case.
export function normalEmail(address: string): string {
  return address.trim().toLowerCase()
}
