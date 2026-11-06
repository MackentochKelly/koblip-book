import "server-only"
import { cache } from "react"

import { getSession } from "./dal"

export interface CustomerSession {
  userId: string
  name: string
  // The account's phone, proved by a sign-in code, as +18095550123; null
  // for an account made with Google or email.
  phone: string | null
}

// The signed-in account as a customer. Null when signed out or a demo
// guest, who log in on the one login page.
export const getCustomer = cache(async (): Promise<CustomerSession | null> => {
  const session = await getSession()
  if (!session || session.isGuest) return null
  return { userId: session.userId, name: session.name, phone: session.phone }
})
