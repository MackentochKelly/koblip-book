import { getLocale } from "next-intl/server"

import { myBooking } from "@/features/customer-account/api/my-bookings"
import { calendarFile } from "@/lib/booking-calendar"
import { getCustomer } from "@/lib/customer-dal"

// GET /api/account/bookings/:bookingId/calendar: one of the client's own
// bookings as an iCalendar file (docs/plans/client-account.md, D12), which
// every calendar app opens. Anyone else's is not found. Never cached: it
// follows the booking as it moves.
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/account/bookings/[bookingId]/calendar">
) {
  const headers = { "cache-control": "private, no-store" }
  const customer = await getCustomer()
  if (!customer) return new Response(null, { status: 401, headers })
  const { bookingId } = await params
  const booking = await myBooking(customer, bookingId, await getLocale())
  if (!booking) return new Response(null, { status: 404, headers })
  return new Response(calendarFile(booking.calendar), {
    headers: {
      ...headers,
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'attachment; filename="booking.ics"',
    },
  })
}
