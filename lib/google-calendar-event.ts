import "server-only"
import { createTranslator } from "next-intl"

import { durationIn } from "@/lib/format-duration"
import { formatPrice } from "@/lib/format-price"
import { isGoogleEventColor } from "@/lib/google-calendar-colors"
import { DEFAULT_LOCALES, type PageLanguage } from "@/lib/page-language"
import { phoneLinks } from "@/lib/phone-link"
import { wordsFor } from "@/lib/translations/interface-words"

// What a booking's Google Calendar event says (G6 in
// docs/plans/google-calendar.md): the service and customer as its title,
// the business's address as its place, and the details as short lines in
// the language the owner uses Book in. Its colour is the service's (G7).

// The event's words (appServer.calendarEvent, app.duration) in the owner's
// language. The sync runs on the server's timer, with no request.
export async function eventWordsFor(language: PageLanguage) {
  const messages = await wordsFor(language)
  const locale = DEFAULT_LOCALES[language]
  return {
    event: createTranslator({ locale, messages, namespace: "appServer.calendarEvent" }),
    duration: createTranslator({ locale, messages, namespace: "app.duration" }),
  }
}

export type EventWords = Awaited<ReturnType<typeof eventWordsFor>>

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
  language: PageLanguage
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
  words: EventWords,
  // The service's colour, else its category's (eventColorOf, a Google
  // colorId); null keeps the calendar's.
  color: string | null = null
) {
  const t = words.event
  const day = dayOf(booking.startAt, place.timeZone)
  const lines = [
    `${booking.serviceName} · ${durationIn(words.duration, booking.durationMinutes)}`,
    extras.length ? t("extras", { extras: extras.join(", ") }) : null,
    booking.teamMemberName ? t("with", { name: booking.teamMemberName }) : null,
    t("customer", { name: booking.customerName }),
    booking.customerPhone ? t("phone", { phone: booking.customerPhone }) : null,
    booking.customerPhone ? t("whatsapp", { link: phoneLinks(booking.customerPhone).whatsapp }) : null,
    booking.note ? t("note", { note: booking.note }) : null,
    booking.priceMinor !== null
      ? t("price", {
          price: formatPrice(booking.priceMinor, booking.currency, place.language === "es" ? "es" : "en-US"),
        })
      : null,
    // The bookings of that day in the owner area.
    place.site
      ? t("open", {
          link: new URL(
            `/dashboard/${encodeURIComponent(place.businessId)}/bookings?from=${day}&to=${day}`,
            place.site
          ).toString(),
        })
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
