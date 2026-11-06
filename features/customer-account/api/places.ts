import "server-only"
import { and, desc, eq } from "drizzle-orm"

import { ownBookings } from "@/lib/customer-bookings"
import type { CustomerSession } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { bookings, businesses } from "@/lib/db/schema"
import type { MyPlace } from "../types"
import { firstPhotos } from "./my-bookings"

// How many of the latest bookings the list is made from.
const LIMIT = 500

// The businesses the client has booked with (docs/plans/client-account.md,
// D13), the latest first, each with its latest booking: nothing new is
// stored, it comes from the account's own bookings.
export async function myPlaces(
  customer: CustomerSession,
  locale: string,
  now: Date = new Date()
): Promise<MyPlace[]> {
  const rows = await db
    .select({
      startAt: bookings.startAt,
      serviceId: bookings.serviceId,
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
    .where(and(ownBookings(customer), eq(businesses.isDemo, false)))
    .orderBy(desc(bookings.startAt))
    .limit(LIMIT)

  const latest = new Map<string, (typeof rows)[number]>()
  for (const row of rows) {
    if (!latest.has(row.business.id)) latest.set(row.business.id, row)
  }
  const photos = await firstPhotos([...latest.keys()])
  return [...latest.values()].map((row) => ({
    business: {
      slug: row.business.slug,
      name: row.business.name,
      photoUrl: photos.get(row.business.id) ?? null,
      address: row.business.address,
    },
    // The year only when it isn't this one, so the line stays short.
    lastWhen: new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      year:
        new Date(row.startAt).getUTCFullYear() === now.getUTCFullYear()
          ? undefined
          : "numeric",
      timeZone: row.business.timezone,
    }).format(new Date(row.startAt)),
    serviceId: row.serviceId,
  }))
}
