import { loginHref } from "./auth-links"
import type { PageLanguage } from "./page-language"

// The client's own area (docs/plans/client-account.md), and how to get to
// it. It is an app area: it speaks the app's language (proxy.ts), like the
// owner and team areas.
export const MY_BOOKINGS_PATH = "/account"
export const ACCOUNT_PROFILE_PATH = "/account/profile"
export const ACCOUNT_SETTINGS_PATH = "/account/settings"
export const ACCOUNT_PLACES_PATH = "/account/places"
// The profile with the add-phone panel open (the empty Bookings page's
// action: bookings made with that phone then show).
export const ACCOUNT_ADD_PHONE_PATH = "/account/profile?phone=add"

// "Book again" (D13): the business's booking with the same service picked,
// or its page when that service is gone.
export function bookAgainHref(
  slug: string,
  serviceId: string | null,
  language: PageLanguage
): string {
  const lang = `lang=${encodeURIComponent(language)}`
  return serviceId
    ? `/b/${slug}/book?service=${encodeURIComponent(serviceId)}&${lang}`
    : `/b/${slug}?${lang}`
}

// One booking's own page in the client account (D11).
export function accountBookingHref(bookingId: string): string {
  return `/account/bookings/${encodeURIComponent(bookingId)}`
}

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
