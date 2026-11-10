import type { CalendarEvent } from "@/lib/booking-calendar"
import type { BookingPayment } from "@/lib/payment-rules"

// One business the client has booked with (D13), from their bookings.
export interface MyPlace {
  business: MyBooking["business"]
  // The latest booking there: its day and time, and its service for
  // "Book again".
  lastWhen: string
  serviceId: string | null
}

// One booking on the customer's own page.
export interface MyBooking {
  id: string
  // Day and time in the business's time zone, in the page's language.
  when: string
  cancelled: boolean
  // Confirmed and still ahead: it can still be moved or called off.
  ahead: boolean
  // What the customer wrote when booking.
  note: string | null
  // The visit as a calendar event (D12).
  calendar: CalendarEvent
  // Still ahead and confirmed: what "Can't make it" does at this business
  // (cancels, or tells the owner), and whether they already said it.
  cantCome: "cancel" | "alertOnly" | null
  saidCantCome: boolean
  // Null once the business removed the service.
  serviceId: string | null
  serviceName: string
  addons: string[]
  teamMemberName: string | null
  durationMinutes: number
  priceMinor: number | null
  currency: string
  // How they chose to pay outside the app, with the way's instructions;
  // null when the booking tracks no payment (lib/payment-rules.ts).
  payment: BookingPayment | null
  business: {
    slug: string
    name: string
    photoUrl: string | null
    address: string | null
  }
}
