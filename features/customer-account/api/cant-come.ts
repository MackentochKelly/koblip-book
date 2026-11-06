"use server"

import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { MY_BOOKINGS_PATH } from "@/lib/my-bookings-links"
import {
  afterCustomerCancel,
  cantComeSettingsFor,
  customerCantComeWrites,
} from "@/lib/customer-cant-come"
import { ownBookings } from "@/lib/customer-bookings"
import { getCustomer } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { saveAll } from "@/lib/db/save-all"
import { bookings, businesses } from "@/lib/db/schema"

export type CantComeResult =
  | { ok: true; cancelled: boolean }
  | { ok: false; error: "signedOut" | "notFound" | "over" }

// "Can't make it" on My bookings: the signed-in customer's own booking,
// still ahead and confirmed, does what the business chose, exactly like
// the WhatsApp button (lib/customer-cant-come.ts).
export async function cantCome(bookingId: unknown): Promise<CantComeResult> {
  const customer = await getCustomer()
  if (!customer) return { ok: false, error: "signedOut" }
  if (typeof bookingId !== "string" || !bookingId) {
    return { ok: false, error: "notFound" }
  }
  const [found] = await db
    .select({ booking: bookings, slug: businesses.slug })
    .from(bookings)
    .innerJoin(businesses, eq(businesses.id, bookings.businessId))
    .where(and(eq(bookings.id, bookingId), ownBookings(customer)))
    .limit(1)
  if (!found) return { ok: false, error: "notFound" }
  const { booking } = found
  if (
    booking.status !== "confirmed" ||
    Date.parse(booking.startAt) <= Date.now()
  ) {
    return { ok: false, error: "over" }
  }
  const settings = await cantComeSettingsFor(booking.businessId)
  const { writes, cancelled } = await customerCantComeWrites(booking, settings)
  await saveAll(writes)
  if (cancelled) afterCustomerCancel(booking.businessId, found.slug)
  revalidatePath(MY_BOOKINGS_PATH)
  return { ok: true, cancelled }
}
