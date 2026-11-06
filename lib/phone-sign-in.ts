import "server-only"
import { isValidPhoneNumber } from "libphonenumber-js"
import { desc, eq } from "drizzle-orm"

import { customerKey } from "./customer-key"
import { db } from "./db"
import { bookings } from "./db/schema"

// Signing in with a phone and a code sent to it, for any account: owners,
// team and customers alike (lib/auth.ts). How long a code works, and how
// many tries it gets.
export const PHONE_SIGN_IN_RULES = {
  codeMinutes: 5,
  codeTries: 3,
  // Codes one device may ask for in a minute.
  codesPerMinute: 3,
} as const

// Where a sign-in code goes. WhatsApp from Koblip's number needs Meta's
// approval of an authentication template first
// (developers.facebook.com/docs/whatsapp/business-management-api/authentication-templates),
// which the owner submits by hand; until then only this Mac's dev server
// offers phone sign-in, the code printed in its log. Production does not
// offer it yet, so no one ever waits for a code that cannot come.
export type CodeDelivery = "devLog"

export function phoneCodeDelivery(): CodeDelivery | null {
  return process.env.NODE_ENV === "production" ? null : "devLog"
}

export function phoneSignInReady(): boolean {
  return phoneCodeDelivery() !== null
}

export function isSignInPhone(phone: string): boolean {
  return /^\+\d+$/.test(phone) && isValidPhoneNumber(phone)
}

// The name on the latest booking made with this phone, for an account the
// phone creates; null when the phone never booked.
export async function latestBookingName(phone: string): Promise<string | null> {
  const [row] = await db
    .select({ name: bookings.customerName })
    .from(bookings)
    .where(eq(bookings.customerKey, customerKey(phone, "")))
    .orderBy(desc(bookings.createdAt))
    .limit(1)
  return row?.name ?? null
}

// A reserved domain (RFC 2606): an account made by phone needs an email for
// Better Auth, and this one is never real and never mailed.
const PHONE_EMAIL_DOMAIN = "phone.invalid"

export function phoneAccountEmail(phone: string): string {
  return `${phone.replace(/\D/g, "")}@${PHONE_EMAIL_DOMAIN}`
}

export function isPhoneAccountEmail(email: string): boolean {
  return email.endsWith(`@${PHONE_EMAIL_DOMAIN}`)
}

export async function sendPhoneCode(
  phone: string,
  code: string
): Promise<void> {
  if (!phoneCodeDelivery()) {
    throw new Error("Phone sign-in has no way to send codes yet.")
  }
  console.info(`[phone sign-in] code for ${phone}: ${code}`)
}
