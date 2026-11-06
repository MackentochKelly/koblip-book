import { loginHref } from "./auth-links"
import type { PageLanguage } from "./page-language"

// The client's own area (docs/plans/client-account.md), and how to get to
// it. It is an app area: it speaks the app's language (proxy.ts), like the
// owner and team areas.
export const MY_BOOKINGS_PATH = "/account"
export const ACCOUNT_PROFILE_PATH = "/account/profile"
export const ACCOUNT_SETTINGS_PATH = "/account/settings"

// The one login page everyone uses, in the page's language, coming back to
// the client's bookings.
export function myBookingsLoginHref(language: PageLanguage): string {
  return loginHref({ next: MY_BOOKINGS_PATH, language })
}

export function rescheduleHref(bookingId: string): string {
  return `${MY_BOOKINGS_PATH}/reschedule/${encodeURIComponent(bookingId)}`
}

// The phone a customer just booked with, kept in the tab (sessionStorage)
// so phone sign-in opens with it filled in, never in the address.
export const BOOKED_PHONE_KEY = "koblip-booked-phone"

// A booking made signed out, kept in the tab as { bookingId, token } until
// the client's bookings join it to the account logged in
// (lib/booking-claim.ts).
export const BOOKING_CLAIM_KEY = "koblip-booking-claim"
