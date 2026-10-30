import type { BookingMessage } from "@/types/whatsapp"

// Every booking message, in the order the pages list them: the customer's,
// then the owner's alerts. Shared by the business page and the admin (D33).
export const BOOKING_MESSAGES: readonly BookingMessage[] = [
  "confirmed",
  "reminder",
  "changed",
  "cancelled",
  "ownerNewBooking",
  "ownerCantCome",
  "ownerCancelled",
  "ownerFailed",
]
