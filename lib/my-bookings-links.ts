import { loginHref } from "./auth-links"
import type { PageLanguage } from "./page-language"

// The customer's own pages, and how to get to them.
export const MY_BOOKINGS_PATH = "/my-bookings"

export function myBookingsHref(language: string): string {
  return `${MY_BOOKINGS_PATH}?lang=${language}`
}

// The one login page everyone uses, coming back to My bookings.
export function myBookingsLoginHref(language: PageLanguage): string {
  return loginHref({ next: myBookingsHref(language), language })
}

export function rescheduleHref(bookingId: string, language: string): string {
  return `${MY_BOOKINGS_PATH}/${encodeURIComponent(bookingId)}/reschedule?lang=${language}`
}

// The phone a customer just booked with, kept in the tab (sessionStorage)
// so phone sign-in opens with it filled in, never in the address.
export const BOOKED_PHONE_KEY = "koblip-booked-phone"

// A booking made signed out, kept in the tab as { bookingId, token } until
// My bookings joins it to the account logged in (lib/booking-claim.ts).
export const BOOKING_CLAIM_KEY = "koblip-booking-claim"
