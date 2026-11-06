import "server-only"
import { isValidPhoneNumber } from "libphonenumber-js"
import { desc, eq } from "drizzle-orm"

import { customerKey } from "./customer-key"
import { db } from "./db"
import { bookings } from "./db/schema"

// How long a sign-in code works, and how many tries it gets.
export const SIGN_IN_RULES = {
  codeMinutes: 5,
  codeTries: 3,
  // Codes one device may ask for in a minute.
  codesPerMinute: 3,
  sessionDays: 30,
} as const

// Where a customer's sign-in code goes. WhatsApp from Koblip's number needs
// Meta's approval of an authentication template first
// (developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates),
// which the owner submits by hand; until then only this Mac's dev server
// signs customers in, the code printed in its log. Production offers no
// sign-in yet, so no customer ever waits for a code that cannot come.
export type CodeDelivery = "devLog"

export function signInCodeDelivery(): CodeDelivery | null {
  return process.env.NODE_ENV === "production" ? null : "devLog"
}

export function customerSignInReady(): boolean {
  return signInCodeDelivery() !== null
}

export function isCustomerPhone(phone: string): boolean {
  return /^\+\d+$/.test(phone) && isValidPhoneNumber(phone)
}

// The name on the customer's latest booking with this phone, the profile's
// name; null when the phone never booked.
export async function latestBookingName(phone: string): Promise<string | null> {
  const [row] = await db
    .select({ name: bookings.customerName })
    .from(bookings)
    .where(eq(bookings.customerKey, customerKey(phone, "")))
    .orderBy(desc(bookings.createdAt))
    .limit(1)
  return row?.name ?? null
}

// Sends the code to a phone that has booked; any other phone gets nothing,
// and the screen says the same either way, so it shows no one's bookings.
export async function sendSignInCode(
  phone: string,
  code: string
): Promise<void> {
  const delivery = signInCodeDelivery()
  if (!delivery)
    throw new Error("Customer sign-in has no way to send codes yet.")
  if ((await latestBookingName(phone)) === null) return
  console.info(`[customer sign-in] code for ${phone}: ${code}`)
}
