import "server-only"
import { cache } from "react"
import { headers } from "next/headers"

import { customerAuth } from "./customer-auth"

export interface CustomerSession {
  userId: string
  name: string
  // Verified by the sign-in code, as +18095550123.
  phone: string
}

// The signed-in customer (lib/customer-auth.ts), or null. Owners' sessions
// never count here, nor customers' in the owner area.
export const getCustomer = cache(async (): Promise<CustomerSession | null> => {
  const session = await customerAuth.api.getSession({
    headers: await headers(),
  })
  const phone = session?.user.phoneNumber
  if (!session || !phone || !session.user.phoneNumberVerified) return null
  return { userId: session.user.id, name: session.user.name, phone }
})
