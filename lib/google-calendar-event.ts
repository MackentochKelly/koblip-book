import { formatDuration } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { isGoogleEventColor } from "@/lib/google-calendar-colors"
import { phoneLinks } from "@/lib/phone-link"

// What a booking's Google Calendar event says (G6 in
// docs/plans/google-calendar.md): the service and customer as its title,
// the business's address as its place, and the details as short lines in
// the language the owner uses Book in. Its colour is the service's (G7).

const WORDS = {
  en: {
    extras: "Extras",
    with: "With",
    customer: "Customer",
    phone: "Phone",
    whatsapp: "WhatsApp",
    note: "Note",
    price: "Price",
    open: "Open in Koblip Book",
  },
  es: {
    extras: "Extras",
    with: "Con",
    customer: "Cliente",
    phone: "Teléfono",
    whatsapp: "WhatsApp",
    note: "Nota",
    price: "Precio",
    open: "Abrir en Koblip Book",
  },
} as const

export type EventBooking = {
  id: string
  serviceName: string
  teamMemberName: string | null
  customerName: string
  customerPhone: string | null
  note: string | null
  durationMinutes: number
  priceMinor: number | null
  currency: string
  startAt: string
  endAt: string
}

export type EventPlace = {
  businessId: string
  timeZone: string
  address: string | null
  language: "en" | "es"
  // The owner's site address; null leaves out the link (a team member has
  // no account to open it with).
  site: string | null
}

// The booking's day (yyyy-mm-dd) in the business's time zone.
function dayOf(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso)
  )
}

export function eventOf(
  booking: EventBooking,
  extras: string[],
  place: EventPlace,
  // The service's colour (a Google colorId); null keeps the calendar's.
  color: string | null = null
) {
  const t = WORDS[place.language]
  const day = dayOf(booking.startAt, place.timeZone)
  const lines = [
    `${booking.serviceName} · ${formatDuration(booking.durationMinutes)}`,
    extras.length ? `${t.extras}: ${extras.join(", ")}` : null,
    booking.teamMemberName ? `${t.with}: ${booking.teamMemberName}` : null,
    `${t.customer}: ${booking.customerName}`,
    booking.customerPhone ? `${t.phone}: ${booking.customerPhone}` : null,
    booking.customerPhone ? `${t.whatsapp}: ${phoneLinks(booking.customerPhone).whatsapp}` : null,
    booking.note ? `${t.note}: ${booking.note}` : null,
    booking.priceMinor !== null
      ? `${t.price}: ${formatPrice(booking.priceMinor, booking.currency, place.language === "es" ? "es" : "en-US")}`
      : null,
    // The bookings of that day in the owner area.
    place.site
      ? `${t.open}: ${new URL(
          `/dashboard/${encodeURIComponent(place.businessId)}/bookings?from=${day}&to=${day}`,
          place.site
        )}`
      : null,
  ]
  return {
    summary: `${booking.serviceName} · ${booking.customerName}`,
    description: lines.filter(Boolean).join("\n"),
    ...(place.address ? { location: place.address } : {}),
    start: { dateTime: booking.startAt, timeZone: place.timeZone },
    end: { dateTime: booking.endAt, timeZone: place.timeZone },
    ...(isGoogleEventColor(color) ? { colorId: color } : {}),
    // A removed event keeps its id at Google; this brings it back.
    status: "confirmed",
    extendedProperties: { private: { koblipBookingId: booking.id } },
  }
}

export type GoogleEvent = ReturnType<typeof eventOf>
