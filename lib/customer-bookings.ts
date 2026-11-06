import "server-only"
import { eq, or, type SQL } from "drizzle-orm"

import type { CustomerSession } from "./customer-dal"
import { customerKey } from "./customer-key"
import { bookings } from "./db/schema"

// The customer's own bookings: the ones made or claimed with this account,
// and the ones made with its verified phone (bookings group a customer by
// the phone's digits: lib/customer-key.ts).
export function ownBookings(customer: CustomerSession): SQL {
  const mine = eq(bookings.customerUserId, customer.userId)
  if (!customer.phone) return mine
  return or(mine, eq(bookings.customerKey, customerKey(customer.phone, "")))!
}
