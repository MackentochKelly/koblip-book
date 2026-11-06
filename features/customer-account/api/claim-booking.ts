"use server"

import { and, eq, isNull } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { bookingClaimHash } from "@/lib/booking-claim"
import { getCustomer } from "@/lib/customer-dal"
import { db } from "@/lib/db"
import { bookings } from "@/lib/db/schema"
import { MY_BOOKINGS_PATH } from "@/lib/my-bookings-links"

// "Manage your booking" after booking signed out: the account just logged
// in takes the booking whose one-time secret this tab kept. A secret works
// once, and only on a booking nobody has yet.
export async function claimBooking(input: {
  bookingId: unknown
  token: unknown
}): Promise<{ claimed: boolean }> {
  const customer = await getCustomer()
  const { bookingId, token } = input
  if (
    !customer ||
    typeof bookingId !== "string" ||
    typeof token !== "string" ||
    !bookingId ||
    !token
  ) {
    return { claimed: false }
  }
  const claimed = await db
    .update(bookings)
    .set({ customerUserId: customer.userId, claimTokenHash: null })
    .where(
      and(
        eq(bookings.id, bookingId),
        eq(bookings.claimTokenHash, bookingClaimHash(token)),
        isNull(bookings.customerUserId)
      )
    )
    .returning({ id: bookings.id })
  if (claimed.length) revalidatePath(MY_BOOKINGS_PATH)
  return { claimed: claimed.length > 0 }
}
