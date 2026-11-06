import "server-only"
import { cache } from "react"

import { getSession } from "./dal"

export interface CustomerSession {
  userId: string
  name: string
  // The account's phone, proved by a sign-in code, as +18095550123.
  phone: string
}

// The signed-in account as a customer: its bookings are the ones made with
// its verified phone. Null when signed out, a demo guest, or no phone yet.
export const getCustomer = cache(async (): Promise<CustomerSession | null> => {
  const session = await getSession()
  if (!session || session.isGuest || !session.phone) return null
  return { userId: session.userId, name: session.name, phone: session.phone }
})
