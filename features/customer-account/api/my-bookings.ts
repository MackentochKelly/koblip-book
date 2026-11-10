import "server-only"
import { and, desc, eq, inArray, type SQL } from "drizzle-orm"

import { cantComeSettingsFor } from "@/lib/customer-cant-come"
import { ownBookings } from "@/lib/customer-bookings"
import type { CustomerSession } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import {
  bookingAddons,
  bookings,
  businessPhotos,
  businesses,
  notificationSends,
} from "@/lib/db/schema"
import { paymentOf } from "@/lib/payment-rules"
import type { MyBooking } from "../types"

// How many bookings the page lists, newest first.
const LIMIT = 100

// The customer's own bookings at every business (lib/customer-dal.ts),
// split into what is still ahead and what is over. Only what the
// customer's own page shows.
export async function myBookings(
  customer: CustomerSession,
  locale: string,
  now: Date = new Date()
): Promise<{ upcoming: MyBooking[]; past: MyBooking[] }> {
  const list = await loadBookings(customer, locale, now)
  const upcoming = list.filter((booking) => booking.ahead).reverse()
  const past = list.filter((booking) => !booking.ahead)
  // Soonest first for what is ahead; the newest first for the rest.
  return { upcoming, past }
}

// One of the customer's own bookings, for its page (D11); null when it
// isn't theirs.
export async function myBooking(
  customer: CustomerSession,
  bookingId: string,
  locale: string,
  now: Date = new Date()
): Promise<MyBooking | null> {
  const [booking] = await loadBookings(
    customer,
    locale,
    now,
    eq(bookings.id, bookingId)
  )
  return booking ?? null
}

// Each business's first photo, as on its page.
export async function firstPhotos(
  businessIds: string[]
): Promise<Map<string, string>> {
  const photos = new Map<string, string>()
  if (!businessIds.length) return photos
  const found = await db
    .select({
      businessId: businessPhotos.businessId,
      url: businessPhotos.url,
    })
    .from(businessPhotos)
    .where(inArray(businessPhotos.businessId, [...new Set(businessIds)]))
    .orderBy(businessPhotos.position)
  for (const photo of found) {
    if (!photos.has(photo.businessId)) photos.set(photo.businessId, photo.url)
  }
  return photos
}

async function loadBookings(
  customer: CustomerSession,
  locale: string,
  now: Date,
  only?: SQL
): Promise<MyBooking[]> {
  const rows = await db
    .select({
      id: bookings.id,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      status: bookings.status,
      moves: bookings.moves,
      serviceId: bookings.serviceId,
      serviceName: bookings.serviceName,
      teamMemberName: bookings.teamMemberName,
      durationMinutes: bookings.durationMinutes,
      priceMinor: bookings.priceMinor,
      currency: bookings.currency,
      note: bookings.note,
      paymentChoice: bookings.paymentChoice,
      paymentMethod: bookings.paymentMethod,
      paymentStatus: bookings.paymentStatus,
      paymentReference: bookings.paymentReference,
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
    .where(and(ownBookings(customer), eq(businesses.isDemo, false), only))
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

  const photos = await firstPhotos(rows.map((row) => row.business.id))

  // For what is still ahead: what "Can't make it" does at each business,
  // and the bookings the customer already said it for (at their time now).
  const ahead = rows.filter(
    (row) => row.status === "confirmed" && new Date(row.startAt) > now
  )
  const cantCome = new Map(
    await Promise.all(
      [...new Set(ahead.map((row) => row.business.id))].map(
        async (id) => [id, (await cantComeSettingsFor(id)).cantCome] as const
      )
    )
  )
  const said = new Set(
    ahead.length
      ? (
          await db
            .select({
              bookingId: notificationSends.bookingId,
              moves: notificationSends.moves,
            })
            .from(notificationSends)
            .where(
              and(
                inArray(
                  notificationSends.bookingId,
                  ahead.map((row) => row.id)
                ),
                eq(notificationSends.message, "ownerCantCome")
              )
            )
        ).map((send) => `${send.bookingId}:${send.moves}`)
      : []
  )

  return rows.map((row) => {
    const start = new Date(row.startAt)
    const open = row.status === "confirmed" && start > now
    const cancelled = row.status === "cancelled"
    return {
      id: row.id,
      when: new Intl.DateTimeFormat(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: row.business.timezone,
      }).format(start),
      cancelled,
      ahead: start > now && !cancelled,
      note: row.note,
      calendar: {
        id: row.id,
        title: `${row.serviceName} · ${row.business.name}`,
        startAt: row.startAt,
        endAt: row.endAt,
        location: row.business.address ?? row.business.name,
        details: row.note,
      },
      cantCome: open ? (cantCome.get(row.business.id) ?? null) : null,
      saidCantCome: said.has(`${row.id}:${row.moves}`),
      serviceId: row.serviceId,
      serviceName: row.serviceName,
      addons: addons
        .filter((addon) => addon.bookingId === row.id)
        .map((addon) => addon.name),
      teamMemberName: row.teamMemberName,
      durationMinutes: row.durationMinutes,
      priceMinor: row.priceMinor,
      currency: row.currency,
      // A cancelled booking owes nothing: its instructions stay hidden.
      payment: cancelled ? null : paymentOf(row),
      business: {
        slug: row.business.slug,
        name: row.business.name,
        photoUrl: photos.get(row.business.id) ?? null,
        address: row.business.address,
      },
    }
  })
}
