// Where customers' sign-in answers (lib/customer-auth.ts), shared with its
// browser client.
export const CUSTOMER_AUTH_PATH = "/api/customer-auth"

// The customer's own pages.
export const MY_BOOKINGS_PATH = "/my-bookings"
export const CUSTOMER_SIGN_IN_PATH = "/my-bookings/sign-in"

// The phone a customer just booked with, kept in the tab (sessionStorage)
// so "Manage your booking" opens sign-in with it filled in, never in the
// address.
export const BOOKED_PHONE_KEY = "koblip-booked-phone"
