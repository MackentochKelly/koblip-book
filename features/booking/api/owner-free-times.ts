"use server"

import { eq } from "drizzle-orm"
import { requireOwner } from "@/lib/dal"
import { db } from "@/lib/db"
import { businesses } from "@/lib/db/schema"
import type {
  OwnerFreeTimes,
  OwnerFreeTimesInput,
} from "@/types/owner-booking"
import { getAvailability } from "./get-availability"

// The free times for a booking the owner adds, from the same rules as the
// booking page (opening and team hours, bookings already made, the
// service's length with its add-ons). Only the business's owner may ask.
export async function findOwnerFreeTimes(
  input: OwnerFreeTimesInput
): Promise<OwnerFreeTimes> {
  const session = await requireOwner()
  const [business] = await db
    .select({ slug: businesses.slug, ownerId: businesses.ownerId })
    .from(businesses)
    .where(eq(businesses.id, input.businessId))
    .limit(1)
  if (!business || business.ownerId !== session.userId) return null
  if (
    typeof input.serviceId !== "string" ||
    (input.teamMemberId !== null && typeof input.teamMemberId !== "string") ||
    !Array.isArray(input.addonIds) ||
    !input.addonIds.every((id) => typeof id === "string")
  ) {
    return null
  }
  return getAvailability(
    business.slug,
    input.serviceId,
    input.teamMemberId,
    input.addonIds
  )
}
