"use server"

import { and, eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import type { ActionResult } from "../types"
import { ownedBusiness, revalidateBusiness } from "./owned-business"

type SettableStatus = "confirmed" | "completed" | "no_show"

export async function setBookingStatus(
  businessId: string,
  bookingId: string,
  status: SettableStatus
): Promise<ActionResult> {
  const owned = await ownedBusiness(businessId)
  if (!owned) {
    return { ok: false, error: "not_found" }
  }
  if (status !== "confirmed" && status !== "completed" && status !== "no_show") {
    return { ok: false, error: "invalid" }
  }
  const [booking] = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.businessId, owned.business.id)
      )
    )
    .limit(1)
  if (!booking) {
    return { ok: false, error: "not_found" }
  }
  if (booking.status === "cancelled") {
    return { ok: false, error: "cancelled" }
  }
  if (
    (status === "completed" || status === "no_show") &&
    Date.parse(booking.startAt) > Date.now()
  ) {
    return { ok: false, error: "not_started" }
  }
  await db
    .update(bookings)
    .set({ status })
    .where(eq(bookings.id, booking.id))
  revalidateBusiness(owned.business.slug)
  return { ok: true }
}
