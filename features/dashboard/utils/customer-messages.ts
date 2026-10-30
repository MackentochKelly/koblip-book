import type { CustomerMessage } from "../types/notifications"
import type { BookingMessage } from "./booking-templates"

const CUSTOMER_MESSAGES: readonly CustomerMessage[] = [
  "confirmed",
  "reminder",
  "changed",
  "cancelled",
]

// Customer messages go to the customer; the rest are the owner's alerts.
export function isCustomerMessage(message: BookingMessage): message is CustomerMessage {
  return (CUSTOMER_MESSAGES as readonly string[]).includes(message)
}
