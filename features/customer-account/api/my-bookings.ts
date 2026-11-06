import "server-only"
import { and, desc, eq, inArray } from "drizzle-orm"

import { customerKey } from "@/lib/customer-key"
import { db } from "@/lib/db"
import {
  bookingAddons,
  bookings,
  businessPhotos,
  businesses,
} from "@/lib/db/schema"
import type { MyBooking } from "../types"

// How many bookings the page lists, newest first.
const LIMIT = 100

// Every booking made with this phone, at any business (bookings group one
// customer by the phone's digits: lib/customer-key.ts), split into what is
// still ahead and what is over. Only what the customer's own page shows.
export async function myBookings(
  phone: string,
  locale: string,
  now: Date = new Date()
): Promise<{ upcoming: MyBooking[]; past: MyBooking[] }> {
  const rows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      status: bookings.status,
      serviceName: bookings.serviceName,
      teamMemberName: bookings.teamMemberName,
      durationMinutes: bookings.durationMinutes,
      priceMinor: bookings.priceMinor,
      currency: bookings.currency,
      business: {
        id: businesses.id,
        slug: businesses.slug,
        name: businesses.name,
        address: businesses.address,
        timezone: businesses.timezone,
      },
    })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(
      and(
        eq(bookings.customerKey, customerKey(phone, "")),
        eq(businesses.isDemo, false)
      )
    )
    .orderBy(desc(bookings.startAt))
    .limit(LIMIT)

  const addons = rows.length
    ? await db
        .select({
          bookingId: bookingAddons.bookingId,
          name: bookingAddons.name,
        })
        .from(bookingAddons)
        .where(
          inArray(
            bookingAddons.bookingId,
            rows.map((row) => row.id)
          )
        )
        .orderBy(bookingAddons.position)
    : []

  // Each business's first photo, as on its page.
  const photos = new Map<string, string>()
  if (rows.length) {
    const found = await db
      .select({
        businessId: businessPhotos.businessId,
        url: businessPhotos.url,
      })
      .from(businessPhotos)
      .where(
        inArray(businessPhotos.businessId, [
          ...new Set(rows.map((row) => row.business.id)),
        ])
      )
      .orderBy(businessPhotos.position)
    for (const photo of found) {
      if (!photos.has(photo.businessId)) photos.set(photo.businessId, photo.url)
    }
  }

  const upcoming: MyBooking[] = []
  const past: MyBooking[] = []
  for (const row of rows) {
    const start = new Date(row.startAt)
    const booking: MyBooking = {
      id: row.id,
      when: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: row.business.timezone,
      }).format(start),
      cancelled: row.status === "cancelled",
      serviceName: row.serviceName,
      addons: addons
        .filter((addon) => addon.bookingId === row.id)
        .map((addon) => addon.name),
      teamMemberName: row.teamMemberName,
      durationMinutes: row.durationMinutes,
      priceMinor: row.priceMinor,
      currency: row.currency,
      business: {
        slug: row.business.slug,
        name: row.business.name,
        photoUrl: photos.get(row.business.id) ?? null,
        address: row.business.address,
      },
    }
    if (start > now && !booking.cancelled) upcoming.push(booking)
    else past.push(booking)
  }
  // Soonest first for what is ahead; the newest first for the rest.
  upcoming.reverse()
  return { upcoming, past }
}
