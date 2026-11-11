"use server"

import { getSession } from "@/lib/dal"

// Who is booking, for the details step: a signed-in account's name, real
// email and proved phone fill the form, and the step leaves out "Continue
// with Google". Null when signed out (or a demo guest).
export type BookingCustomer = {
  name: string
  email: string | null
  phone: string | null
}

export async function bookingCustomer(): Promise<BookingCustomer | null> {
  const session = await getSession()
  if (!session || session.isGuest) return null
  return { name: session.name, email: session.email, phone: session.phone }
}
